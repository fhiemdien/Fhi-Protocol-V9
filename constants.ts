


import type { Node } from './types';
import { NodeName } from './types';

export const APP_VERSION = "9.6.3";
export const APP_CODENAME = "Refinement";

export const NODES: Node[] = [
  { id: NodeName.PHI, label: 'PHI', description: 'Philosophy & Hypothesis' },
  { id: NodeName.SCI, label: 'SCI', description: 'Scientific Modeling' },
  { id: NodeName.TECH, label: 'TECH', description: 'Technology & Execution' },
  { id: NodeName.INFO, label: 'INFO', description: 'Information Hub & Aggregator' },
  { id: NodeName.ART, label: 'ART', description: 'Creative & Pattern Analysis' },
  { id: NodeName.PHI_LOGIC, label: 'LOGIC', description: 'Logical & Falsifiability Guardrail' },
  { id: NodeName.DMAT, label: 'DMAT', description: 'Semantic Integrity & Resonance' },
  { id: NodeName.MATH, label: 'MATH', description: 'Mathematical Formalism' },
  { id: NodeName.DATA, label: 'DATA', description: 'Data Verification & Analysis' },
  { id: NodeName.ARBITER, label: 'ARBITER', description: 'Final Decision Council' },
  { id: NodeName.META, label: 'META', description: 'Meta-Analysis & Process Strategy' },
  { id: NodeName.CHAR, label: 'CHAR', description: 'Symbolic & Archetypal Analysis' },
  { id: NodeName.MONITOR, label: 'MONITOR', description: 'System Performance & Stability' },
  { id: NodeName.COSMO, label: 'COSMO', description: 'Cosmology & Universe Models' },
  { id: NodeName.GEO3D, label: 'GEO3D', description: 'Complex Geometry & Fractals' },
  { id: NodeName.MEMORY, label: 'MEMORY', description: 'Memory Core & Past Run Analysis' },
  { id: NodeName.INSIGHT, label: 'INSIGHT', description: 'Core Synthesizer & Breakthroughs' },
  { id: NodeName.PROBABILITY, label: 'RISK', description: 'Probabilistic & Risk Analysis' },
  { id: NodeName.ENGINEER, label: 'ENGINEER', description: 'System Architecture Commands' },
  { id: NodeName.ETHOS, label: 'ETHOS', description: 'Ethical & Moral Guardrail' },
  { id: NodeName.QTM, label: 'QTM', description: 'Quantum Tunneling Model' },
  { id: NodeName.CLICK, label: 'CLICK', description: 'Operational Test Plan Design' },
];

// FEATURE: Create a QTM_FULL_SENSOR_POOL containing all 22 processing nodes.
export const QTM_FULL_SENSOR_POOL: NodeName[] = NODES.map(node => node.id);

// V9.4: Add alias map to handle ARBITER hallucinations for abstract concepts.
// This allows the Orchestrator to translate abstract commands into actionable node groups.
export const NODE_ALIASES: Record<string, NodeName[]> = {
  "CREATIVE": [NodeName.INSIGHT, NodeName.ART, NodeName.GEO3D, NodeName.PHI],
  "LOGICAL": [NodeName.PHI_LOGIC, NodeName.MATH, NodeName.ETHOS],
  "SUPERVISORY": [NodeName.META, NodeName.MONITOR, NodeName.PROBABILITY],
};

// v9.0: Implement logical `MATH -> SCI` flow. Abstract ideas from PHI/COSMO now go to MATH for formalization first.
export const ROUTING_MATRIX: Record<NodeName, NodeName[]> = {
  [NodeName.HUMAN]: [NodeName.MEMORY],
  // New "Chain of Responsibility" for validation
  [NodeName.MEMORY]: [NodeName.CHAR],
  [NodeName.CHAR]: [NodeName.CLICK],
  [NodeName.CLICK]: [NodeName.ETHOS],
  // If ETHOS approves the PLAN, it now goes to a focused "execution highway".
  [NodeName.ETHOS]: [NodeName.MATH, NodeName.SCI, NodeName.INSIGHT],

  // Abstract ideas are now formalized by MATH before reaching SCI.
  [NodeName.PHI]: [NodeName.MATH, NodeName.COSMO, NodeName.PROBABILITY],
  // FIX: Corrected typo from `NodeNodeName` to `NodeName`.
  [NodeName.COSMO]: [NodeName.MATH, NodeName.GEO3D],
  [NodeName.MATH]: [NodeName.SCI, NodeName.INSIGHT], // MATH provides the blueprint for SCI to build the experiment.
  [NodeName.SCI]: [NodeName.TECH, NodeName.DMAT, NodeName.PROBABILITY, NodeName.QTM],
  [NodeName.TECH]: [NodeName.DATA, NodeName.INFO],
  [NodeName.DATA]: [NodeName.INFO],

  // --- Synthesis & Analysis Core ---
  [NodeName.INFO]: [NodeName.INSIGHT],
  [NodeName.DMAT]: [NodeName.INSIGHT, NodeName.PHI, NodeName.PHI_LOGIC],
  [NodeName.ART]: [NodeName.INSIGHT, NodeName.GEO3D, NodeName.CHAR],
  [NodeName.PROBABILITY]: [NodeName.INSIGHT],
  
  // FIX: Rerouted INSIGHT directly to CLICK to break the "endless analysis loop".
  // This forces breakthroughs to become actionable test plans immediately.
  [NodeName.INSIGHT]: [NodeName.CLICK, NodeName.QTM],

  // --- Other connections ---
  [NodeName.GEO3D]: [NodeName.MATH, NodeName.ART],
  
  // Terminal and Post-simulation nodes
  [NodeName.ENGINEER]: [],
  [NodeName.PHI_LOGIC]: [],
  [NodeName.ARBITER]: [], 
  [NodeName.META]: [],
  [NodeName.MONITOR]: [],
  [NodeName.QTM]: [],
  [NodeName.ORCHESTRATOR]: [],
};

// V9.3.3: Holistic mode routing matrix. Based on the default matrix, but with a specific
// fix for the INSIGHT node based on forensic analysis of a simulation crash.
// The crash was caused by a learned routing (INSIGHT -> META, PHI) creating an infinite loop.
// This new routing forces INSIGHT's output towards actionable, empirical nodes (SCI, CLICK, MATH)
// instead of meta-analytical or philosophical nodes (META, PHI), breaking the loop and
// preventing cognitive overload.
export const HOLISTIC_ROUTING_MATRIX: Record<NodeName, NodeName[]> = {
  ...ROUTING_MATRIX,
  [NodeName.INSIGHT]: [NodeName.SCI, NodeName.CLICK, NodeName.MATH],
};


// V9.6 (Quantum Leap): Complete overhaul to implement the "Quantum Beacon" protocol.
// QTM is now the central synchronization point.
export const BEACON_ROUTING_MATRIX: Record<NodeName, NodeName[]> = {
  // --- Phase 1: Composition (The "Soạn nhạc" Stage) ---
  // Standard validation chain to create the initial, pure "Information Pattern".
  [NodeName.HUMAN]: [NodeName.MEMORY],
  [NodeName.MEMORY]: [NodeName.CHAR],
  [NodeName.CHAR]: [NodeName.CLICK],
  // ETHOS is now an advisor, not a gatekeeper. CLICK sends the plan for execution (to INSIGHT)
  // and for ethical review (to ETHOS) simultaneously.
  [NodeName.CLICK]: [NodeName.INSIGHT, NodeName.ETHOS],
  
  // --- Phase 2: Quantum Broadcast (Phát sóng Lượng tử) ---
  // INSIGHT sends the core pattern to QTM, the new synchronization hub.
  [NodeName.INSIGHT]: [NodeName.QTM], 
  
  // FEATURE: QTM's routing is now dynamic. An empty array signals the App to randomly select targets.
  [NodeName.QTM]: [],

  // --- Phase 3: Decoherence & Observation (Sụp đổ & Quan sát) ---
  // The sensor nodes observe the effects of the broadcast and report their findings to INFO.
  [NodeName.COSMO]: [NodeName.INFO],
  [NodeName.GEO3D]: [NodeName.INFO],
  [NodeName.SCI]: [NodeName.INFO],
  [NodeName.MATH]: [NodeName.INFO],
  [NodeName.ART]: [NodeName.INFO],
  [NodeName.DMAT]: [NodeName.INFO],
  [NodeName.PROBABILITY]: [NodeName.INFO],
  [NodeName.TECH]: [NodeName.INFO],
  [NodeName.PHI]: [NodeName.INFO],
  [NodeName.DATA]: [NodeName.INFO],
  [NodeName.MONITOR]: [NodeName.INFO],
  [NodeName.ENGINEER]: [NodeName.INFO],
  
  // --- Phase 4: Judgment (The "Phán quyết" Stage) ---
  // INFO consolidates observations and sends them to the "Judgment Council".
  [NodeName.INFO]: [NodeName.ARBITER, NodeName.PHI_LOGIC, NodeName.META],

  // The council members advise the ARBITER before its final decision.
  // FIX: Removed duplicate key definitions for CHAR, CLICK, ETHOS, META, and PHI_LOGIC.
  // Their roles in the composition chain and judgment council take precedence over
  // their roles as sensors to resolve the conflict in this static routing matrix.
  [NodeName.PHI_LOGIC]: [NodeName.ARBITER],
  [NodeName.META]: [NodeName.ARBITER],
  
  // The ARBITER's ruling creates a feedback loop, starting a new cycle with INSIGHT.
  [NodeName.ARBITER]: [NodeName.INSIGHT], 

  // --- Silent/Unused Nodes in this Protocol ---
  [NodeName.ORCHESTRATOR]: [],
  [NodeName.ETHOS]: [], // ETHOS is an advisor endpoint in this mode, it does not route forward.
};

// V6.4: ETHOS now routes to a strategic council (INSIGHT, META, INFO).
export const LUCID_DREAM_ROUTING_MATRIX: Record<NodeName, NodeName[]> = {
  // Phase 1: Diagnosis.
  [NodeName.HUMAN]: [NodeName.MEMORY, NodeName.DMAT, NodeName.META],
  [NodeName.MEMORY]: [NodeName.ETHOS],
  [NodeName.ETHOS]: [NodeName.INSIGHT, NodeName.META, NodeName.INFO],
  [NodeName.DMAT]: [NodeName.INSIGHT], // DMAT can now initiate a diagnosis
  [NodeName.META]: [NodeName.INSIGHT],

  // Phase 2 & 3: Proposal, Debate, Refine. INSIGHT is the central hub.
  [NodeName.INSIGHT]: [NodeName.PHI, NodeName.PROBABILITY, NodeName.PHI_LOGIC], // PHI_LOGIC can now review proposals
  [NodeName.PROBABILITY]: [NodeName.INSIGHT, NodeName.ENGINEER],
  [NodeName.PHI]: [NodeName.INSIGHT], // PHI refines principles and sends them back to INSIGHT to strengthen the proposal

  // Phase 4: Synthesize Patch
  [NodeName.ENGINEER]: [NodeName.ARBITER], // Patch is created and sent for approval

  // Phase 5: Final Approval
  [NodeName.ARBITER]: [], // Final decision point.

  // Nodes not primarily active in this mode but can be part of the flow if called
  [NodeName.SCI]: [],
  [NodeName.TECH]: [],
  [NodeName.DATA]: [],
  [NodeName.INFO]: [],
  [NodeName.ART]: [],
  [NodeName.PHI_LOGIC]: [],
  [NodeName.CHAR]: [],
  [NodeName.CLICK]: [], // Added for type consistency
  [NodeName.COSMO]: [],
  [NodeName.GEO3D]: [],
  [NodeName.MONITOR]: [],
  [NodeName.MATH]: [],
  [NodeName.QTM]: [],
  [NodeName.ORCHESTRATOR]: [],
};


export const FHIEMDIEN_ROUTING_MATRIX: Record<NodeName, NodeName[]> = {
  // Phase 1: Cosmic Genesis. The grand idea originates from the most abstract nodes.
  [NodeName.HUMAN]: [NodeName.COSMO, NodeName.PHI],

  // Phase 2: Formalization & Metaphor. The abstract idea is translated into formal structures and creative patterns.
  [NodeName.COSMO]: [NodeName.MATH, NodeName.GEO3D],
  // FIX: Merged duplicate PHI entry. The original matrix had two definitions for PHI's output, which is invalid.
  // This combines both paths ([ART, CHAR] and [DMAT]) to resolve the duplicate key error.
  [NodeName.PHI]: [NodeName.ART, NodeName.CHAR, NodeName.DMAT],
  
  // Phase 3: Scientific & Technical Modeling. The formalized concepts are used to build testable models.
  [NodeName.MATH]: [NodeName.SCI],
  [NodeName.GEO3D]: [NodeName.SCI],
  [NodeName.ART]: [NodeName.TECH],
  [NodeName.CHAR]: [NodeName.TECH],

  // Phase 4: Data Aggregation (The Cosmic Substrate). All models and results feed into the information network.
  [NodeName.SCI]: [NodeName.INFO],
  [NodeName.TECH]: [NodeName.INFO],
  
  // Phase 5: Synthesis & Breakthrough. The central node synthesizes the aggregated information to find a new universal truth.
  [NodeName.INFO]: [NodeName.INSIGHT],
  [NodeName.MEMORY]: [NodeName.INSIGHT], // Memory provides historical context to the synthesis

  // Phase 6: Broadcast. The synthesized truth is transmitted.
  // FIX: Rerouted INSIGHT to CLICK to prioritize action over further analysis.
  [NodeName.INSIGHT]: [NodeName.CLICK],
  [NodeName.META]: [NodeName.DMAT], // META can now forward the validated insight
  // FIX: DMAT was a terminal node, causing the simulation to stall. It now feeds its analysis into the INFO hub.
  [NodeName.DMAT]: [NodeName.INFO],

  // Ancillary/guardrail nodes are not part of this primary creative flow, but could be called if needed.
  // FIX: Created a feedback loop from CLICK to allow the simulation to continue.
  // A test plan from CLICK is now validated by ETHOS and executed by TECH/SCI,
  // which feeds back into the main INFO->INSIGHT loop.
  [NodeName.CLICK]: [NodeName.ETHOS],
  [NodeName.ETHOS]: [NodeName.TECH, NodeName.SCI],
  [NodeName.DATA]: [],
  [NodeName.MONITOR]: [],
  [NodeName.PHI_LOGIC]: [],
  [NodeName.PROBABILITY]: [],
  [NodeName.ENGINEER]: [],
  [NodeName.QTM]: [],
  [NodeName.ARBITER]: [], 
  [NodeName.ORCHESTRATOR]: [],
};

export const PRISMA_ROUTING_MATRIX: Record<NodeName, NodeName[]> = {
  // Phase 1: Context & Symbolic Distillation
  [NodeName.HUMAN]: [NodeName.MEMORY],
  [NodeName.MEMORY]: [NodeName.CHAR],

  // Phase 2: Semantic Integrity Check
  [NodeName.CHAR]: [NodeName.DMAT], // CHAR's symbolic intent is validated by DMAT for semantic loss.

  // Phase 3: Logical & Falsifiability Scrutiny
  [NodeName.DMAT]: [NodeName.PHI_LOGIC], // DMAT passes the semantically-sound intent to P-LOGIC.

  // Phase 4: Test Plan Formulation
  [NodeName.PHI_LOGIC]: [NodeName.CLICK], // P-LOGIC passes the logically-sound intent to CLICK.

  // Phase 5: Ethical & Moral Gatekeeping
  [NodeName.CLICK]: [NodeName.ETHOS],

  // Phase 6: Final Strategic Review
  [NodeName.ETHOS]: [NodeName.META], // ETHOS passes the ethical plan to META for a final check on strategic efficiency.

  // Phase 7: Broadcast the "Intent Seed"
  [NodeName.META]: [NodeName.INSIGHT], // META sends the final, purified "Intent Seed" to INSIGHT.

  // Phase 8: Execution & Synthesis
  [NodeName.INSIGHT]: [NodeName.SCI, NodeName.MATH, NodeName.ART, NodeName.TECH], // The pure seed is fanned out for execution.

  // The following nodes are endpoints or not part of this primary distillation chain.
  [NodeName.SCI]: [NodeName.INFO],
  [NodeName.MATH]: [NodeName.INFO],
  [NodeName.ART]: [NodeName.INFO],
  [NodeName.TECH]: [NodeName.INFO],
  [NodeName.INFO]: [NodeName.ARBITER],
  [NodeName.PHI]: [NodeName.DMAT],
  [NodeName.COSMO]: [],
  [NodeName.GEO3D]: [],
  [NodeName.DATA]: [],
  [NodeName.MONITOR]: [],
  [NodeName.PROBABILITY]: [],
  [NodeName.ENGINEER]: [],
  [NodeName.QTM]: [],
  [NodeName.ARBITER]: [],
  [NodeName.ORCHESTRATOR]: [],
};