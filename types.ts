// FIX: Removed circular import of `NodeName` from within the same file.
export enum NodeName {
  PHI = 'PHI',
  SCI = 'SCI',
  TECH = 'TECH',
  INFO = 'INFO',
  ART = 'ART',
  PHI_LOGIC = 'PHI_LOGIC',
  DMAT = 'DMAT',
  HUMAN = 'HUMAN',
  MATH = 'MATH',
  DATA = 'DATA',
  ARBITER = 'ARBITER',
  META = 'META',
  CHAR = 'CHAR',
  MONITOR = 'MONITOR',
  COSMO = 'COSMO',
  GEO3D = 'GEO3D',
  MEMORY = 'MEMORY',
  INSIGHT = 'INSIGHT',
  ENGINEER = 'ENGINEER',
  PROBABILITY = 'PROBABILITY',
  ETHOS = 'ETHOS',
  DMT = 'DMT',
  ORCHESTRATOR = 'ORCHESTRATOR',
  CLICK = 'CLICK',
}

export type OrchestratorMode = 'lucid_dream' | 'jazz' | 'holistic' | 'adaptive' | 'beacon' | 'fhiemdien' | 'prisma';

export type ControlMode = 'manual' | 'dynamic';

export type AIProviderType = 'gemini' | 'openai-compatible';

export interface AIConfig {
  provider: AIProviderType;
  apiKey: string | null;
  baseURL?: string | null;
  modelName?: string | null;
}

export interface Node {
  id: NodeName;
  label: string;
  description: string;
}

// A conceptual model for how PROBABILITY assesses simulation health.
export interface ProgressVector {
  averageConfidence: number;
  breakthroughDensity: number;
  semanticConvergence: number;
  efficiency: number;
  riskLevel: number;
}

export type ProposalAction = 'SWITCH_MODE' | 'EXTEND_TIMELINE' | 'REQUEST_IMMEDIATE_TERMINATION' | 'SWITCH_SIMULATION_MODE';

export interface StrategicProposal {
  action: ProposalAction;
  rationale: string;
  confidence: number;
  // SWITCH_MODE specific
  target_mode?: OrchestratorMode;
  // SWITCH_SIMULATION_MODE specific
  target_simulation_mode?: 'online' | 'offline';
  // EXTEND_TIMELINE specific
  ticks_to_add?: number;
  // REQUEST_IMMEDIATE_TERMINATION specific
  justification_metric?: string;
  proposed_next_step?: string;
}

export interface RemediationContext {
    attempt: number;
    original_msg_id: string;
    rejection_reason: string;
    // Store feedback from the [META, PHI] remediation advisors.
    council_feedback?: Record<string, any>[];
}

export type UnmuteConditionType = 'SCHEMA_BASED' | 'NOVELTY_BASED' | 'TIMEOUT';

export interface UnmuteCondition {
    type: UnmuteConditionType;
    schema_id?: string; // For SCHEMA_BASED
    novelty_score?: number; // For NOVELTY_BASED
    timeout_ticks?: number; // For TIMEOUT
}

export interface MutedNodesInfo {
  nodes: NodeName[];
  muteUntilTick?: number;
  reason: string;
  unmute_conditions?: UnmuteCondition[];
}


export interface ArbitrationRuling {
    ruling_type: 'CREATIVE_GREENLIT' | 'RISK_MITIGATION' | 'SYNTHESIS_TASK_FORCE';
    details: {
        // For CREATIVE_GREENLIT
        nodes_to_mute?: NodeName[];
        unmute_conditions?: UnmuteCondition[];
        // For RISK_MITIGATION
        routing_change?: { from: NodeName; to: NodeName[]; };
        directive_to_insight?: string;
        // For SYNTHESIS_TASK_FORCE
        task_force_nodes?: string[];
        task_force_objective?: string;
        deadline_ticks?: number;
    };
    rationale: string;
}

export interface ArbitrationPayload {
  from: NodeName;
  payload: Record<string, any>;
}

export interface MessageEnvelope {
  msg_id: string;
  from: NodeName;
  to: NodeName[];
  ts: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  timeline: {
    mode: 'deep' | 'quick' | 'realtime' | 'long';
    tick_ms: number;
    max_ticks: number;
  };
  schema_id: string;
  payload: Record<string, any> & { strategic_proposal?: StrategicProposal, arbitration_ruling?: ArbitrationRuling };
  trace: {
    parent: string | null;
    path: NodeName[];
  };
  validation: {
    schema_ok: boolean;
    errors: any[];
  };
  goldenThread?: string; // The "soul" of the initial query
  logType?: 'SYSTEM_OK' | 'SYSTEM_ERROR' | 'DEFAULT' | 'COMMAND';
  tick?: number;
  subTick?: number; // For unique identification within a tick
  remediation_context?: RemediationContext;
  arbitration_context?: { // Context for the ARBITER to make a ruling
    plaintiff_payloads: ArbitrationPayload[]; // Creative side (INSIGHT, PHI)
    defendant_payloads: ArbitrationPayload[]; // Supervisory side (RISK, META)
  };
}

export interface ActiveTransition {
  source: NodeName;
  target: NodeName;
  id: string;
}

export interface EmergenceDataLog {
  payloads: { tick: number; from: NodeName; payload: Record<string, any> }[];
  confidenceTrajectory: number[];
  adaptiveActions: string[];
}

export interface EmergenceAnalysisReport {
  diversity_score: number;
  key_idea_clusters: { cluster_name: string; percentage: number }[];
  cohesion_score: number;
  consensus_trajectory: 'Rising' | 'Falling' | 'Fluctuating' | 'Stable';
  novelty_rate: number;
  key_novelty_events: { tick: number; summary: string }[];
  adaptability_score: 'None' | 'Low' | 'Medium' | 'High' | 'Excellent';
  key_adaptive_actions: { action_type: string; count: number }[];
  automated_surprise_index: number;
  most_surprising_event: { tick: number; summary: string };
}