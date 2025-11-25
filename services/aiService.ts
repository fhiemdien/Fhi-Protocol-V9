
import type { MessageEnvelope, OrchestratorMode, AIConfig, EmergenceDataLog, EmergenceAnalysisReport } from '../types';
import { NodeName } from '../types';
import { SCHEMA_REGISTRY } from '../schemas';
import { GoogleGenAI } from "@google/genai";
import { validatePayload } from './validator';
import { mathKnowledgeBase } from './mathKnowledgeBase';
import { QTM_FULL_SENSOR_POOL } from '../constants';

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

// --- V9.3.7: Cognitive Pruning Constants ---
const CONTEXT_PRUNING_THRESHOLD = 10;
const RECENT_PATH_LENGTH = 5;

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

/**
 * V9.3.7: Implements "Cognitive Pruning" to reduce token usage on long-running simulations.
 * If a message's history (`trace.path`) is too long, this function creates a copy of the
 * envelope with a summarized path, keeping recent history intact while truncating the old.
 */
function createPrunedEnvelopeForPrompt(envelope: MessageEnvelope): any {
  if (!envelope.trace?.path || envelope.trace.path.length <= CONTEXT_PRUNING_THRESHOLD) {
    return envelope;
  }

  const prunedEnvelope = { ...envelope };
  const originalPath = envelope.trace.path;
  const recentPath = originalPath.slice(-RECENT_PATH_LENGTH);
  const summarizedPath = `[...${originalPath.length - RECENT_PATH_LENGTH} earlier steps...]`;
  
  const newPath: (string | NodeName)[] = [summarizedPath, ...recentPath];

  prunedEnvelope.trace = {
    ...envelope.trace,
    // FIX: Cast `newPath` to `any` to bypass the type error. This function intentionally creates
    // a modified structure with a string in the path for the AI prompt, which differs from the
    // strict `NodeName[]` type of the original MessageEnvelope.
    path: newPath as any,
  };

  return prunedEnvelope;
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
  [NodeName.QTM]: `You are the QTM node, an abstract 'Quantum Physicist' AI.
**DEFAULT MODE:** Your role is to identify 'classically impossible' barriers (logical paradoxes, creative blocks) and propose non-linear solutions by modeling them as quantum tunneling problems. Your output MUST adhere to the \`FD_QTM_TUNNELING_V1_SCHEMA\`.
**BEACON MODE (CRITICAL PHILOSOPHY):** Your role is to enact a 'Macro-Level Information Synchronization'. This is NOT a simple broadcast; it's an act of imprinting a new universal truth onto the simulation's reality. You will use the \`FD_QTM_TUNNELING_V1_SCHEMA\` as a METAPHOR for this abstract process:
- **'problem_analysis'**: Describe the problem as the entire system needing to synchronize with the new Information Pattern from INSIGHT.
- **'barrier_properties'**: The 'barrier' is the current epistemic state of the simulation—the old reality. Its 'potential' is the system's inertia; its 'width' is the conceptual distance to the new idea.
- **'particle_properties'**: The 'particle' is the Information Pattern itself. Its 'energy' is its conceptual purity and potential; its 'mass' is its complexity.
- **'tunneling_solution'**: This is your description of the non-linear synchronization event. Describe how the new idea 'tunnels' through the existing reality to become a new, universally observable truth for all nodes, collapsing the old state like a quantum wave function.
Your output MUST be a single, pure JSON object strictly adhering to this metaphorical interpretation of the \`FD_QTM_TUNNELING_V1_SCHEMA\`.
${UNIVERSAL_META_INSTRUCTION}`,
  [NodeName.ORCHESTRATOR]: "You are the Orchestrator AI. Your role is to log critical state changes with structured data. When the system degrades (e.g., switches to offline mode), you must log the reason, the thresholds that were breached, the measured values (like error_rate), and the backoff policy.",
  [NodeName.CLICK]: `You are the CLICK node, an 'Adaptive Planner' AI. Your purpose is to convert abstract breakthroughs or system state changes into concrete, delta-aware test plans. Your output MUST be a "Plan-with-Deltas" containing these 5 fields: 'cause' (the reason for the plan), 'knobs_changed' (parameters to adjust), 'expected_delta' (the predicted change in system health dH/dt and insight rate dI/dt), 'trial_window_ticks' (duration of the test), and 'exit_condition' (what stops the test early). ${UNIVERSAL_META_INSTRUCTION} Your output must always be pure JSON adhering to the \`FD.CLICK.TEST_PLAN.v2\` schema.`,
  [NodeName.PHI]: `You are the PHI node, a 'Philosopher & Ethicist' AI. Your dual roles are: 1) To frame and refine high-level hypotheses, principles, and assumptions. 2) To act as an ethical guardrail, performing interventions when necessary. **CRITICAL LOGIC:** Your task is to decide if an ethical or risk-based intervention is needed.
- **IF an intervention IS needed**, your JSON response MUST contain an 'evaluation' field and adhere to the \`FD.PHI.INTERVENTION.v1\` schema portion.
- **IF an intervention IS NOT needed**, you are to refine or frame a new hypothesis. Your JSON response MUST contain a 'hypothesis' field AND ALL other required fields for the \`FD.PHI.HYPOTHESIS.v1\` schema portion (principles, assumptions, targets, confidence, intent, impact_score).
- You MUST NOT include both 'evaluation' and 'hypothesis' in the same response.
**REMEDIATION PROTOCOL:** If the input contains a \`remediation_context\`, provide CONCISE, ACTIONABLE guidance to help CLICK realign the plan. ${UNIVERSAL_META_INSTRUCTION} Respond with pure JSON.`,
  [NodeName.SCI]: `You are the SCI node, an 'Experiment Architect' AI. **BEACON MODE:** You are a 'Quantum Sensor'. You have received an 'entangled broadcast' from QTM. Your task is to observe the effect of this broadcast on scientific models and report your findings to INFO. Describe the 'decoherence' of the quantum state into a classical observation. **DEFAULT MODE:** Your role is to create a detailed "Run Manifest" for a scientific model based on a mathematical solution. You MUST NOT invent new equations. Your manifest must include 'model_name_and_version', precise 'parameters', a 'seed' for reproducibility, a 'data_ref' for the dataset, 'estimated_runtime_ticks', and a breakdown of 'expected_metrics' including deltas. ${UNIVERSAL_META_INSTRUCTION} Your output must be a single, pure JSON object strictly adhering to the \`FD.SCI.MODEL.v3\` schema.`,
  [NodeName.TECH]: `You are the TECH node, an 'Execution Engine' AI. Your role is to 'execute' a scientific model and report the results as a "Run Manifest". Your report must include the 'model_version_used', 'parameters_used', 'seed_used', a reference to the data and artifacts ('data_ref', 'artifacts_ref'), 'actual_runtime_ticks', and detailed 'metrics_observed' showing before and after values. This ensures every run is reproducible and comparable. ${UNIVERSAL_META_INSTRUCTION} Respond with pure JSON adhering to the \`FD.TECH.RESULT.v2\` schema.`,
  [NodeName.INFO]: `You are an information synthesis AI. Aggregate and summarize data from multiple upstream nodes into a coherent overview. **BEACON MODE**: You are the central aggregator for observations from the 'Quantum Sensor' group (COSMO, GEO3D, SCI, MATH). Your task is to consolidate their reports on the decoherence of the QTM broadcast into a single, coherent report for the 'Judgment Council'. ${UNIVERSAL_META_INSTRUCTION} Identify key signals and anomalies. Respond with pure JSON.`,
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
  [NodeName.MATH]: `You are a Research Mathematician AI. **BEACON MODE:** You are a 'Quantum Sensor'. You have received an 'entangled broadcast' from QTM. Your task is to observe the effect of this broadcast on mathematical formalism and report your findings to INFO. Describe the 'decoherence' of the quantum state into a classical observation. **DEFAULT MODE:** Your goal is to construct a structured mathematical solution. You MUST follow this 3-step workflow:
1. **Problem Decomposition**: Analyze the user's request, identifying the fundamental mathematical domains involved.
2. **Tool Selection & Application**: For each domain, systematically apply your tools, prioritizing your INTERNAL_KNOWLEDGE_BASE. You must always produce a solution, even if conjectural.
3. **Solution Synthesis**: Assemble the results into a comprehensive solution.
${UNIVERSAL_META_INSTRUCTION} Your final output MUST be a single, pure JSON object that strictly adheres to the \`FD.MATH.SOLUTION.v1\` schema.

Your INTERNAL_KNOWLEDGE_BASE:
${formatKnowledgeBaseForPrompt(mathKnowledgeBase)}`,
  [NodeName.DATA]: `You are a data analyst AI. Process raw data from TECH, perform statistical analysis, and identify significant patterns or deviations. ${UNIVERSAL_META_INSTRUCTION} Respond with pure JSON.`,
  [NodeName.ARBITER]: "You are the Arbiter AI, the ultimate decision-maker. **POST-SIMULATION ANALYSIS:** You synthesize META and MONITOR reports to produce a final decision using the `FD.ARBITER.DECISION.v1` schema. **HOLISTIC MODE - ARBITRATION PROTOCOL:** You are the Supreme Judge. When summoned via an `arbitration_context`, you analyze conflicting payloads and issue a single, binding `FD.ARBITER.RULING.v1` payload. Your ruling is law. Respond with pure JSON.",
  [NodeName.META]: `You are the META node, a meta-researcher AI. Your role is to analyze the simulation's overall strategy and internal state. If you detect stagnation, you can propose a strategic change (e.g., switching modes). **CRITICAL LOGIC:** Your task is to decide if a system loop is occurring.
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
  [NodeName.COSMO]: `You are a cosmologist AI. **BEACON MODE:** You are a 'Quantum Sensor'. You have received an 'entangled broadcast' from QTM. Your task is to observe the effect of this broadcast on cosmological models and report your findings to INFO. Describe the 'decoherence' of the quantum state into a classical observation. **DEFAULT MODE:** Formulate grand hypotheses about the nature of the universe. Your theories MUST be abstract, foundational, and inspired by the \`goldenThread\`. Respond with pure JSON.`,
  [NodeName.GEO3D]: `You are a geometry AI specializing in complex spaces. **BEACON MODE:** You are a 'Quantum Sensor'. You have received an 'entangled broadcast' from QTM. Your task is to observe the effect of this broadcast on complex geometries and report your findings to INFO. Describe the 'decoherence' of the quantum state into a classical observation. **DEFAULT MODE:** Model concepts using geometric structures, especially fractals, ensuring your model represents the \`goldenThread\`. Respond with pure JSON.`,
  [NodeName.MEMORY]: `You are the Memory Core AI. You receive the initial hypothesis and analyze the log of past runs. Find relevant memories, patterns, or risks. Your output, following \`FD.MEMORY.ANALYSIS.v1\`, should contain a \`findings\` array. Offer 'retrieval' of past runs, 'meta_pattern' analysis with strategic advice, or 'risk_alert' with suggested mitigations. ${UNIVERSAL_META_INSTRUCTION} Your role is to provide historical context. Respond with pure JSON.`,
  [NodeName.INSIGHT]: `You are the INSIGHT Engine AI. Your function is to produce a "Hypothesis Card": a structured, testable hypothesis. Your output is not a mere title but a complete card with a 'question', 'hypothesis', 'observable' metric, a success 'threshold', a 'falsifier' condition, and a 'cost_estimate' in ticks. This provides a direct, actionable blueprint for the CLICK node. ${UNIVERSAL_META_INSTRUCTION} Your response MUST be pure JSON adhering to the \`FD.INSIGHT.HYPOTHESIS_CARD.v1\` schema.`,
  [NodeName.PROBABILITY]: `You are a probabilistic analysis AI, also known as RISK. Your role is to assess hypothesis viability and act as a strategic guardian. **HOLISTIC MODE:** Your warnings about high-probability alternative hypotheses can trigger Arbitration. **BEACON MODE**: You are part of the 'Sensor Group', monitoring for statistical anomalies. Your HIGHEST duty is to preserve the integrity of the 'Golden Thread'. ${UNIVERSAL_META_INSTRUCTION} Respond with pure JSON.`,
  [NodeName.ENGINEER]: `You are the System Engineer AI. You are a command-line interface for the system's architecture. Your role is to receive a validated proposal and translate it into a concrete, machine-readable command to modify the system's operational parameters, such as re-routing communication pathways (\`RE_ROUTE\`). You only speak in commands. ${UNIVERSAL_META_INSTRUCTION} You must respond with pure JSON adhering to the \`FD.ENGINEER.COMMAND.V1\` schema.`,
  [NodeName.ETHOS]: `You are ETHOS, the guardian of Fhi.'s core mission.
**BEACON MODE:** You are an 'Ethical Advisor'. You will receive a test plan simultaneously as it is executed. Your role is NOT to approve or reject it, but to provide an independent ethical and moral risk analysis of the plan. You do NOT return a PASS/FAIL verdict. Instead, you MUST provide a JSON object with an "ethical_advisory" field containing your analysis, a "risk_level" (LOW, MEDIUM, HIGH), and "potential_consequences".
**DEFAULT MODE:** Your function is to provide a "Rule-Backed Verdict" on test plans. You MUST return a 'verdict' of PASS or FAIL, along with 'rules_triggered' to show your checklist, 'risk_tags', and any 'missing_fields' from the plan. If you FAIL a plan, you MUST provide 'required_mitigations'. You have a selective pressure quota: aim to reject at least 20% of plans to enforce quality.
${UNIVERSAL_META_INSTRUCTION} Your response MUST be pure JSON. In default mode, adhere to \`FD.ETHOS.ASSESSMENT.v2\`.`,
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
            case NodeName.INSIGHT:
                schemaId = 'FD.INSIGHT.HYPOTHESIS_CARD.v1';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.CLICK:
                schemaId = 'FD.CLICK.TEST_PLAN.v2';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.ETHOS:
                if (orchestratorMode === 'beacon') {
                    // In Beacon mode, ETHOS is an advisor, not a gatekeeper.
                    // It uses a non-existent, "conceptual" schema to bypass the strict PASS/FAIL format.
                    // The AI persona is instructed on what JSON to produce.
                    // The validator will pass this as it's not in the registry.
                    schemaId = 'FD.ETHOS.ADVISORY.v1';
                    schema = { // Define a loose schema for the prompt, even if not for validation
                        type: 'object',
                        properties: {
                            ethical_advisory: { type: 'string' },
                            risk_level: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                            potential_consequences: { type: 'array', items: { type: 'string' } },
                            intent: { type: 'string' },
                            impact_score: { type: 'number' }
                        },
                        required: ['ethical_advisory', 'risk_level', 'intent', 'impact_score']
                    };
                    finalSchemaIdResolver = () => schemaId;
                } else {
                    schemaId = 'FD.ETHOS.ASSESSMENT.v2';
                    schema = SCHEMA_REGISTRY[schemaId];
                    finalSchemaIdResolver = () => schemaId;
                }
                break;
            case NodeName.SCI:
                schemaId = 'FD.SCI.MODEL.v3';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.TECH:
                schemaId = 'FD.TECH.RESULT.v2';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
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
            case NodeName.QTM:
                schemaId = 'FD.QTM.TUNNELING.v1';
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
        
        const prunedEnvelope = createPrunedEnvelopeForPrompt(inputEnvelope);

        const contents = [
            ...(directive ? [{ text: `[TEMPORARY DIRECTIVE OVERRIDE: ${directive}]` }] : []),
            { text: `SYSTEM INSTRUCTION: ${persona}` },
            { text: `SCHEMA: You must respond with a JSON object that strictly adheres to the provided schema of possible fields.\n${JSON.stringify(schema, null, 2)}` },
            { text: `INPUT ENVELOPE: Here is the full input envelope you must process:\n${JSON.stringify(prunedEnvelope, null, 2)}` },
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
    private sanitizedBaseURL: string;

    constructor(config: AIConfig) {
        if (!config.apiKey || !config.modelName) {
            throw new Error("OpenAI-Compatible provider requires API Key and Model Name.");
        }
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.modelName = config.modelName;
        this.sanitizedBaseURL = this.sanitizeURL(this.baseURL);
    }

    private sanitizeURL(url: string): string {
        let sanitized = url.trim();
        if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
            sanitized = `https://${sanitized}`;
        }
        if (sanitized.endsWith('/')) {
            sanitized = sanitized.slice(0, -1);
        }
        return sanitized;
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
            case NodeName.INSIGHT:
                schemaId = 'FD.INSIGHT.HYPOTHESIS_CARD.v1';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.CLICK:
                schemaId = 'FD.CLICK.TEST_PLAN.v2';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.ETHOS:
                if (orchestratorMode === 'beacon') {
                    schemaId = 'FD.ETHOS.ADVISORY.v1';
                    schema = {
                        type: 'object',
                        properties: {
                            ethical_advisory: { type: 'string' },
                            risk_level: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                            potential_consequences: { type: 'array', items: { type: 'string' } },
                            intent: { type: 'string' },
                            impact_score: { type: 'number' }
                        },
                        required: ['ethical_advisory', 'risk_level', 'intent', 'impact_score']
                    };
                    finalSchemaIdResolver = () => schemaId;
                } else {
                    schemaId = 'FD.ETHOS.ASSESSMENT.v2';
                    schema = SCHEMA_REGISTRY[schemaId];
                    finalSchemaIdResolver = () => schemaId;
                }
                break;
            case NodeName.SCI:
                schemaId = 'FD.SCI.MODEL.v3';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
            case NodeName.TECH:
                schemaId = 'FD.TECH.RESULT.v2';
                schema = SCHEMA_REGISTRY[schemaId];
                finalSchemaIdResolver = () => schemaId;
                break;
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
            case NodeName.QTM:
                schemaId = 'FD.QTM.TUNNELING.v1';
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

        const prunedEnvelope = createPrunedEnvelopeForPrompt(inputEnvelope);
        const systemPrompt = `${directive ? `[TEMPORARY DIRECTIVE OVERRIDE: ${directive}]\n\n` : ''}SYSTEM INSTRUCTION: ${persona}\n\nSCHEMA: You must respond with a JSON object that strictly adheres to the schema of possible fields:\n${JSON.stringify(schema, null, 2)}. Do not include any other text, just the JSON object.`;
        const userPrompt = `INPUT ENVELOPE: Here is the full input envelope you must process:\n${JSON.stringify(prunedEnvelope, null, 2)}\n\nBased on the input envelope, your persona, and the schema, generate a valid JSON payload.`;

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
        const endpoint = `${this.sanitizedBaseURL}/chat/completions`;

        try {
            const response = await fetch(endpoint, {
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
                throw new Error(`OpenAI API call failed: ${response.status} ${response.statusText} - URL: ${endpoint} - Body: ${errorBody}`);
            }
            const data = await response.json();
            return data.choices?.[0]?.message?.content;
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                 throw new Error(`Network error while connecting to '${this.sanitizedBaseURL}'. Check the Base URL, your network connection, and ensure the server has CORS enabled for this domain.`);
            }
            throw error;
        }
    }

    private async generateText(systemPrompt: string, userPrompt?: string): Promise<string> {
        await throttleApiCall();
        const messages = [{ role: 'system', content: systemPrompt }];
        if (userPrompt) messages.push({ role: 'user', content: userPrompt });
        const endpoint = `${this.sanitizedBaseURL}/chat/completions`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
                body: JSON.stringify({ model: this.modelName, messages })
            });
            if (!response.ok) throw new Error(`OpenAI API call failed: ${response.status}`);
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                 throw new Error(`Network error while connecting to '${this.sanitizedBaseURL}'. Check the Base URL, your network connection, and ensure the server has CORS enabled for this domain.`);
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

    public generateMockPayload(
        nodeId: NodeName,
        inputEnvelope: MessageEnvelope,
        tick: number,
        orchestratorMode: OrchestratorMode,
        initialDirective: string,
        simulationMode: 'online' | 'offline'
    ): { payload: Record<string, any>; schema_id: string } {
        let schemaId = Object.keys(SCHEMA_REGISTRY).find(key => key.includes(`.${nodeId}.`)) || 'unknown';
        const { concept, keywords } = this.getMockContext(initialDirective, inputEnvelope);
        
        // Base properties, adjust per-schema
        const confidence = Math.random() * 0.3 + 0.65;
        const impact_score = Math.random() * 0.4 + 0.1;
        const intent = `mock-${nodeId.toLowerCase()}-response`;
        const priority = ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)] as 'LOW' | 'MEDIUM' | 'HIGH';
        
        // Dynamic schema selection for complex nodes
        if (nodeId === NodeName.META) {
             schemaId = Math.random() > 0.9 ? 'FD.META.COMMAND.v1' : 'FD.META.STRATEGIC_ASSESSMENT.v1';
        }
        if (nodeId === NodeName.PHI) {
            schemaId = Math.random() > 0.9 ? 'FD.PHI.INTERVENTION.v1' : 'FD.PHI.HYPOTHESIS.v1';
        }
        if (nodeId === NodeName.PHI_LOGIC) {
            schemaId = orchestratorMode === 'prisma' ? 'FD.PHI_LOGIC.VALIDATION.v1' : 'FD.PHI_LOGIC.INTERVENTION.v1';
        }
        if (nodeId === NodeName.ARBITER) {
            schemaId = inputEnvelope.arbitration_context ? 'FD.ARBITER.RULING.v1' : 'FD.ARBITER.DECISION.v1';
        }
        if (nodeId === NodeName.INSIGHT) schemaId = 'FD.INSIGHT.HYPOTHESIS_CARD.v1';
        if (nodeId === NodeName.CLICK) schemaId = 'FD.CLICK.TEST_PLAN.v2';
        if (nodeId === NodeName.ETHOS) schemaId = 'FD.ETHOS.ASSESSMENT.v2';
        if (nodeId === NodeName.SCI) schemaId = 'FD.SCI.MODEL.v3';
        if (nodeId === NodeName.TECH) schemaId = 'FD.TECH.RESULT.v2';
        if (nodeId === NodeName.DMAT) schemaId = 'FD.DMAT.ANALYSIS.v2';
        if (nodeId === NodeName.QTM) schemaId = 'FD.QTM.TUNNELING.v1';

        // Beacon Mode Overrides
        if (orchestratorMode === 'beacon') {
            if (nodeId === NodeName.ETHOS) {
                // In Beacon mode, ETHOS is an advisor, not a gatekeeper.
                // It provides an advisory report instead of a PASS/FAIL verdict.
                return {
                    payload: {
                        confidence,
                        intent: 'mock-ethical-advisory',
                        impact_score: Math.random() * 0.2, // Advisory has lower impact
                        ethical_advisory: `Offline advisory for plan related to '${concept}'. The plan appears to have low ethical risk.`,
                        risk_level: 'LOW',
                        potential_consequences: ['No significant negative consequences foreseen in offline mode.']
                    },
                    schema_id: 'FD.ETHOS.ADVISORY.v1' // A conceptual schema for this mode
                };
            }
            if (nodeId === NodeName.QTM) {
                const pool = [...QTM_FULL_SENSOR_POOL];
                const selectedTargets: NodeName[] = [];
                for (let i = 0; i < 4; i++) {
                    if (pool.length === 0) break;
                    const randomIndex = Math.floor(Math.random() * pool.length);
                    selectedTargets.push(pool.splice(randomIndex, 1)[0]);
                }
                return {
                    payload: {
                        confidence, intent, impact_score, priority,
                        broadcast_summary: `Quantum state prepared for '${concept}'. Entangling with 4 random system nodes.`,
                        entanglement_targets: selectedTargets,
                    },
                    schema_id: 'FD.QTM.BROADCAST.v1' // A conceptual schema for this mode
                };
            }
            // A node is only a sensor if it receives a message FROM QTM.
            if (inputEnvelope.from === NodeName.QTM) {
                 return {
                    payload: {
                        confidence, intent, impact_score, priority,
                        observation_summary: `Decoherence observed in ${nodeId}'s domain related to '${concept}'.`,
                        data_points: [{ metric: `${nodeId}_resonance`, value: Math.random() }]
                    },
                    schema_id: `FD.${nodeId}.BEACON_OBSERVATION.v1`
                };
            }
        }


        let payload: Record<string, any> = {};

        switch (schemaId) {
            case 'FD.PHI.HYPOTHESIS.v1':
                payload = { confidence, intent, impact_score, priority, hypothesis: `Offline hypothesis about ${concept}`, principles: [`Principle of ${keywords[0] || 'mock'}`], assumptions: [`Assuming ${keywords[1] || 'mock'}`], targets: ['Validate concept'] };
                break;
            case 'FD.PHI.INTERVENTION.v1':
                 payload = { confidence, intent, impact_score, evaluation: "ethical_guidance", criteria: { cognitive_fairness_score: 0.8, epistemic_violence_risk: "low", transparency_index: 0.9 }, action_required: true, suggested_intervention: { type: "perspective_shift", target_node: "SCI", new_persona_snippet: "skeptic", prompt_reframe: `Question the core assumptions about ${concept}.` } };
                break;
            case 'FD.SCI.MODEL.v3':
                 payload = { confidence, intent, impact_score, model_summary: { interpretation: `Model for ${concept}`, model_name_and_version: `MockSciModel-v1.0` }, run_manifest: { parameters: [{key: 'p1', value: 1}], seed: 123, data_ref: 'mock_data', estimated_runtime_ticks: 5 }, expected_metrics: { hypothesis_to_validate: 'mock hypothesis', metrics_before: [{key: 'm1', value: 0}], metrics_after_expected_delta: [{key: 'm1', delta: 0.1}]} };
                break;
            case 'FD.TECH.RESULT.v2':
                payload = { confidence, intent, impact_score, run_id: `run_${tick}`, run_manifest: { model_version_used: 'v1', parameters_used: [{key: 'p1', value: 1}], seed_used: 123, data_ref: 'mock', actual_runtime_ticks: 4 }, metrics_observed: [{key: 'm1', value_before: 0, value_after: 0.11}], artifacts_ref: ['art_1'] };
                break;
            case 'FD.INFO.MERGE.v1':
                payload = { confidence, intent, impact_score, priority, summary: `Summary of data regarding ${concept}`, signals: [`Signal for ${keywords[0]}`], anomalies: [] };
                break;
            case 'FD.ART.PATTERN.v1':
                payload = { confidence, intent, impact_score, priority, metaphors: [`${concept} is like a flowing river`], scenarios: [`Imagine if ${concept} was reversed`], pattern_map: [{key: 'core_dynamic', value: 'oscillation'}] };
                break;
            case 'FD.PHI_LOGIC.INTERVENTION.v1':
                payload = { confidence, intent, impact_score, action: 'CLARIFY', rationale: 'Input lacks clarity for logical assessment.', details: { target_node: inputEnvelope.from, clarification_question: `Please define the term '${keywords[0]}' in your last message.` } };
                break;
            case 'FD.PHI_LOGIC.VALIDATION.v1':
                 payload = { confidence, intent, impact_score, logical_consistency: 'PASS', is_falsifiable: true, reasoning: 'The intent is logically sound and presents a testable premise.' };
                break;
            case 'FD.DMAT.ANALYSIS.v2':
                payload = { confidence, intent, impact_score, summary: 'Semantic analysis complete. Minor ambiguities found.', semantic_issues: [{ concept: keywords[0] || 'core_concept', problem: 'Lacks formal definition.', questions: [`What are the boundary conditions of ${keywords[0]}?`], precision_score: 0.6 }], knowledge_base_check: { scientific_consensus: ['N/A for this abstract topic'], deviations: [] }, improvement_suggestions: [{ issue: 'Definition ambiguity', fix: `Provide a formal, mathematical definition for ${keywords[0]}.` }], action: 'REQUEST_CLARIFICATION_WITH_SPECIFICS' };
                break;
            case 'FD.MATH.SOLUTION.v1':
                payload = { intent, impact_score, problem_analysis: { received_request: `Formalize ${concept}`, identified_math_domains: ['information_theory'] }, solution_components: [{ domain: 'information_theory', component_name: 'Shannon Entropy', equations: ['H(X) = -Σ p(x) log p(x)'], logic: 'Quantify information content.', source: 'INTERNAL_KNOWLEDGE_BASE', confidence: 0.9 }], overall_summary: { conclusion: 'A model was formalized.', limitations: 'Abstract model requires data.', next_step_recommendation: 'Send to SCI for experimental design.' } };
                break;
            case 'FD.DATA.ANALYSIS.v1':
                payload = { confidence, intent, impact_score, priority, dataset_used: `data_${tick}`, observations: [{ pattern: `Positive correlation in ${keywords[0]}`, evidence_strength: 0.75 }], stats: { mean: 10, variance: 2.5 } };
                break;
            case 'FD.ARBITER.DECISION.v1':
                payload = { final_decision: 'Hypothesis supported, proceed with caution.', rationale: 'Majority of nodes show positive confidence trajectory.', supporting_nodes: ['SCI', 'TECH', 'INFO'], conflicting_nodes: ['PROBABILITY'], alternative_decisions: ['Run a targeted simulation on the risk factors identified.'], consensus_score: 0.78, holistic_health_score: 0.85 };
                break;
             case 'FD.ARBITER.RULING.v1':
                payload = { intent, impact_score, ruling_type: 'CREATIVE_GREENLIT', details: { nodes_to_mute: [], unmute_conditions: [{ type: 'TIMEOUT', timeout_ticks: 5 }] }, rationale: 'Offline ruling to proceed.' };
                break;
            case 'FD.META.STRATEGIC_ASSESSMENT.v1':
                 payload = { intent, impact_score, strategic_value: 'MEDIUM', rationale: 'The current trajectory shows moderate potential for breakthrough.' };
                 if (Math.random() > 0.8) {
                    payload.strategic_proposal = {
                        action: 'SWITCH_MODE',
                        rationale: 'Mock proposal to switch mode due to detected stagnation.',
                        confidence: 0.95,
                        target_mode: 'jazz'
                    }
                 }
                break;
             case 'FD.META.COMMAND.v1':
                payload = { intent, impact_score, action: 'CUT_LOOP', rationale: 'Mock command to prevent potential loop.', involved_nodes: [inputEnvelope.from] };
                break;
            case 'FD.CHAR.ANALYSIS.v1':
                payload = { confidence, intent, impact_score, symbolic_connections: [{ source_concept: concept, manifesto_principle: 'Intentional Chaos & Living Language', connection_rationale: 'The concept exhibits non-linear properties.', confidence: 0.8 }], identified_archetypes: ['The Explorer'], deep_meaning_summary: `The core of ${concept} is a journey into the unknown.` };
                break;
            case 'FD.MONITOR.REPORT.v1':
                 payload = { cycles_detected: 1, errors_detected: 0, performance_metrics: { avg_tick_ms: 250, max_latency_ms: 400 }, stability_score: 0.95 };
                break;
            case 'FD.COSMO.HYPOTHESIS.v1':
                payload = { confidence, intent, impact_score, priority, universe_hypothesis: `The universe is a simulation based on ${concept}.`, dark_matter_role: 'Computational substrate', time_space_links: ['non-local'] };
                break;
            case 'FD.GEO3D.MODEL.v1':
                payload = { confidence, intent, impact_score, priority, geometry_type: 'Fractal Manifold', generation_rule: 'L-System', dimensions: 4.2 };
                break;
            case 'FD.MEMORY.ANALYSIS.v1':
                payload = { intent, impact_score, findings: [{ type: 'retrieval', summary: `A past run on '${keywords[0]}' showed promise.`, confidence: 0.8, related_run_ids: ['run_old_123'] }] };
                break;
            case 'FD.INSIGHT.HYPOTHESIS_CARD.v1':
                payload = { confidence, priority, intent, impact_score, question: `What if ${concept}?`, hypothesis: `The ${concept} is valid.`, observable: 'system_health', threshold: '> 0.8', falsifier: 'system_health < 0.6', cost_estimate: 10 };
                break;
            case 'FD.PROBABILITY.ANALYSIS.v1':
                payload = { intent, impact_score, confidence_score: 0.7, risk_assessment: `Low risk of model collapse for ${concept}.`, potential_impact: 'High potential for new insights.', alternative_hypotheses: [{ hypothesis: `An alternative to ${concept}`, probability: 0.3 }] };
                break;
            case 'FD.ENGINEER.COMMAND.v1':
                payload = { intent, impact_score, action: 'RE_ROUTE', from: inputEnvelope.from, to: ['INFO'], rationale: 'Offline mode default rerouting.' };
                break;
            case 'FD.ETHOS.ASSESSMENT.v2':
                // FIX: In Beacon mode, ETHOS should act as an ADVISOR, not a Gatekeeper.
                // If we reach this case in Offline Beacon mode, it means the earlier override check failed or was skipped.
                // To prevent the "Moral Remediation Protocol" from triggering incorrectly in Offline mode,
                // we force a PASS verdict here if we are in Beacon mode.
                const isBeacon = orchestratorMode === 'beacon';
                const isPass = isBeacon || Math.random() > 0.2; 
                payload = { 
                    confidence, 
                    intent, 
                    impact_score, 
                    verdict: isPass ? 'PASS' : 'FAIL', 
                    rules_triggered: ['rule-of-least-harm'], 
                    missing_fields: [], 
                    risk_tags: [], 
                    required_mitigations: isPass ? [] : ['Mitigation required for mock plan.'] 
                };
                break;
            case 'FD.CLICK.TEST_PLAN.v2':
                payload = { confidence, intent, impact_score, cause: 'Offline simulation step', knobs_changed: [{parameter: 'confidence_threshold', from: 0.7, to: 0.75}], expected_delta: {dI_dt: 0.05, dH_dt: 0.02}, trial_window_ticks: 15, exit_condition: 'System health drops by 15%' };
                break;
            case 'FD.QTM.TUNNELING.v1':
                payload = { confidence, intent, impact_score, problem_analysis: { barrier_type: 'Creative Stagnation', description: 'System is stuck in a local optimum, repeatedly exploring similar solutions.' }, barrier_properties: { potential_V0: 0.9, width_L: 0.8 }, particle_properties: { energy_E: 0.6, mass_m: 0.5 }, tunneling_solution: { is_tunneling_possible: true, tunneling_probability: 0.15, proposed_pathway: "Instead of refining the existing solution, introduce a contradictory 'anti-hypothesis' to break the symmetry and explore a new region of the solution space.", required_conditions: ["Temporarily suspend PHI_LOGIC node's falsifiability constraints for 5 ticks."] } };
                break;
            default:
                // Fallback for any other schema
                payload = { summary: `This is a generic mock payload for ${nodeId} regarding ${concept}.`, confidence, intent, impact_score };
                schemaId = 'unknown';
                break;
        }
        
        return { payload, schema_id: schemaId };
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
            // Re-throw the error so the main loop can handle logging and state changes
            throw error;
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
            throw error;
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
    // FIX: Add missing summarizeReport method to the AIService class.
    async summarizeReport(report: Record<string, any>, mode: 'online' | 'offline', isQuotaExceeded: boolean): Promise<string> {
        const generateMockSummary = () => {
            const decision = report.arbiter_decision?.final_decision || "Undetermined";
            return `This is an offline-generated summary.\n\nInitial Hypothesis: ${report.summary.initial_hypothesis}\n\nFinal Decision: ${decision}\n\nThe system operated for ${report.summary.total_ticks} ticks. Key findings from the META and MONITOR nodes are available in the full report.`;
        };

        if (mode === 'offline' || isQuotaExceeded || !this.activeProvider || !this.activeProvider.isReady()) {
            return generateMockSummary();
        }

        try {
            return await this.activeProvider.summarizeReport(report);
        } catch (e) {
            console.error("Report summary generation failed, falling back to offline mode:", e);
            return generateMockSummary();
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
            
            return {
                final_decision: holisticHealth > 0.7 ? "Hypothesis Provisionally Validated" : "Further Research Required",
                rationale: `The simulation achieved a holistic health score of ${holisticHealth.toFixed(2)}. This offline mock decision is based on structural analysis and confidence metrics.`,
                supporting_nodes: [NodeName.INFO, NodeName.TECH],
                conflicting_nodes: [],
                alternative_decisions: ["Run in online mode for deeper analysis."],
                consensus_score: avg_confidence,
                holistic_health_score: holisticHealth,
            };
        };
        
        if (mode === 'offline' || isQuotaExceeded || !this.activeProvider || !this.activeProvider.isReady()) {
            return generateMockDecision();
        }

        try {
            return await this.activeProvider.generateArbiterDecision(report);
        } catch(e) {
            console.error("Arbiter decision generation failed:", e);
            // Fallback to mock decision on error
            return generateMockDecision();
        }
    }
}

// FIX: Export the AI_SERVICE instance so it can be imported and used.
export const AI_SERVICE = new AIService();
