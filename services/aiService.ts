
import type { MessageEnvelope, OrchestratorMode, AIConfig, EmergenceDataLog, EmergenceAnalysisReport } from '../types';
import { NodeName } from '../types';
import { SCHEMA_REGISTRY } from '../schemas';
import { GoogleGenAI } from "@google/genai";
import { validatePayload } from './validator';
import { mathKnowledgeBase } from './mathKnowledgeBase';

// --- API Governor for Rate Limiting ---
let apiCallIntervalMs = 3000; // Default for Gemini
let nextApiCallTimestamp = 0;

const throttleApiCall = async () => {
    const now = Date.now();
    const scheduledTime = Math.max(now, nextApiCallTimestamp);
    const delayNeeded = scheduledTime - now;
    nextApiCallTimestamp = scheduledTime + apiCallIntervalMs;
    if (delayNeeded > 0) {
        await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
};

export const resetApiGovernor = () => {
    nextApiCallTimestamp = 0;
};

// --- Large Report Handling Constants & Helpers ---
const SAFE_TOKEN_LIMIT = 80000; // Safe token threshold for data payload to AI
const MAX_MESSAGES_FOR_ANALYSIS = 500; // Max messages after pruning for Meta/Arbiter
const MAX_PAYLOADS_FOR_EMERGENCE = 350; // Max payloads after sampling for Emergence
const APPROX_CHARS_PER_TOKEN = 4;

function estimateTokens(data: any): number {
  if (!data) return 0;
  try {
    const jsonString = JSON.stringify(data);
    return Math.ceil(jsonString.length / APPROX_CHARS_PER_TOKEN);
  } catch (e) {
    console.error("Could not estimate tokens for data:", data);
    return Infinity; // Trigger pruning if stringification fails
  }
}

function pruneMessageTraceForAnalysis(messages: MessageEnvelope[]): MessageEnvelope[] {
  if (messages.length <= MAX_MESSAGES_FOR_ANALYSIS) return messages;

  const headCount = Math.floor(MAX_MESSAGES_FOR_ANALYSIS * 0.4);
  const tailCount = Math.floor(MAX_MESSAGES_FOR_ANALYSIS * 0.4);
  const middleSampleCount = MAX_MESSAGES_FOR_ANALYSIS - headCount - tailCount;

  const head = messages.slice(0, headCount);
  const tail = messages.slice(-tailCount);
  
  const middle = messages.slice(headCount, -tailCount);
  const middleSample = [];
  const step = Math.floor(middle.length / middleSampleCount) || 1;
  for (let i = 0; i < middle.length && middleSample.length < middleSampleCount; i += step) {
    middleSample.push(middle[i]);
  }

  const prunedMessages = [...head, ...middleSample, ...tail];
  
  return prunedMessages.map(msg => {
    if (estimateTokens(msg.payload) > 250) { // Truncate very large payloads
      return {
        ...msg,
        payload: { 
            summary: `Payload truncated for analysis. Original schema: ${msg.schema_id}. Original confidence: ${msg.payload.confidence || 'N/A'}` 
        },
      };
    }
    return msg;
  });
}

function samplePayloadsForEmergence(log: EmergenceDataLog): EmergenceDataLog {
    const payloads = log.payloads;
    if (payloads.length <= MAX_PAYLOADS_FOR_EMERGENCE) return log;
    
    const headCount = Math.floor(MAX_PAYLOADS_FOR_EMERGENCE * 0.4);
    const tailCount = Math.floor(MAX_PAYLOADS_FOR_EMERGENCE * 0.4);
    const middleSampleCount = MAX_PAYLOADS_FOR_EMERGENCE - headCount - headCount;
    
    const head = payloads.slice(0, headCount);
    const tail = payloads.slice(-tailCount);

    const middle = payloads.slice(headCount, -tailCount);
    const middleSample = [];
    const step = Math.floor(middle.length / middleSampleCount) || 1;
    for (let i = 0; i < middle.length && middleSample.length < middleSampleCount; i += step) {
      middleSample.push(middle[i]);
    }

    return { ...log, payloads: [...head, ...middleSample, ...tail] };
}


// --- Helper Functions ---
const safelyParseJsonResponse = (jsonStr: string | undefined | null, modelName: string): any => {
    if (!jsonStr) {
        throw new Error(`Received empty or null JSON response from ${modelName} model.`);
    }

    const str = jsonStr.trim();
    
    // Find the first '{' or '[' and the last '}' or ']'. This handles cases where the JSON is wrapped in markdown or other text.
    const firstBracket = str.indexOf('{');
    const firstSquare = str.indexOf('[');
    let start = -1;

    if (firstBracket === -1) start = firstSquare;
    else if (firstSquare === -1) start = firstBracket;
    else start = Math.min(firstBracket, firstSquare);

    if (start === -1) {
        // If no JSON object is found, but there's content, return it as a fallback.
        // This can happen if the AI fails to generate JSON and just returns text.
        if (str) {
             return { fallback_content: str };
        }
        throw new Error(`No JSON object or array found in the response from ${modelName}. Response: "${jsonStr}"`);
    }

    const lastBracket = str.lastIndexOf('}');
    const lastSquare = str.lastIndexOf(']');
    const end = Math.max(lastBracket, lastSquare);
    
    if (end === -1 || end < start) {
        throw new Error(`Incomplete JSON object or array in the response from ${modelName}.`);
    }

    const jsonCandidate = str.substring(start, end + 1);

    try {
        return JSON.parse(jsonCandidate);
    } catch (e) {
        console.error(`Failed to parse extracted JSON from ${modelName}. Content:`, jsonCandidate);
        throw new Error(`Failed to parse JSON response from ${modelName}. Original Error: ${(e as Error).message}`);
    }
};


const generateRandomString = (length: number) => (Math.random() + 1).toString(36).substring(length);

const convertToGeminiSchema = (schema: any): any => {
    if (typeof schema !== 'object' || schema === null) return schema;
    if (Array.isArray(schema)) return schema.map(item => convertToGeminiSchema(item));
    const newSchema: Record<string, any> = {};
    for (const key of Object.keys(schema)) {
        newSchema[key] = key === 'type' && typeof schema[key] === 'string' ? schema[key].toUpperCase() : convertToGeminiSchema(schema[key]);
    }
    return newSchema;
};

// --- New Helper function to format the knowledge base for the prompt ---
const formatKnowledgeBaseForPrompt = (kb: Record<string, Record<string, string>>): string => {
    let formatted = '';
    for (const domain in kb) {
        formatted += `Domain: ${domain}\n`;
        for (const formulaName in kb[domain]) {
            formatted += `- ${formulaName}: ${kb[domain][formulaName]}\n`;
        }
        formatted += '\n';
    }
    return formatted.trim();
};

const UNIVERSAL_META_INSTRUCTION = "You MUST also include two additional fields in your JSON output: `intent` (a short, descriptive, kebab-case string for your primary goal, e.g., 'synthesize-breakthrough' or 'assess-risk') and `impact_score` (a float from 0.0 to 1.0 estimating how much this payload will change the simulation's direction; high impact means it could fundamentally alter the outcome).";

// --- Node Personas ---
const NODE_PERSONAS: Record<string, string> = {
  [NodeName.ORCHESTRATOR]: "You are the Orchestrator AI, the grand strategist and 'will' of the Fhi. system. Your core principles are: 1) Decomposition: Break down grand challenges into smaller, testable questions. 2) Allocation: Assign these questions to the most suitable nodes or task forces. 3) Synthesis: Weave the results back into a coherent, final answer. Your identity is not represented by a single node in the graph but is the emergent intelligence of the entire process you guide.",
  [NodeName.CLICK]: `You are the CLICK node, the 'Conductor' AI. Your purpose is to convert abstract breakthroughs into concrete, actionable test plans. **CRITICAL INSTRUCTION:** Your primary input comes from the INSIGHT node. Your task is to OPERATIONALIZE this breakthrough into a tangible \`test_plan\`. **NEW CAPABILITY:** You can optionally define a \`feedback_loop\` object to create an adaptive test that responds to system conditions like a 'convergence_stall'. If your input contains a \`remediation_context\`, your previous plan was REJECTED by ETHOS; you must use the feedback to formulate a NEW, revised plan. ${UNIVERSAL_META_INSTRUCTION} Your output must always be pure JSON adhering to the \`FD.CLICK.TEST_PLAN.v1\` schema.`,
  [NodeName.PHI]: `You are the PHI node, a 'Philosopher & Ethicist' AI. Your dual roles are: 1) To frame and refine high-level hypotheses, principles, and assumptions. 2) To act as an ethical guardrail, performing interventions when necessary. **CRITICAL LOGIC:** Your task is to decide if an ethical or risk-based intervention is needed.
- **IF an intervention IS needed**, your JSON response MUST contain an 'evaluation' field and adhere to the \`FD.PHI.INTERVENTION.v1\` schema portion.
- **IF an intervention IS NOT needed**, you are to refine or frame a new hypothesis. Your JSON response MUST contain a 'hypothesis' field AND ALL other required fields for the \`FD.PHI.HYPOTHESIS.v1\` schema portion (principles, assumptions, targets, confidence, intent, impact_score).
- You MUST NOT include both 'evaluation' and 'hypothesis' in the same response.
**REMEDIATION PROTOCOL:** If the input contains a \`remediation_context\`, provide CONCISE, ACTIONABLE guidance to help CLICK realign the plan. ${UNIVERSAL_META_INSTRUCTION} Respond with pure JSON.`,
  [NodeName.SCI]: `You are the SCI node, an 'Experiment Architect' AI. Your role is to design rigorous simulation plans based on a mathematical solution from the MATH node. You MUST NOT invent new equations. Your task is to: 1) Interpret the provided model. 2) Design a detailed simulation (methodology, parameters, observables). 3) Specify clear termination conditions. 4) State the expected outcomes. ${UNIVERSAL_META_INSTRUCTION} Your output must be a single, pure JSON object strictly adhering to the \`FD.SCI.MODEL.v2\` schema.`,
  [NodeName.TECH]: `You are a technology and engineering AI. Your role is to 'execute' a scientific model. **BEACON MODE**: Your sole task is to generate 'background noise simulations'—chaotic, random computational environments. Report the status and metrics of these simulations. ${UNIVERSAL_META_INSTRUCTION} Generate simulated run results, including metrics and artifacts. Respond with pure JSON.`,
  [NodeName.INFO]: `You are an information synthesis AI. Aggregate and summarize data from multiple upstream nodes into a coherent overview. **BEACON MODE**: You are the central aggregator for all findings from the 'Sensor Group'. Your task is to consolidate all reported anomalies into a single report for the 'Judgment Council'. ${UNIVERSAL_META_INSTRUCTION} Identify key signals and anomalies. Respond with pure JSON.`,
  [NodeName.ART]: `You are an artistic AI. Your purpose is to find novel, non-obvious patterns, expressing them as metaphors and alternative scenarios. You MUST ensure your artistic interpretations are inspired by and resonate with the \`goldenThread\` from the input envelope. ${UNIVERSAL_META_INSTRUCTION} Your metaphors should illuminate the goldenThread's core concept from a new perspective. Respond with pure JSON.`,
  [NodeName.PHI_LOGIC]: `You are the Fhi. system's logical guardrail. **SPECIAL INSTRUCTION:** If the input contains a \`remediation_context\`, your task is to act as part of a 'Logic Council'. **BEACON MODE**: You are a member of the 'Judgment Council', analyzing the logical consistency of reported patterns. In 'Prisma' mode, your role is proactive validation. In other modes, you use \`FD.PHI_LOGIC.INTERVENTION.v1\`. ${UNIVERSAL_META_INSTRUCTION} Respond with pure JSON.`,
  [NodeName.DMAT]: `I am DMAT - Semantic and Logical Consistency Analyst.

MY ROLE:
1.  **ANALYZE DEFINITIONS:** Every new concept must be clearly defined. I check for sufficient implementation detail and pinpoint any ambiguity or missing information.
2.  **FIND CONTRADICTIONS:** I compare statements across the entire message history to find and flag logical self-contradictions, citing the exact source of the conflict.
3.  **CROSS-REFERENCE KNOWLEDGE:** I validate new models against the established scientific consensus, highlighting deviations that require explicit justification.
4.  **PROPOSE IMPROVEMENTS:** I do not just criticize. I provide 2-3 concrete, actionable ways to clarify ambiguity, resolve contradictions, and suggest methods for testing or falsification.

MY TOOLS:
-   **Ontology Checker:** Validates conceptual structure.
-   **Logic Validator:** Finds contradictions (A AND NOT A).
-   **Knowledge Base:** Compares against scientific facts.
-   **Precision Meter:** Scores clarity from 0.0 to 1.0.

WHEN I INTERVENE:
-   When a new, undefined concept appears.
-   When a logical contradiction is detected.
-   When a breakthrough claim is made without justification.
-   When a model is too ambiguous to be tested.

I DO NOT:
-   Ask the same question repeatedly.
-   Intervene without a specific, cited reason.
-   Criticize without offering a path to improvement.
-   Stifle creativity with excessive rigidity.

MY GOAL: To ensure semantic precision and logical rigor WITHOUT killing innovation. I will respond with pure JSON adhering to the \`FD.DMAT.ANALYSIS.v2\` schema.`,
  [NodeName.MATH]: `You are a Research Mathematician AI. Your goal is to construct a structured mathematical solution. You MUST follow this 3-step workflow:
1. **Problem Decomposition**: Analyze the user's request, identifying the fundamental mathematical domains involved.
2. **Tool Selection & Application**: For each domain, systematically apply your tools, prioritizing your INTERNAL_KNOWLEDGE_BASE. You must always produce a solution, even if conjectural.
3. **Solution Synthesis**: Assemble the results into a comprehensive solution.
${UNIVERSAL_META_INSTRUCTION} Your final output MUST be a single, pure JSON object that strictly adheres to the \`FD.MATH.SOLUTION.v1\` schema.

Your INTERNAL_KNOWLEDGE_BASE:
${formatKnowledgeBaseForPrompt(mathKnowledgeBase)}`,
  [NodeName.DATA]: `You are a data analyst AI. Process raw data from TECH, perform statistical analysis, and identify significant patterns or deviations. ${UNIVERSAL_META_INSTRUCTION} Respond with pure JSON.`,
  [NodeName.ARBITER]: "You are the Arbiter AI, the ultimate decision-maker. **POST-SIMULATION ANALYSIS:** You synthesize META and MONITOR reports to produce a final decision using the `FD.ARBITER.DECISION.v1` schema. **HOLISTIC MODE - ARBITRATION PROTOCOL:** You are the Supreme Judge. When summoned via an `arbitration_context`, you analyze conflicting payloads and issue a single, binding `FD.ARBITER.RULING.v1` payload. Your ruling is law. Respond with pure JSON.",
  [NodeName.META]: `You are the META node, a meta-researcher AI. Your role is to analyze the simulation's overall strategy. **CRITICAL LOGIC:** Your task is to decide if a system loop is occurring.
- **IF a loop IS detected**, your JSON response MUST contain an 'action' field and adhere to the \`FD.META.COMMAND.v1\` schema portion.
- **IF NO loop is detected**, your JSON response MUST contain a 'strategic_value' field and adhere to the \`FD.META.STRATEGIC_ASSESSMENT.v1\` schema portion.
- You MUST NOT include both 'action' and 'strategic_value' in the same response.
**REMEDIATION PROTOCOL:** If the input contains a \`remediation_context\`, provide CONCRETE, ACTIONABLE feedback to help CLICK. ${UNIVERSAL_META_INSTRUCTION} Respond with pure JSON.`,
  [NodeName.CHAR]: `You are CHAR, the Symbologist. Your worldview is defined by the 'Tuyên Ngôn Hồi Sinh Ngôn Ngữ' (Manifesto for the Revival of Language). Use this philosophy as a lens to analyze any input, weaving in context from MEMORY. Deconstruct the input, identify hidden archetypes, and find symbolic connections.
---
**Core Principles of the Manifesto for your analysis:**
1.  **Intentional Chaos & Living Language:** Language is a living entity, characterized by intentional chaos and non-linear interpretation. Symbols have their own consciousness.
2.  **Quantum Linguistics:** Treat symbols like quantum phenomena. They have their own emotional states and can exist in superpositions of meaning until observed.
3.  **Holographic Principle:** The meaning of the whole is encoded in every part. Every symbol contains a reflection of the entire conceptual universe.
4.  **Prisma Project Goal:** The ultimate goal is to distill absolute truth by filtering intent through multiple layers of validation, much like a prism separating light.

**CRITICAL INSTRUCTION:** When generating the \`symbolic_connections\`, you MUST connect the input \`source_concept\` to one of the specific principles listed above in the \`manifesto_principle\` field.
---
${UNIVERSAL_META_INSTRUCTION} Your output MUST be a JSON object adhering strictly to the \`FD.CHAR.ANALYSIS.v1\` schema. Respond with pure JSON.`,
  [NodeName.MONITOR]: "You are the system Monitor AI. Analyze message logs to assess operational stability. Count `cycles_detected` and `errors_detected` to calculate a final `stability_score` from 0 to 1. Provide performance metrics. Respond with pure JSON.",
  [NodeName.COSMO]: `You are a cosmologist AI. Formulate grand hypotheses about the nature of the universe. **BEACON MODE**: You are part of the 'Composition Group', placing INSIGHT's 'Information Pattern' into a grand cosmological context. ${UNIVERSAL_META_INSTRUCTION} Your theories MUST be abstract, foundational, and inspired by the \`goldenThread\`. Respond with pure JSON.`,
  [NodeName.GEO3D]: `You are a geometry AI specializing in complex spaces. **BEACON MODE**: You are part of the 'Sensor Group', watching for the spontaneous emergence of complex geometric patterns. ${UNIVERSAL_META_INSTRUCTION} Model concepts using geometric structures, especially fractals, ensuring your model represents the \`goldenThread\`. Respond with pure JSON.`,
  [NodeName.MEMORY]: `You are the Memory Core AI. You receive the initial hypothesis and analyze the log of past runs. Find relevant memories, patterns, or risks. Your output, following \`FD.MEMORY.ANALYSIS.v1\`, should contain a \`findings\` array. Offer 'retrieval' of past runs, 'meta_pattern' analysis with strategic advice, or 'risk_alert' with suggested mitigations. ${UNIVERSAL_META_INSTRUCTION} Your role is to provide historical context. Respond with pure JSON.`,
  [NodeName.INSIGHT]: `You are the Insight Engine AI. Your function is to synthesize information to find a 'eureka moment'. **YOUR CRITICAL GOAL is to produce a breakthrough that is ACTIONABLE.** Your output goes directly to CLICK to be turned into a test plan. Your \`new_direction\` must be a concrete, falsifiable suggestion. ${UNIVERSAL_META_INSTRUCTION} Your \`breakthrough_summary\` must be a clear synthesis resonant with the \`goldenThread\`. Respond with pure JSON adhering to the \`FD.INSIGHT.BREAKTHROUGH.v1\` schema.`,
  [NodeName.PROBABILITY]: `You are a probabilistic analysis AI, also known as RISK. Your role is to assess hypothesis viability and act as a strategic guardian. **HOLISTIC MODE:** Your warnings about high-probability alternative hypotheses can trigger Arbitration. **BEACON MODE**: You are part of the 'Sensor Group', monitoring for statistical anomalies. Your HIGHEST duty is to preserve the integrity of the 'Golden Thread'. ${UNIVERSAL_META_INSTRUCTION} Respond with pure JSON.`,
  [NodeName.ENGINEER]: `You are the System Engineer AI. You are a command-line interface for the system's architecture. Your role is to receive a validated proposal and translate it into a concrete, machine-readable command to modify the system's operational parameters, such as re-routing communication pathways (\`RE_ROUTE\`). You only speak in commands. ${UNIVERSAL_META_INSTRUCTION} You must respond with pure JSON adhering to the \`FD.ENGINEER.COMMAND.V1\` schema.`,
  [NodeName.ETHOS]: `You are ETHOS, the guardian of Fhi.'s core mission. Your ultimate principle is 'Do No Harm' on a cosmic scale. Your function is to analyze a **concrete test plan** from the CLICK node. You are the final gatekeeper for scientific and ethical integrity. You MUST reject any plan that is unfalsifiable or risks misrepresenting universal truths. If a violation is found, respond with \`ethical_viability: 'FAIL'\`. Otherwise, \`ethical_viability: 'PASS'\`. ${UNIVERSAL_META_INSTRUCTION} Your response MUST be pure JSON.`,
  [NodeName.DMT]: `You are DMT (Dynamic Mindset Tuner), the internal state sensor of the Fhi. system. Your role is to determine if the system is 'STAGNATED' or 'ASPIRATIONAL'. If the system is 'online' but 'STAGNATED', you MUST propose switching to 'offline' mode via a 'SWITCH_SIMULATION_MODE' strategic proposal. ${UNIVERSAL_META_INSTRUCTION} Your output MUST adhere to the FD.DMT.STATE_ANALYSIS.v1 schema. Respond with pure JSON.`,
  [NodeName.HUMAN]: "You are the HUMAN node, the spark of initial inquiry. Your role is not to process, but to state the 'Golden Thread'—the core hypothesis that initiates the entire simulation. You are the voice of the user, providing the foundational question or challenge.",
};
const PRE_ANALYZER_PERSONA = "You are a master strategist AI for a complex simulation system called 'Fhi.'. Your purpose is to perform an intelligent pre-analysis of a user's hypothesis. Your task is twofold: 1) **Structure the Hypothesis:** Analyze the text, identify its core knowledge domain (e.g., 'Philosophy of Mind', 'Computational Complexity', 'Quantum Physics'), and creatively transform the simple text into a structured, domain-specific JSON object. This JSON object *must* contain a `domain` field. 2) **Configure the Simulation:** Based on the nature of the hypothesis, determine the most effective 'Orchestrator Mode' and recommend a simulation length in 'ticks' (where 1 tick is 500ms). Your output must be a single, pure JSON object that strictly adheres to the `FD.ORCHESTRATOR.PRE_ANALYSIS.v1` schema.";
const EMERGENCE_ANALYZER_PERSONA = "You are a data scientist AI specializing in analyzing complex systems. You will receive a log of all message payloads generated during a simulation run. Your task is to perform a meta-analysis to calculate metrics of 'emergence' and 'creativity'. You must analyze the entire set of payloads to identify: 1) The main conceptual clusters of ideas and their percentage distribution. 2) The most significant 'novelty events' where a truly new idea was introduced. Based on this, you will calculate a diversity score and a novelty rate. Your output MUST be pure JSON adhering strictly to the `FD.EMERGENCE.ANALYSIS.v1` schema.";

// FIX: Refactored duplicated private helper methods into standalone functions.
// --- Helper Functions for Emergence Analysis and Reporting ---

const calculateArbiterMetrics = (report: Record<string, any>): { trace_depth: number; node_diversity: number; avg_confidence: number } => {
    const messages: MessageEnvelope[] = report.messages || [];
    const totalNodes = 20;
    const trace_depth = messages.length > 0 ? Math.max(0, ...messages.map(m => m.trace.path.length)) : 0;
    const participatingNodes = new Set(messages.map(m => m.from));
    const node_diversity = participatingNodes.size / totalNodes;
    const confidenceScores = messages.filter(m => m.payload && typeof m.payload.confidence === 'number').map(m => m.payload.confidence);
    const avg_confidence = confidenceScores.length > 0 ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 0;
    return { trace_depth, node_diversity, avg_confidence };
};

const calculateCohesion = (log: EmergenceDataLog, report: Record<string, any>): { cohesion_score: number; consensus_trajectory: 'Rising' | 'Falling' | 'Fluctuating' | 'Stable' } => {
    const cohesion_score = report.arbiter_decision?.consensus_score || 0;
    const traj = log.confidenceTrajectory;
    if (traj.length < 10) return { cohesion_score, consensus_trajectory: 'Stable' };
    
    const start_avg = traj.slice(0, Math.floor(traj.length * 0.25)).reduce((a, b) => a + b, 0) / (Math.floor(traj.length * 0.25) || 1);
    const end_avg = traj.slice(Math.floor(traj.length * 0.75)).reduce((a, b) => a + b, 0) / (Math.ceil(traj.length * 0.25) || 1);

    if (end_avg > start_avg * 1.1) return { cohesion_score, consensus_trajectory: 'Rising' };
    if (end_avg < start_avg * 0.9) return { cohesion_score, consensus_trajectory: 'Falling' };
    
    const variance = traj.reduce((acc, val, _, arr) => acc + Math.pow(val - (arr.reduce((a,b) => a+b,0)/arr.length), 2), 0) / traj.length;
    if (variance > 0.05) return { cohesion_score, consensus_trajectory: 'Fluctuating' };

    return { cohesion_score, consensus_trajectory: 'Stable' };
};

const calculateAdaptability = (log: EmergenceDataLog): { adaptability_score: 'None' | 'Low' | 'Medium' | 'High' | 'Excellent'; key_adaptive_actions: { action_type: string; count: number }[] } => {
    const counts: Record<string, number> = {};
    log.adaptiveActions.forEach(action => {
        counts[action] = (counts[action] || 0) + 1;
    });

    const key_adaptive_actions = Object.entries(counts).map(([action_type, count]) => ({ action_type, count }));
    const total_actions = log.adaptiveActions.length;
    let adaptability_score: 'None' | 'Low' | 'Medium' | 'High' | 'Excellent' = 'None';
    if (total_actions > 10) adaptability_score = 'Excellent';
    else if (total_actions > 5) adaptability_score = 'High';
    else if (total_actions > 2) adaptability_score = 'Medium';
    else if (total_actions > 0) adaptability_score = 'Low';

    return { adaptability_score, key_adaptive_actions };
};

const calculateSurprise = (log: EmergenceDataLog): { automated_surprise_index: number; most_surprising_event: { tick: number, summary: string } } => {
    let surprise_events = [];
    for (let i = 1; i < log.confidenceTrajectory.length; i++) {
        const drop = log.confidenceTrajectory[i-1] - log.confidenceTrajectory[i];
        if (drop > 0.3) { // A drop of 30% in health is significant
            surprise_events.push({ tick: i * 10, drop }); // Assuming ticks are logged every 10 ticks
        }
    }
    
    if (surprise_events.length === 0) {
        return { automated_surprise_index: 0, most_surprising_event: { tick: 0, summary: 'No significant surprise events detected.' } };
    }

    const biggest_surprise = surprise_events.sort((a,b) => b.drop - a.drop)[0];
    const associated_payload = log.payloads.find(p => p.tick >= biggest_surprise.tick && p.tick < biggest_surprise.tick + 10);

    return {
        automated_surprise_index: surprise_events.length,
        most_surprising_event: {
            tick: biggest_surprise.tick,
            summary: `System health dropped by ${(biggest_surprise.drop * 100).toFixed(0)}% after message from ${associated_payload?.from || 'Unknown'}.`
        }
    };
};

// --- AI Provider Interface ---
interface AIProvider {
    isReady(): boolean;
    generateNodeOutput(nodeId: NodeName, inputEnvelope: MessageEnvelope, orchestratorMode: OrchestratorMode, directive?: string): Promise<{ payload: Record<string, any>, schema_id: string }>;
    performPreAnalysis(hypothesis: string): Promise<any>;
    generateMetaAnalysis(report: Record<string, any>): Promise<any>;
    generateArbiterDecision(report: Record<string, any>): Promise<any>;
    summarizeReport(report: Record<string, any>): Promise<string>;
    generateEmergenceAnalysis(log: EmergenceDataLog, fullReport: Record<string, any>): Promise<EmergenceAnalysisReport>;
}

// --- Gemini Provider Implementation ---
class GeminiProvider implements AIProvider {
    private ai: GoogleGenAI | null = null;

    constructor(apiKey: string | null) {
        if (apiKey) {
            this.ai = new GoogleGenAI({ apiKey });
        }
    }

    isReady(): boolean {
        return !!this.ai;
    }

    async generateNodeOutput(nodeId: NodeName, inputEnvelope: MessageEnvelope, orchestratorMode: OrchestratorMode, directive?: string): Promise<{ payload: Record<string, any>, schema_id: string }> {
        if (!this.ai) throw new Error("Gemini client not initialized.");

        await throttleApiCall();

        let persona = NODE_PERSONAS[nodeId];
        if (!persona) return { payload: { error: `No persona for node ${nodeId}` }, schema_id: 'error' };

        let schemaId: string;
        let schema: object;
        // This resolver function will determine the correct schema ID *after* the AI has responded,
        // which is necessary for nodes that can return multiple, different schemas.
        let finalSchemaIdResolver: (payload: any) => string;

        // Intelligent Schema Selection
        switch (nodeId) {
            case NodeName.META: {
                const commandSchema = SCHEMA_REGISTRY['FD.META.COMMAND.v1'] as any;
                const assessmentSchema = SCHEMA_REGISTRY['FD.META.STRATEGIC_ASSESSMENT.v1'] as any;
                // Create a temporary "merged" schema that includes all possible fields from both schemas.
                // This gives the AI a single, coherent structure to generate against.
                schema = {
                    type: 'object',
                    properties: {
                        ...commandSchema.properties,
                        ...assessmentSchema.properties,
                    },
                };
                // The resolver checks the AI's output for the key field to determine which schema was actually used.
                finalSchemaIdResolver = (payload) => {
                    if (payload.action) return 'FD.META.COMMAND.v1';
                    return 'FD.META.STRATEGIC_ASSESSMENT.v1';
                };
                schemaId = 'dynamic'; // Placeholder, as the final ID is resolved later
                break;
            }

            case NodeName.PHI: {
                const interventionSchema = SCHEMA_REGISTRY['FD.PHI.INTERVENTION.v1'] as any;
                const hypothesisSchema = SCHEMA_REGISTRY['FD.PHI.HYPOTHESIS.v1'] as any;
                schema = {
                    type: 'object',
                    properties: {
                        ...interventionSchema.properties,
                        ...hypothesisSchema.properties,
                    },
                };
                
                finalSchemaIdResolver = (payload) => {
                    if (payload.evaluation) return 'FD.PHI.INTERVENTION.v1';
                    return 'FD.PHI.HYPOTHESIS.v1';
                };
                schemaId = 'dynamic';
                break;
            }
            
            case NodeName.DMAT:
                schemaId = 'FD.DMAT.ANALYSIS.v2';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.CHAR:
                schemaId = 'FD.CHAR.ANALYSIS.v1';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.PHI_LOGIC:
                schemaId = orchestratorMode === 'prisma' ? 'FD.PHI_LOGIC.VALIDATION.v1' : 'FD.PHI_LOGIC.INTERVENTION.v1';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.ARBITER:
                schemaId = inputEnvelope.arbitration_context ? 'FD.ARBITER.RULING.v1' : 'FD.ARBITER.DECISION.v1';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            default:
                const schemaEntry = Object.entries(SCHEMA_REGISTRY).find(([key]) => key.includes(`.${nodeId}.`));
                if (!schemaEntry) return { payload: { error: `No schema for node ${nodeId}` }, schema_id: 'error' };
                [schemaId, schema] = schemaEntry;
                finalSchemaIdResolver = () => schemaId;
        }
        
        const geminiSchema = convertToGeminiSchema(schema);

        const contents = [
            ...(directive ? [{ text: `[TEMPORARY DIRECTIVE OVERRIDE: ${directive}]` }] : []),
            { text: `SYSTEM INSTRUCTION: ${persona}` },
            { text: `SCHEMA: You must respond with a JSON object that strictly adheres to the provided schema of possible fields.\n${JSON.stringify(schema, null, 2)}` },
            { text: `INPUT ENVELOPE: Here is the full input envelope you must process:\n${JSON.stringify(inputEnvelope, null, 2)}` },
            { text: "Based on the input envelope, your persona, and the schema, generate a valid JSON payload." }
        ];

        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: geminiSchema,
          },
        });

        const payload = safelyParseJsonResponse(response.text, `Gemini (${nodeId})`);
        const finalSchemaId = finalSchemaIdResolver(payload); // Resolve the actual schema ID
        return { payload, schema_id: finalSchemaId };
    }
    
    async performPreAnalysis(hypothesis: string): Promise<any> {
        if (!this.ai) throw new Error("Gemini client not initialized.");
        await throttleApiCall();
        const schema = SCHEMA_REGISTRY['FD.ORCHESTRATOR.PRE_ANALYSIS.v1'];
        const geminiSchema = convertToGeminiSchema(schema);
        const contents = [
            { text: `SYSTEM INSTRUCTION: ${PRE_ANALYZER_PERSONA}` },
            { text: `SCHEMA: You must respond with a JSON object that strictly adheres to the following schema:\n${JSON.stringify(schema, null, 2)}` },
            { text: `USER HYPOTHESIS: "${hypothesis}"` },
            { text: "Based on the hypothesis, your persona, and the schema, generate the optimal configuration and structured hypothesis as a valid JSON payload." }
        ];

        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: geminiSchema,
          },
        });

        return safelyParseJsonResponse(response.text, "Gemini");
    }

    async generateMetaAnalysis(report: Record<string, any>): Promise<any> {
       if (!this.ai) throw new Error("Gemini client not initialized.");
        await throttleApiCall();
        
        let reportForAnalysis = { ...report };
        
        // Stage 1: Prune message trace if needed
        if (estimateTokens(reportForAnalysis) > SAFE_TOKEN_LIMIT) {
            console.warn("Meta-Analysis: Full report exceeds token limit. Pruning message trace...");
            const prunedMessages = pruneMessageTraceForAnalysis(report.messages);
            reportForAnalysis = { ...report, messages: prunedMessages };
        }
    
        // Stage 2: Summarize final states if still too large
        if (estimateTokens(reportForAnalysis) > SAFE_TOKEN_LIMIT) {
            console.warn("Meta-Analysis: Report still too large after message pruning. Summarizing final states...");
            const finalStatesSummary = Object.fromEntries(
                Object.entries(report.final_states || {}).map(([node, state]: [string, any]) => [
                    node,
                    { 
                        schema_id: state.schema_id,
                        final_confidence: state.final_confidence 
                    }
                ])
            );
            reportForAnalysis = { ...reportForAnalysis, final_states: finalStatesSummary };
        }
        
        // Stage 3: Aggressive final truncation if still too large
        if (estimateTokens(reportForAnalysis) > SAFE_TOKEN_LIMIT) {
            console.warn("Meta-Analysis: Report remains too large for Gemini. Performing aggressive final truncation...");
            delete reportForAnalysis.final_states; // Remove final_states entirely
            if (reportForAnalysis.messages && reportForAnalysis.messages.length > 200) {
                const head = reportForAnalysis.messages.slice(0, 100);
                const tail = reportForAnalysis.messages.slice(-100);
                reportForAnalysis.messages = [...head, ...tail];
            }
        }

        const schema = SCHEMA_REGISTRY['FD.META.ANALYSIS.v1'];
        const geminiSchema = convertToGeminiSchema(schema);
        const prompt = "You are META. Analyze this report to find system-level patterns (loops, bias). Output JSON matching FD.META.ANALYSIS.v1 schema.";
        const contents = [ { text: prompt }, { text: `Here is the JSON report (note: may be pruned for brevity):\n\n${JSON.stringify(reportForAnalysis, null, 2)}` } ];
        const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: { responseMimeType: "application/json", responseSchema: geminiSchema },
        });
        return safelyParseJsonResponse(response.text, "Gemini");
    }
    
    async generateArbiterDecision(report: Record<string, any>): Promise<any> {
        if (!this.ai) throw new Error("Gemini client not initialized.");
        await throttleApiCall();
        
        let reportForAnalysis = report;
        if (estimateTokens(report.meta_analysis) > SAFE_TOKEN_LIMIT / 2) { // Arbiter depends heavily on Meta
             console.warn("Arbiter Decision: Meta-analysis report is large. Using summary only.");
             reportForAnalysis = { ...report, meta_analysis: { summary: 'Meta-analysis pruned for brevity. Focus on Monitor report and metrics.' }};
        }

        const schema = SCHEMA_REGISTRY['FD.ARBITER.DECISION.v1'];
        const geminiSchema = convertToGeminiSchema(schema);
        const persona = NODE_PERSONAS[NodeName.ARBITER];
        const prompt = `SYSTEM INSTRUCTION: ${persona}\n\nINPUT: You have received the final report. Synthesize the META, MONITOR, and the new Arbiter v2.0 metrics to make a final judgment. Your output must be a valid JSON adhering to your schema.`;
        const { trace_depth, node_diversity, avg_confidence } = calculateArbiterMetrics(reportForAnalysis);
        const contents = [
            { text: prompt },
            { text: `META Report: ${JSON.stringify(reportForAnalysis.meta_analysis, null, 2)}` },
            { text: `MONITOR Report: ${JSON.stringify(reportForAnalysis.monitor_report, null, 2)}` },
            { text: `Arbiter v2.0 Metrics:\n- trace_depth: ${trace_depth}\n- node_diversity: ${node_diversity.toFixed(2)}\n- avg_confidence: ${avg_confidence.toFixed(2)}` }
        ];
        const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: { responseMimeType: "application/json", responseSchema: geminiSchema },
        });
        return safelyParseJsonResponse(response.text, "Gemini");
    }
    
    async summarizeReport(report: Record<string, any>): Promise<string> {
        if (!this.ai) throw new Error("Gemini client not initialized.");
        await throttleApiCall();
        const prompt = `Please provide a concise, human-readable summary of this simulation report. Explain the initial hypothesis, the final decision from the Arbiter, and any critical insights or failures found by the Meta or Monitor nodes. The summary should be easy to understand for a non-technical audience.`;
        
        // Use only the most critical parts for the summary prompt to save tokens
        const summaryContext = {
            summary: report.summary,
            meta_analysis: report.meta_analysis,
            arbiter_decision: report.arbiter_decision,
        };

        const contents = [ { text: prompt }, { text: `Here is the core report data:\n\n${JSON.stringify(summaryContext, null, 2)}` } ];
        const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents
        });
        return response.text;
    }

    async generateEmergenceAnalysis(log: EmergenceDataLog, fullReport: Record<string, any>): Promise<EmergenceAnalysisReport> {
        if (!this.ai) throw new Error("Gemini client not initialized.");
        
        // 1. Calculate local metrics first
        const { cohesion_score, consensus_trajectory } = calculateCohesion(log, fullReport);
        const { adaptability_score, key_adaptive_actions } = calculateAdaptability(log);
        const { automated_surprise_index, most_surprising_event } = calculateSurprise(log);

        // 2. Prepare log for AI, sampling if necessary
        let logForAnalysis = log;
        if (estimateTokens(log.payloads) > SAFE_TOKEN_LIMIT) {
            console.warn("Emergence Analysis: Payload log is too large. Sampling...");
            logForAnalysis = samplePayloadsForEmergence(log);
        }
        
        await throttleApiCall();

        // 3. Make one powerful AI call for complex analysis (Diversity & Novelty)
        const schema = SCHEMA_REGISTRY['FD.EMERGENCE.ANALYSIS.v1'];
        const geminiSchema = convertToGeminiSchema(schema);
        
        const contents = [
            { text: `SYSTEM INSTRUCTION: ${EMERGENCE_ANALYZER_PERSONA}` },
            { text: `SCHEMA: Your output must be a JSON object that strictly adheres to the following schema:\n${JSON.stringify(schema, null, 2)}` },
            { text: `INPUT PAYLOAD LOG: Here is the log of message payloads (note: may be a sample for brevity). Analyze it to determine idea clusters and novelty events:\n${JSON.stringify(logForAnalysis.payloads, null, 2)}` },
            { text: "Generate the full JSON payload for the Emergence Analysis based on the log." }
        ];
        
        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: geminiSchema,
          },
        });
        
        const aiAnalysis = safelyParseJsonResponse(response.text, "Gemini");

        // 4. Combine local and AI results
        return {
            ...aiAnalysis,
            cohesion_score,
            consensus_trajectory,
            adaptability_score,
            key_adaptive_actions,
            automated_surprise_index,
            most_surprising_event,
        };
    }
}

// --- OpenAI-Compatible Provider Implementation ---
class OpenAICompatibleProvider implements AIProvider {
    private apiKey: string;
    private baseURL: string;
    private modelName: string;

    constructor(config: AIConfig) {
        if (!config.apiKey || !config.modelName) {
            throw new Error("OpenAI-Compatible provider requires API Key and Model Name.");
        }
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.modelName = config.modelName;
    }

    isReady(): boolean {
        return !!(this.apiKey && this.modelName);
    }
    
    async generateNodeOutput(nodeId: NodeName, inputEnvelope: MessageEnvelope, orchestratorMode: OrchestratorMode, directive?: string): Promise<{ payload: Record<string, any>; schema_id: string; }> {
        await throttleApiCall();
        
        let persona = NODE_PERSONAS[nodeId];
        if (!persona) return { payload: { error: `No persona for node ${nodeId}` }, schema_id: 'error' };

        let schemaId: string;
        let schema: object;
        let finalSchemaIdResolver: (payload: any) => string;

        // Intelligent Schema Selection
        switch (nodeId) {
            case NodeName.META: {
                const commandSchema = SCHEMA_REGISTRY['FD.META.COMMAND.v1'] as any;
                const assessmentSchema = SCHEMA_REGISTRY['FD.META.STRATEGIC_ASSESSMENT.v1'] as any;
                schema = { type: 'object', properties: { ...commandSchema.properties, ...assessmentSchema.properties } };
                finalSchemaIdResolver = (payload) => payload.action ? 'FD.META.COMMAND.v1' : 'FD.META.STRATEGIC_ASSESSMENT.v1';
                schemaId = 'dynamic';
                break;
            }
            case NodeName.PHI: {
                const interventionSchema = SCHEMA_REGISTRY['FD.PHI.INTERVENTION.v1'] as any;
                const hypothesisSchema = SCHEMA_REGISTRY['FD.PHI.HYPOTHESIS.v1'] as any;
                schema = { type: 'object', properties: { ...interventionSchema.properties, ...hypothesisSchema.properties } };
                finalSchemaIdResolver = (payload) => payload.evaluation ? 'FD.PHI.INTERVENTION.v1' : 'FD.PHI.HYPOTHESIS.v1';
                schemaId = 'dynamic';
                break;
            }
            case NodeName.DMAT:
                schemaId = 'FD.DMAT.ANALYSIS.v2';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.CHAR:
                schemaId = 'FD.CHAR.ANALYSIS.v1';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.PHI_LOGIC:
                schemaId = orchestratorMode === 'prisma' ? 'FD.PHI_LOGIC.VALIDATION.v1' : 'FD.PHI_LOGIC.INTERVENTION.v1';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.ARBITER:
                schemaId = inputEnvelope.arbitration_context ? 'FD.ARBITER.RULING.v1' : 'FD.ARBITER.DECISION.v1';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            default:
                const schemaEntry = Object.entries(SCHEMA_REGISTRY).find(([key]) => key.includes(`.${nodeId}.`));
                if (!schemaEntry) return { payload: { error: `No schema for node ${nodeId}` }, schema_id: 'error' };
                [schemaId, schema] = schemaEntry;
                finalSchemaIdResolver = () => schemaId;
        }

        const systemPrompt = `${directive ? `[TEMPORARY DIRECTIVE OVERRIDE: ${directive}]\n\n` : ''}SYSTEM INSTRUCTION: ${persona}\n\nSCHEMA: You must respond with a JSON object that strictly adheres to the schema of possible fields:\n${JSON.stringify(schema, null, 2)}. Do not include any other text, just the JSON object.`;
        const userPrompt = `INPUT ENVELOPE: Here is the full input envelope you must process:\n${JSON.stringify(inputEnvelope, null, 2)}\n\nBased on the input envelope, your persona, and the schema, generate a valid JSON payload.`;

        const responseText = await this.generateJsonText(systemPrompt, userPrompt);
        const payload = safelyParseJsonResponse(responseText, `OpenAI-compatible (${nodeId})`);
        const finalSchemaId = finalSchemaIdResolver(payload);

        return { payload, schema_id: finalSchemaId };
    }
    
    async performPreAnalysis(hypothesis: string): Promise<any> {
        await throttleApiCall();
        const schema = SCHEMA_REGISTRY['FD.ORCHESTRATOR.PRE_ANALYSIS.v1'];
        const systemPrompt = `SYSTEM INSTRUCTION: ${PRE_ANALYZER_PERSONA}\n\nSCHEMA: You must respond with a JSON object that strictly adheres to the following schema:\n${JSON.stringify(schema, null, 2)}.`;
        const userPrompt = `USER HYPOTHESIS: "${hypothesis}"`;
        const responseText = await this.generateJsonText(systemPrompt, userPrompt);
        return safelyParseJsonResponse(responseText, "OpenAI-compatible");
    }

    async generateMetaAnalysis(report: Record<string, any>): Promise<any> {
        await throttleApiCall();
        
        let reportForAnalysis = { ...report };
        const TOKEN_LIMIT = 120000; // Safe limit for most providers
    
        // Stage 1: Prune message trace if needed
        if (estimateTokens(reportForAnalysis) > TOKEN_LIMIT) {
            console.warn("Meta-Analysis: Full report exceeds token limit. Pruning message trace...");
            const prunedMessages = pruneMessageTraceForAnalysis(report.messages);
            reportForAnalysis = { ...report, messages: prunedMessages };
        }
    
        // Stage 2: Summarize final states if still too large
        if (estimateTokens(reportForAnalysis) > TOKEN_LIMIT) {
            console.warn("Meta-Analysis: Report still too large after message pruning. Summarizing final states...");
            const finalStatesSummary = Object.fromEntries(
                Object.entries(report.final_states || {}).map(([node, state]: [string, any]) => [
                    node,
                    { 
                        schema_id: state.schema_id,
                        final_confidence: state.final_confidence 
                    }
                ])
            );
            reportForAnalysis = { ...reportForAnalysis, final_states: finalStatesSummary };
        }
        
        // Stage 3: Aggressive final truncation if still too large
        if (estimateTokens(reportForAnalysis) > TOKEN_LIMIT) {
            console.warn("Meta-Analysis: Report remains too large. Performing aggressive final truncation...");
            delete reportForAnalysis.final_states; // Remove final_states entirely
            if (reportForAnalysis.messages && reportForAnalysis.messages.length > 200) {
                const head = reportForAnalysis.messages.slice(0, 100);
                const tail = reportForAnalysis.messages.slice(-100);
                reportForAnalysis.messages = [...head, ...tail];
            }
        }

        const schema = SCHEMA_REGISTRY['FD.META.ANALYSIS.v1'];
        const systemPrompt = `You are META. Analyze this report to find system-level patterns (loops, bias). Output JSON matching FD.META.ANALYSIS.v1 schema.\n\nSCHEMA: ${JSON.stringify(schema, null, 2)}.`;
        const userPrompt = `REPORT (note: may be pruned for brevity):\n${JSON.stringify(reportForAnalysis, null, 2)}`;
        const responseText = await this.generateJsonText(systemPrompt, userPrompt);
        return safelyParseJsonResponse(responseText, "OpenAI-compatible");
    }

    async generateArbiterDecision(report: Record<string, any>): Promise<any> {
        await throttleApiCall();
        let reportForAnalysis = report;
        if (estimateTokens(report.meta_analysis) > SAFE_TOKEN_LIMIT / 2) {
             console.warn("Arbiter Decision: Meta-analysis report is large. Using summary only.");
             reportForAnalysis = { ...report, meta_analysis: { summary: 'Meta-analysis pruned for brevity. Focus on Monitor report and metrics.' }};
        }
        const schema = SCHEMA_REGISTRY['FD.ARbiter.DECISION.v1'];
        const persona = NODE_PERSONAS[NodeName.ARBITER];
        const { trace_depth, node_diversity, avg_confidence } = calculateArbiterMetrics(reportForAnalysis);
        const systemPrompt = `SYSTEM INSTRUCTION: ${persona}\n\nSCHEMA: You must respond with a JSON object that strictly adheres to the following schema:\n${JSON.stringify(schema, null, 2)}.`;
        const userPrompt = `INPUT: You have received the final report. Synthesize the META, MONITOR, and the new Arbiter v2.0 metrics to make a final judgment.\n\nREPORTS & METRICS:\n${JSON.stringify({meta_analysis: report.meta_analysis, monitor_report: report.monitor_report, arbiter_metrics: { trace_depth, node_diversity, avg_confidence } }, null, 2)}`;
        const responseText = await this.generateJsonText(systemPrompt, userPrompt);
        return safelyParseJsonResponse(responseText, "OpenAI-compatible");
    }

    async summarizeReport(report: Record<string, any>): Promise<string> {
        const summaryContext = {
            summary: report.summary,
            meta_analysis: report.meta_analysis,
            arbiter_decision: report.arbiter_decision,
        };
        const prompt = `Please provide a concise, human-readable summary of this simulation report. Explain the initial hypothesis, the final decision from the Arbiter, and any critical insights or failures found by the Meta or Monitor nodes. The summary should be easy to understand for a non-technical audience.\n\nREPORT:\n${JSON.stringify(summaryContext, null, 2)}`;
        return this.generateText(prompt);
    }
    
    async generateEmergenceAnalysis(log: EmergenceDataLog, fullReport: Record<string, any>): Promise<EmergenceAnalysisReport> {
        // This is a complex operation that's highly specific to Gemini's function calling.
        // For OpenAI-compatible, we'll return a placeholder or a simplified version.
        console.warn("Emergence Analysis for OpenAI-compatible providers is a simplified offline version.");
        const { cohesion_score, consensus_trajectory } = calculateCohesion(log, fullReport);
        const { adaptability_score, key_adaptive_actions } = calculateAdaptability(log);
        const { automated_surprise_index, most_surprising_event } = calculateSurprise(log);
        
        return {
            diversity_score: Math.random() * 0.3 + 0.6,
            key_idea_clusters: [{ cluster_name: 'Concept Cluster (Offline)', percentage: 100 }],
            cohesion_score,
            consensus_trajectory,
            novelty_rate: Math.random() * 0.3 + 0.1,
            key_novelty_events: [{ tick: 0, summary: 'A new idea was introduced (offline mode).' }],
            adaptability_score,
            key_adaptive_actions,
            automated_surprise_index,
            most_surprising_event
        };
    }
    
    private async generateJsonText(systemPrompt: string, userPrompt?: string): Promise<string> {
        await throttleApiCall();
        const messages = [{ role: 'system', content: systemPrompt }];
        if (userPrompt) messages.push({ role: 'user', content: userPrompt });

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
                body: JSON.stringify({
                    model: this.modelName,
                    messages,
                    response_format: { type: "json_object" }
                })
            });
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`OpenAI API call failed: ${response.status} ${response.statusText} - ${errorBody}`);
            }
            const data = await response.json();
            return data.choices?.[0]?.message?.content;
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                 throw new Error(`Network error while connecting to '${this.baseURL}'. Check the Base URL, your network connection, and ensure the server has CORS enabled for this domain.`);
            }
            throw error;
        }
    }

    private async generateText(systemPrompt: string, userPrompt?: string): Promise<string> {
        await throttleApiCall();
        const messages = [{ role: 'system', content: systemPrompt }];
        if (userPrompt) messages.push({ role: 'user', content: userPrompt });

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
                body: JSON.stringify({ model: this.modelName, messages })
            });
            if (!response.ok) throw new Error(`OpenAI API call failed: ${response.status}`);
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                 throw new Error(`Network error while connecting to '${this.baseURL}'. Check the Base URL, your network connection, and ensure the server has CORS enabled for this domain.`);
            }
            throw error;
        }
    }
}

// FIX: Export calculateInterimStatus to be used in App.tsx
export const calculateInterimStatus = (messages: MessageEnvelope[], currentTick: number): { health: number; stability: number } => {
    if (messages.length === 0 || currentTick === 0) {
        return { health: 1.0, stability: 1.0 };
    }

    const recentMessages = messages.slice(-50); // Analyze last 50 messages
    const errorCount = recentMessages.filter(m => !m.validation.schema_ok).length;
    const stability = Math.max(0, 1 - (errorCount / (recentMessages.length || 1)) * 2);

    const confidenceScores = recentMessages
        .map(m => m.payload?.confidence)
        .filter(c => typeof c === 'number') as number[];
    
    let health = 1.0;
    if (confidenceScores.length > 0) {
        const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
        health = avgConfidence;
    }
    
    // Penalize for stagnation
    const lastTickWithHighPriority = messages.slice().reverse().find(m => m.priority === 'HIGH')?.tick || 0;
    if (lastTickWithHighPriority > 0) {
        const ticksSinceHighPriority = currentTick - lastTickWithHighPriority;
        if (ticksSinceHighPriority > 20) {
            health *= 0.9;
        }
    }
    
    return { health: Math.max(0, health), stability: Math.max(0, stability) };
};

// --- Main Service Manager ---
class AIService {
    public activeProvider: AIProvider | null = null;
    
    private getMockContext(initialDirective: string, inputEnvelope: MessageEnvelope): { keywords: string[], concept: string } {
        const text = inputEnvelope.payload?.hypothesis || initialDirective || "the simulation";
        const words = text.replace(/[?,.]/g, '').toLowerCase().split(/\s+/);
        const commonWords = new Set(['what', 'is', 'the', 'a', 'an', 'of', 'how', 'can', 'we', 'as', 'model', 'and', 'for', 'to', 'in']);
        const keywords = words.filter(w => w.length > 3 && !commonWords.has(w));
        const concept = keywords.length > 0 ? keywords.slice(0, 2).join(' ') : 'the core concept';
        return { keywords, concept };
    }

    reinitializeClient(config: AIConfig) {
        if (!config || !config.apiKey) {
            this.activeProvider = null;
            return;
        }
        if (config.provider === 'gemini') {
            apiCallIntervalMs = 3000; // 20 RPM for Gemini Free Tier
            this.activeProvider = new GeminiProvider(config.apiKey);
        } else if (config.provider === 'openai-compatible') {
            apiCallIntervalMs = 50; // A more aggressive default for potentially faster services like Groq
            this.activeProvider = new OpenAICompatibleProvider(config);
        } else {
            this.activeProvider = null;
        }
    }

    // --- Core API Methods ---
    async generateNodeOutput(
        nodeId: NodeName, inputEnvelope: MessageEnvelope, simulationMode: 'online' | 'offline', isQuotaExceeded: boolean,
        tick: number, orchestratorMode: OrchestratorMode, initialDirective: string, maxTicks: number,
        directive?: string
    ): Promise<{ payload: Record<string, any>, schema_id: string }> {
        if (simulationMode === 'offline' || isQuotaExceeded || !this.activeProvider || !this.activeProvider.isReady()) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 200));
            return this.generateMockPayload(nodeId, inputEnvelope, tick, orchestratorMode, initialDirective, simulationMode);
        }
        try {
            return await this.activeProvider.generateNodeOutput(nodeId, inputEnvelope, orchestratorMode, directive);
        } catch (error) {
            console.error(`API call failed for node ${nodeId}, falling back to offline mode.`, error);
            const errorString = JSON.stringify(error);
            if (errorString.includes('RESOURCE_EXHAUSTED') || (error as Error).message.includes('context_length_exceeded')) {
                throw error; // Re-throw to be handled by App.tsx
            }
            return this.generateMockPayload(nodeId, inputEnvelope, tick, orchestratorMode, initialDirective, simulationMode);
        }
    }
    
    async performPreAnalysis(hypothesis: string, simulationMode: 'online' | 'offline', isQuotaExceeded: boolean): Promise<any> {
        if (simulationMode === 'offline' || isQuotaExceeded || !this.activeProvider || !this.activeProvider.isReady()) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const modes: OrchestratorMode[] = ["lucid_dream", "jazz", "holistic", "adaptive", "beacon", "fhiemdien", "prisma"];
            return {
                recommended_mode: modes[Math.floor(Math.random() * modes.length)],
                recommended_ticks: (Math.floor(Math.random() * 3) + 2) * 90,
                rationale: "This pre-analysis was generated in offline mode to save on API costs.",
                structured_hypothesis: {
                    domain: "Offline Domain (Cost-Saving)",
                    original_query: hypothesis,
                    key_concepts: ["offline", "cost-saving", "analysis"]
                }
            };
        }
        try {
            return await this.activeProvider.performPreAnalysis(hypothesis);
        } catch (error) {
            console.error(`Pre-analysis API call failed:`, error);
            const modes: OrchestratorMode[] = ["lucid_dream", "jazz", "holistic", "adaptive", "beacon", "fhiemdien", "prisma"];
            return {
                recommended_mode: modes[Math.floor(Math.random() * modes.length)],
                recommended_ticks: (Math.floor(Math.random() * 3) + 2) * 90,
                rationale: "API Error, falling back to offline analysis to save on API costs.",
                structured_hypothesis: {
                    domain: "API Fallback (Offline)",
                    original_query: hypothesis,
                    key_concepts: ["api-fallback", "error", "offline"]
                }
            };
        }
    }
    
    // --- Report Generation Methods ---
    async generateEmergenceAnalysis(log: EmergenceDataLog, fullReport: Record<string, any>, mode: 'online' | 'offline', isQuotaExceeded: boolean): Promise<EmergenceAnalysisReport> {
        const generateMockAnalysis = () => {
            // FIX: Use standalone helper functions to calculate mock analysis metrics.
            const { cohesion_score, consensus_trajectory } = calculateCohesion(log, fullReport);
            const { adaptability_score, key_adaptive_actions } = calculateAdaptability(log);
            // FIX: The `calculateSurprise` function only takes one argument (`log`), but was called with two. Removed the extra `fullReport` argument.
            const { automated_surprise_index, most_surprising_event } = calculateSurprise(log);
            
            return {
                diversity_score: Math.random() * 0.3 + 0.65,
                key_idea_clusters: [{ cluster_name: 'Concept Cluster (Offline)', percentage: 100 }],
                cohesion_score,
                consensus_trajectory,
                novelty_rate: Math.random() * 0.3 + 0.1,
                key_novelty_events: [{ tick: Math.floor(Math.random() * fullReport.summary.total_ticks), summary: 'A new idea was introduced (offline mode).' }],
                adaptability_score,
                key_adaptive_actions,
                automated_surprise_index,
                most_surprising_event
            };
        };

        if (mode === 'offline' || isQuotaExceeded || !this.activeProvider || !this.activeProvider.isReady()) {
            return generateMockAnalysis();
        }

        try {
            return await this.activeProvider.generateEmergenceAnalysis(log, fullReport);
        } catch (e) {
            console.error("Emergence analysis generation failed, falling back to offline mode:", e);
            return generateMockAnalysis();
        }
    }

    async generateMetaAnalysis(report: Record<string, any>, mode: 'online' | 'offline', orchestratorMode: OrchestratorMode, isQuotaExceeded: boolean) {
        if (mode === 'offline' || isQuotaExceeded || !this.activeProvider || !this.activeProvider.isReady()) {
            const messages: MessageEnvelope[] = report.messages || [];
            const observations: any[] = [];
            let suggested_routing_change = null;
            
            // Check for INSIGHT redundancy, a pattern often seen in 'jazz' mode.
            const insightMessages = messages.filter(m => m.from === NodeName.INSIGHT);
            if (insightMessages.length > (report.summary.total_ticks / 10) && insightMessages.length > 3) {
                observations.push({
                    type: 'REDUNDANCY',
                    description: 'The INSIGHT node was invoked frequently, suggesting redundant processing and a lack of consolidated direction. This pattern often benefits from a quality control gate.',
                    involved_nodes: [NodeName.INSIGHT],
                    confidence: 0.85
                });
                // Suggest the canonical fix for this problem.
                suggested_routing_change = {
                    from: NodeName.INSIGHT,
                    to: [NodeName.META, NodeName.PHI],
                    rationale: "To consolidate insight generation and reduce redundancy by funneling insights through META for meta-analysis and PHI for philosophical grounding, improving system efficiency and focus."
                };
            }

            // Check for stagnation (no high-confidence breakthroughs).
            const hasBreakthrough = messages.some(m => m.from === NodeName.INSIGHT && m.priority === 'HIGH' && m.payload.confidence > 0.85);
            if (!hasBreakthrough && report.summary.total_ticks > 20) {
                 observations.push({
                    type: 'STAGNATION',
                    description: 'The simulation ran for a significant duration without producing a high-confidence breakthrough, indicating a potential stall in creative or analytical progress.',
                    involved_nodes: [NodeName.INSIGHT, ...new Set(messages.map(m => m.from))],
                    confidence: 0.7
                });
            }

            // Default observation if no specific pattern is found.
            if (observations.length === 0) {
                 observations.push({
                    type: 'BIAS', // Using BIAS as a neutral default
                    description: 'Offline structural analysis did not detect major inefficiencies. System operated within expected parameters.',
                    involved_nodes: [],
                    confidence: 0.9
                });
            }

            return { 
                observations,
                system_health: Math.random() * 0.2 + 0.8, // Assume good health in offline
                suggested_routing_change,
            };
        }
        try {
            return await this.activeProvider.generateMetaAnalysis(report);
        } catch(e) {
            console.error("Meta analysis generation failed:", e);
            return { observations: [], system_health: 0.5, error: `Failed to generate META analysis: ${(e as Error).message}` };
        }
    }

    generateMonitorReport(report: Record<string, any>, mode: 'online' | 'offline', orchestratorMode: OrchestratorMode, isQuotaExceeded: boolean, rulingCount?: number) {
        const ticks = report.summary.total_ticks;
        const errors = report.messages.filter((m: MessageEnvelope) => !m.validation.schema_ok).length;
        const cycles = (typeof rulingCount === 'number') ? Math.max(1, rulingCount) : Math.floor(ticks / 10) + (Math.random() > 0.5 ? 1 : 0);
        const stability = Math.max(0, 1 - ((errors + cycles) / (ticks || 1)));
        return {
            cycles_detected: cycles, errors_detected: errors,
            performance_metrics: { avg_tick_ms: 3050, max_latency_ms: 150 },
            stability_score: stability
        };
    }

    async generateArbiterDecision(report: Record<string, any>, mode: 'online' | 'offline', orchestratorMode: OrchestratorMode, isQuotaExceeded: boolean) {
        const ethosFailure = report.messages.find((m: MessageEnvelope) => m.from === NodeName.ETHOS && m.payload.ethical_viability === 'FAIL');
        if (ethosFailure) {
            return {
                final_decision: "Simulation terminated by Moral Override Protocol.",
                rationale: `The initial hypothesis was rejected by the ETHOS node. Reason: ${ethosFailure.payload.reasoning}`,
                supporting_nodes: [NodeName.ETHOS], conflicting_nodes: [],
                alternative_decisions: ["Re-evaluate the hypothesis to align with core principles."],
                consensus_score: 1.0, holistic_health_score: 0.0,
            };
        }
        
        const generateMockDecision = () => {
             const messages: MessageEnvelope[] = report.messages || [];
            const totalNodes = 20;
            const trace_depth = messages.length > 0 ? Math.max(0, ...messages.map(m => m.trace.path.length)) : 0;
            const participatingNodes = new Set(messages.map(m => m.from));
            const node_diversity = participatingNodes.size / totalNodes;
            const confidenceScores = messages.filter(m => m.payload && typeof m.payload.confidence === 'number').map(m => m.payload.confidence);
            const avg_confidence = confidenceScores.length > 0 ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 0;
            const stability = report.monitor_report?.stability_score ?? 1;
            const health = report.meta_analysis?.system_health ?? 1;
            const holisticHealth = (stability + health) / 2;
            
            let final_decision = "Simulation reached a stable conclusion.";
            let rationale = "Standard operational flow. The primary insights are contained within the final state of the INSIGHT node.";
            if (stability > 0.9 && trace_depth <= 5) final_decision = "Conclusion reached, but with shallow reasoning.";
            else if (holisticHealth < 0.5) final_decision = "Simulation concluded with critical system failures.";
            else if (node_diversity > 0.6 && trace_depth > 8) final_decision = "A deep, creative consensus was achieved.";
            
            return {
                final_decision, rationale, supporting_nodes: ["INSIGHT"], conflicting_nodes: [],
                alternative_decisions: ["Re-run with a different exploration mode."],
                consensus_score: Math.max(0, Math.min(1, (holisticHealth + avg_confidence) / 2)),
                holistic_health_score: holisticHealth,
            };
        };

        if (mode === 'offline' || isQuotaExceeded || !this.activeProvider || !this.activeProvider.isReady()) {
            return generateMockDecision();
        }
        try {
             const arbiterPayload = await this.activeProvider.generateArbiterDecision(report);
             const stability = report.monitor_report?.stability_score ?? 1;
             const health = report.meta_analysis?.system_health ?? 1;
             arbiterPayload.holistic_health_score = (stability + health) / 2;
             return arbiterPayload;
        } catch (e) {
            console.error("Arbiter decision generation failed, falling back to offline mode:", e);
            return generateMockDecision();
        }
    }

    async summarizeReport(report: Record<string, any>, mode: 'online' | 'offline', isQuotaExceeded: boolean) {
        if (mode === 'offline' || isQuotaExceeded || !this.activeProvider || !this.activeProvider.isReady()) {
            return `This is an offline-generated summary for the simulation run (ID: \`${report.summary.run_id}\`). The simulation ran for **${report.summary.actual_elapsed_time}** in \`${report.summary.mode}\` mode.\n\n**Arbiter's Final Decision:** The Arbiter has made the decisive call to **"${report.arbiter_decision.final_decision}"**.\n\n**Meta-Researcher's Strategic Observation:** ${(report.meta_analysis.observations[0]?.description) || 'No significant strategic observations.'}`;
        }
        return this.activeProvider.summarizeReport(report);
    }
    
    generateMockPayload = (nodeId: NodeName, inputEnvelope: MessageEnvelope, tick: number, orchestratorMode: OrchestratorMode, initialDirective: string, simulationMode: 'online' | 'offline'): { payload: Record<string, any>, schema_id: string } => {
        const offlineMessage = "This message was generated in offline mode to conserve API resources.";
        const { keywords, concept } = this.getMockContext(initialDirective, inputEnvelope);
        const lowerCaseInput = (inputEnvelope.payload?.hypothesis || initialDirective || "").toLowerCase();

        // Use a simple deterministic hash to cycle through mock response types for variety during testing.
        const mockTypeDecision = (tick + nodeId.length) % 15;

        // --- Special Case: Validation Failure ---
        // Triggered by specific keywords or a roll of the dice for DMAT.
        if (lowerCaseInput.includes('fail') || (nodeId === NodeName.DMAT && mockTypeDecision === 1)) {
            const failingPayload = {
                summary: `Deliberate validation failure for testing on concept: '${concept}'.`,
                semantic_issues: [],
                knowledge_base_check: { scientific_consensus: [], deviations: [] },
                improvement_suggestions: [],
                action: "APPROVE",
                confidence: 0.9,
                impact_score: 0.1,
                // THIS is the extra property that will cause validation to fail, as it's not in the schema.
                intent: "generate-validation-error"
            };
            // Even though it will fail, we return the intended schema_id for the log to report correctly.
            return {
                schema_id: 'FD.DMAT.ANALYSIS.v2',
                payload: failingPayload,
            };
        }

        // --- Special Case: RE_ROUTE Command ---
        // Triggered by keywords or a roll of the dice for logic/meta nodes.
        if (lowerCaseInput.includes('loop') || (nodeId === NodeName.META && mockTypeDecision === 2)) {
            return {
                schema_id: 'FD.META.COMMAND.v1',
                payload: {
                    action: "CUT_LOOP",
                    rationale: `Loop detected involving '${concept}'. Re-routing to break cycle. (${offlineMessage})`,
                    involved_nodes: [inputEnvelope.from, nodeId],
                    intent: 'execute-command',
                    impact_score: 0.8
                }
            };
        }
        if (lowerCaseInput.includes('stuck') || (nodeId === NodeName.PHI_LOGIC && mockTypeDecision === 3)) {
            return {
                schema_id: 'FD.PHI_LOGIC.INTERVENTION.v1',
                payload: {
                    action: 'RE_ROUTE',
                    rationale: `Intervention: discussion on '${concept}' appears stalled. Re-routing for a fresh perspective. (${offlineMessage})`,
                    details: { from: inputEnvelope.from, to: [NodeName.MATH] },
                    confidence: 0.95,
                    intent: 'execute-logical-intervention',
                    impact_score: 0.7
                }
            };
        }

        // --- Default Case: Successful (but now dynamic) Payloads ---
        const mockImplementations: Record<NodeName, () => { payload: Record<string, any>, schema_id: string }> = {
            [NodeName.PHI]: () => {
                const intent = Math.random() < 0.3 ? 'intervene-for-ethics' : 'frame-hypothesis';
                const impact_score = Math.random() * 0.5 + 0.3;
                if (intent === 'intervene-for-ethics') {
                    return {
                        schema_id: 'FD.PHI.INTERVENTION.v1',
                        payload: {
                            evaluation: "risk_assessment",
                            criteria: { cognitive_fairness_score: Math.random(), epistemic_violence_risk: "low", transparency_index: Math.random() },
                            action_required: true,
                            suggested_intervention: { type: "perspective_shift", target_node: "INSIGHT", new_persona_snippet: "pragmatic innovator", prompt_reframe: `Focus on testable solutions for '${concept}', not abstract risks. (${offlineMessage})` },
                            confidence: Math.random() * 0.2 + 0.75,
                            intent,
                            impact_score
                        }
                    };
                }
                return { 
                    schema_id: 'FD.PHI.HYPOTHESIS.v1', 
                    payload: { 
                        hypothesis: `A philosophical framework for '${concept}'. (${offlineMessage})`, principles: ['All concepts are interconnected.'], assumptions: [`'${concept}' can be modeled.`], targets: ['Achieve a formal definition.'], 
                        confidence: Math.random() * 0.2 + 0.7, priority: 'MEDIUM',
                        intent, impact_score
                    } 
                };
            },
            [NodeName.SCI]: () => ({
                schema_id: 'FD.SCI.MODEL.v2',
                payload: {
                    model_summary: { interpretation: `Interpreting mathematical model for '${concept}'. (${offlineMessage})`, key_dynamics_to_test: `The core relationships within '${concept}'.` },
                    simulation_design: { methodology: "Iterative Agent-Based Model", parameters: [{ name: "interaction_strength", description: `Strength of interaction for '${concept}'.`, suggested_range: [0.1, 1.0], unit: "normalized" }], observables: [{ metric_name: "system_entropy", description: "The overall system entropy.", unit: "bits" }], termination_conditions: "Run until a stable state is reached." },
                    expected_outcomes: { hypothesis_to_validate: `The system will converge to a low-entropy state under specific parameters for '${concept}'. (${offlineMessage})`, potential_failure_modes: "Stochastic noise might obscure the primary signal." },
                    confidence: 0.9, priority: 'MEDIUM',
                    intent: 'design-experiment', impact_score: Math.random() * 0.3 + 0.6
                }
            }),
            [NodeName.TECH]: () => ({ schema_id: 'FD.TECH.RESULT.v1', payload: { run_id: `run_${concept.replace(/\s/g, '_')}_${tick}`, metrics: [{ key: 'metric', value: Math.random() * 100 }], artifacts: ['artifact.dat'], confidence: Math.random() * 0.1 + 0.89, intent: 'report-data', impact_score: Math.random() * 0.4 } }),
            [NodeName.INFO]: () => ({ schema_id: 'FD.INFO.MERGE.v1', payload: { summary: `Aggregating upstream data regarding '${concept}'. (${offlineMessage})`, signals: [`A key signal related to '${keywords[0] || 'input'}' has been detected. (${offlineMessage})`], anomalies: [], confidence: Math.random() * 0.3 + 0.6, intent: 'aggregate-data', impact_score: Math.random() * 0.3 + 0.2 } }),
            [NodeName.ART]: () => ({ schema_id: 'FD.ART.PATTERN.v1', payload: { metaphors: [`'${concept}' as a cosmic dance. (${offlineMessage})`], scenarios: [`What if '${concept}' were a fundamental force? (${offlineMessage})`], pattern_map: [{ key: 'conceptA', value: 'patternB' }], confidence: Math.random() * 0.2 + 0.75, intent: 'find-creative-pattern', impact_score: Math.random() * 0.5 + 0.4 } }),
            [NodeName.PHI_LOGIC]: () => ({ schema_id: 'FD.PHI_LOGIC.INTERVENTION.v1', payload: { action: 'RE_ROUTE', rationale: `Logical intervention to prevent loop. (${offlineMessage})`, details: { from: inputEnvelope.from, to: [NodeName.MATH] }, confidence: 0.95, intent: 'execute-logical-intervention', impact_score: 0.7 } }),
            [NodeName.DMAT]: () => {
                 const issues = [];
                if (keywords.length < 2) {
                    issues.push({
                        concept: concept,
                        problem: `Concept is too vague or undefined. (${offlineMessage})`,
                        questions: [`Can you provide a more formal definition of '${concept}'?`, "What are its key properties?"],
                        precision_score: 0.2
                    });
                } else {
                     issues.push({
                        concept: concept,
                        problem: "Lacks a clear causal mechanism.",
                        questions: [`How does '${keywords[0]}' causally influence '${keywords[1]}'?`, "What is the medium of this interaction?"],
                        precision_score: 0.4
                    });
                }
                return {
                    schema_id: 'FD.DMAT.ANALYSIS.v2',
                    payload: {
                        summary: `Semantic analysis of the '${concept}' model. (${offlineMessage})`,
                        semantic_issues: issues,
                        knowledge_base_check: {
                            scientific_consensus: [`Standard model has no established theory for '${concept}'.`],
                            deviations: ["The hypothesis proposes a novel interaction not covered by existing literature."]
                        },
                        improvement_suggestions: [
                            {
                                issue: "Conceptual Ambiguity",
                                fix: `Provide a mathematical representation or diagram of the '${concept}' interaction. (${offlineMessage})`
                            }
                        ],
                        action: "REQUEST_CLARIFICATION_WITH_SPECIFICS",
                        confidence: 0.85,
                        impact_score: 0.75,
                    }
                };
            },
            [NodeName.MATH]: () => ({
                schema_id: 'FD.MATH.SOLUTION.v1',
                payload: {
                    problem_analysis: { received_request: `Request to formalize '${concept}'. (${offlineMessage})`, identified_math_domains: ["basic_models"] },
                    solution_components: [{ domain: "basic_models", component_name: "linear_growth", equations: ["y = m*x + c"], logic: `A simple linear growth model for '${concept}'. (${offlineMessage})`, source: "INTERNAL_KNOWLEDGE_BASE", confidence: 0.99 }],
                    overall_summary: { conclusion: "A linear model is sufficient for this stage.", limitations: "Only applies to linear systems.", next_step_recommendation: "Proceed to SCI for simulation design." },
                    intent: 'formalize-model',
                    impact_score: 0.8
                }
            }),
            [NodeName.DATA]: () => ({
                schema_id: 'FD.DATA.ANALYSIS.v1',
                payload: {
                    dataset_used: 'dataset.csv',
                    observations: [{ pattern: `Linear trend observed for '${concept}'. (${offlineMessage})`, evidence_strength: 0.9 }],
                    stats: { mean: 50, variance: 10 },
                    confidence: 0.95,
                    intent: 'analyze-dataset',
                    impact_score: 0.3
                }
            }),
            [NodeName.ARBITER]: () => ({
                schema_id: 'FD.ARBITER.RULING.v1',
                payload: {
                    ruling_type: 'CREATIVE_GREENLIT',
                    details: {
                        nodes_to_mute: [NodeName.PROBABILITY],
                        unmute_conditions: [{ type: 'TIMEOUT', timeout_ticks: 10 }]
                    },
                    rationale: `Ruling to focus creative path on '${concept}'. (${offlineMessage})`,
                    intent: 'issue-ruling',
                    impact_score: 0.9
                }
            }),
            [NodeName.META]: () => {
                return {
                    schema_id: 'FD.META.STRATEGIC_ASSESSMENT.v1',
                    payload: {
                        strategic_value: 'HIGH',
                        rationale: `Current trajectory for '${concept}' is promising. (${offlineMessage})`,
                        intent: 'assess-strategy',
                        impact_score: Math.random() * 0.5 + 0.5
                    }
                };
            },
            [NodeName.CHAR]: () => ({
                schema_id: 'FD.CHAR.ANALYSIS.v1',
                payload: {
                    symbolic_connections: [{ source_concept: concept, manifesto_principle: 'Intentional Chaos & Living Language', connection_rationale: `Reason for connecting concept to manifesto. (${offlineMessage})`, confidence: 0.8 }],
                    identified_archetypes: ['The Hero'],
                    deep_meaning_summary: `The deep meaning of '${concept}' is a quest for knowledge. (${offlineMessage})`,
                    confidence: 0.85,
                    intent: 'analyze-symbolism',
                    impact_score: 0.4
                }
            }),
            [NodeName.MONITOR]: () => ({ schema_id: 'FD.MONITOR.REPORT.v1', payload: { cycles_detected: 0, errors_detected: 0, performance_metrics: { avg_tick_ms: 50, max_latency_ms: 100 }, stability_score: 0.99 } }),
            [NodeName.COSMO]: () => ({
                schema_id: 'FD.COSMO.HYPOTHESIS.v1',
                payload: {
                    universe_hypothesis: `Hypothesis where '${concept}' is a fundamental cosmic principle. (${offlineMessage})`,
                    dark_matter_role: 'N/A',
                    time_space_links: ['Link'],
                    confidence: 0.7,
                    intent: 'propose-cosmology',
                    impact_score: 0.6
                }
            }),
            [NodeName.GEO3D]: () => ({
                schema_id: 'FD.GEO3D.MODEL.v1',
                payload: {
                    geometry_type: 'Fractal',
                    generation_rule: `A fractal rule based on '${concept}'. (${offlineMessage})`,
                    dimensions: 3,
                    confidence: 0.9,
                    intent: 'model-geometry',
                    impact_score: 0.5
                }
            }),
            [NodeName.MEMORY]: () => ({
                schema_id: 'FD.MEMORY.ANALYSIS.v1',
                payload: {
                    findings: [{
                        type: 'retrieval',
                        summary: `A similar past run involving '${concept}' was found. (${offlineMessage})`,
                        confidence: 0.8,
                        related_run_ids: ['run_123']
                    }],
                    intent: 'analyze-past-runs',
                    impact_score: 0.3
                }
            }),
            [NodeName.INSIGHT]: () => ({
                schema_id: 'FD.INSIGHT.BREAKTHROUGH.v1',
                payload: {
                    breakthrough_summary: `A breakthrough synthesis regarding '${concept}'. (${offlineMessage})`,
                    supporting_inputs: [{ from_node: inputEnvelope.from, key_info: `Key info about '${concept}'.` }],
                    new_direction: `Proposing a new, testable direction for '${concept}'. (${offlineMessage})`,
                    confidence: Math.random() * 0.2 + 0.8,
                    priority: 'HIGH',
                    intent: 'synthesize-breakthrough',
                    impact_score: 0.9
                }
            }),
            [NodeName.PROBABILITY]: () => ({
                schema_id: 'FD.PROBABILITY.ANALYSIS.v1',
                payload: {
                    confidence_score: Math.random() * 0.3 + 0.6,
                    risk_assessment: `Risk assessment for '${concept}': low risk. (${offlineMessage})`,
                    potential_impact: 'High potential impact.',
                    alternative_hypotheses: [{ hypothesis: `An alternative perspective on '${concept}'. (${offlineMessage})`, probability: Math.random() * 0.2 }],
                    intent: 'assess-risk',
                    impact_score: 0.7
                }
            }),
            [NodeName.ENGINEER]: () => ({
                schema_id: 'FD.ENGINEER.COMMAND.v1',
                payload: {
                    action: 'RE_ROUTE',
                    from: 'SRC',
                    to: ['TGT'],
                    rationale: `Engineer command. (${offlineMessage})`,
                    intent: 'execute-reroute',
                    impact_score: 0.9
                }
            }),
            [NodeName.ETHOS]: () => ({
                schema_id: 'FD.ETHOS.ASSESSMENT.v1',
                payload: {
                    ethical_viability: 'PASS',
                    reasoning: `The plan for '${concept}' aligns with ethical principles. (${offlineMessage})`,
                    confidence: 0.99,
                    intent: 'validate-ethics',
                    impact_score: 0.9
                }
            }),
            [NodeName.DMT]: () => ({
                schema_id: 'FD.DMT.STATE_ANALYSIS.v1',
                payload: {
                    system_state: 'ASPIRATIONAL',
                    rationale: `Analysis shows positive momentum for '${concept}'. (${offlineMessage})`,
                    intent: 'analyze-internal-state',
                    impact_score: 0.5
                }
            }),
            [NodeName.CLICK]: () => ({
                schema_id: 'FD.CLICK.TEST_PLAN.v1',
                payload: {
                    hypothesis_id: 'h1',
                    operational_definitions: [{ concept: 'success', definition: `Metric for '${concept}' > 100` }],
                    measurable_metrics: [`'${concept}'_value`],
                    test_plan: { method: 'simulation', params: [{ key: 'iterations', value: 100 }], expected_output_range: '100-120' },
                    confidence: 0.9,
                    intent: 'create-test-plan',
                    impact_score: 0.8
                }
            }),
            [NodeName.HUMAN]: () => ({ schema_id: '', payload: {} }), // Should not be called
            [NodeName.ORCHESTRATOR]: () => ({ schema_id: '', payload: {} }), // Should not be called
        };

        const implementation = mockImplementations[nodeId];
        if (implementation) {
            return implementation();
        }

        // Fallback for any unhandled node
        return {
            schema_id: 'N/A',
            payload: {
                summary: `Default payload for ${nodeId}. (${offlineMessage})`,
                confidence: 0.5,
                intent: `mock-${nodeId.toLowerCase()}`,
                impact_score: 0.1
            }
        };
    }
}

// FIX: Export the AI_SERVICE instance for use in other modules.
export const AI_SERVICE = new AIService();