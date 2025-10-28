
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import NodeMatrix from './components/NodeMatrix';
import TimelineControls from './components/TimelineControls';
import MessageLog from './components/MessageLog';
import ChatInput from './components/ChatInput';
import FinalReportModal from './components/FinalReportModal';
import QueryHistory from './components/QueryHistory';
import ApiKeyModal from './components/ApiKeyModal';
import ReportModeModal from './components/ReportModeModal'; // New Import
// FIX: Import GavelIcon to be used in the Arbitration overlay.
import { GavelIcon } from './components/icons';
import { NODES, ROUTING_MATRIX, BEACON_ROUTING_MATRIX, LUCID_DREAM_ROUTING_MATRIX, FHIEMDIEN_ROUTING_MATRIX, PRISMA_ROUTING_MATRIX, HOLISTIC_ROUTING_MATRIX, APP_VERSION, APP_CODENAME, NODE_ALIASES } from './constants';
import type { Node, MessageEnvelope, ActiveTransition, OrchestratorMode as OrchestratorModeType, ControlMode, StrategicProposal, AIConfig, RemediationContext, MutedNodesInfo, EmergenceDataLog, ArbitrationRuling, UnmuteCondition, ArbitrationPayload } from './types';
import { NodeName } from './types';
import { AI_SERVICE, calculateInterimStatus, resetApiGovernor } from './services/aiService';
import { validatePayload } from './services/validator';
import * as msgpack from 'msgpack-lite';

const STANDARD_TICK_INTERVAL_MS = 500;
const LAST_REPORT_KEY = 'fhi_protocol_last_report';
const MEMORY_LOG_KEY = 'FHI_MEMORY_LOG';
const LEARNED_ROUTING_KEY = 'FHI_LEARNED_ROUTING';
const QUERY_HISTORY_KEY = 'FHI_QUERY_HISTORY';
const INTEGRITY_CHECK_MAX_TICKS = 20;
const AI_CONFIG_KEY = 'FHI_AI_CONFIG';
const SIMULATION_STATE_KEY = 'FHI_SIMULATION_STATE';


const GRAND_CHALLENGES = [
    "What is the nature of consciousness?",
    "How can we unify General Relativity and Quantum Mechanics?",
    "Reframe the measurement problem: model 'wave function collapse' as 'information synchronization'.",
    "What is the physical nature of time?",
    "Is P equal to NP?",
];

type SimulationMode = 'online' | 'offline';

const formatElapsedTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const ORCHESTRATOR_MODE_THEMES: Record<OrchestratorModeType, Record<string, string>> = {
    lucid_dream: {
        text: 'text-rose-400', border: 'border-rose-500', bg: 'bg-rose-600', hoverBg: 'hover:bg-rose-500',
        ring: 'focus:ring-rose-500', accent: 'accent-rose-500',
        rgb: '251 113 133', 
        lightRgb: '253 164 175',
    },
    jazz: {
        text: 'text-violet-400', border: 'border-violet-500', bg: 'bg-violet-600', hoverBg: 'hover:bg-violet-500',
        ring: 'focus:ring-violet-500', accent: 'accent-violet-500',
        rgb: '139 92 246',
        lightRgb: '167 139 250',
    },
    holistic: {
        text: 'text-red-400', border: 'border-red-500', bg: 'bg-red-600', hoverBg: 'hover:bg-red-500',
        ring: 'focus:ring-red-500', accent: 'accent-red-500',
        rgb: '248 113 113',
        lightRgb: '252 165 165',
    },
    adaptive: {
        text: 'text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-600', hoverBg: 'hover:bg-emerald-500',
        ring: 'focus:ring-emerald-500', accent: 'accent-emerald-500',
        rgb: '52 211 153',
        lightRgb: '110 231 183',
    },
    beacon: {
        text: 'text-amber-400', border: 'border-amber-500', bg: 'bg-amber-600', hoverBg: 'hover:bg-amber-500',
        ring: 'focus:ring-amber-500', accent: 'accent-amber-500',
        rgb: '251 191 36',
        lightRgb: '252 211 77',
    },
    fhiemdien: {
        text: 'text-sky-400', border: 'border-sky-500', bg: 'bg-sky-600', hoverBg: 'hover:bg-sky-500',
        ring: 'focus:ring-sky-500', accent: 'accent-sky-500',
        rgb: '56 189 248',
        lightRgb: '125 211 252',
    },
    prisma: {
        text: 'text-teal-400', border: 'border-teal-500', bg: 'bg-teal-600', hoverBg: 'hover:bg-teal-500',
        ring: 'focus:ring-teal-500', accent: 'accent-teal-500',
        rgb: '45 212 191',
        lightRgb: '94 234 212',
    },
};


const ModeToggle: React.FC<{
    mode: SimulationMode;
    onChange: (mode: SimulationMode) => void;
    disabled: boolean;
    apiKeySet: boolean;
    modeTheme: Record<string, string>;
}> = ({ mode, onChange, disabled, apiKeySet, modeTheme }) => {
    const isOnline = mode === 'online';
    const effectiveDisabled = disabled || !apiKeySet;

    return (
        <div className="flex items-center space-x-2">
            <span className={`text-xs font-semibold ${isOnline ? 'text-slate-500' : modeTheme.text}`}>Offline</span>
            <button
                onClick={() => onChange(isOnline ? 'offline' : 'online')}
                disabled={effectiveDisabled}
                className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${modeTheme.ring} ${effectiveDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
                aria-label={`Switch to ${isOnline ? 'Offline' : 'Online'} mode`}
                title={!apiKeySet ? "Set an API Key to enable Online mode" : ""}
            >
                <span className={`absolute inset-0 rounded-full transition-colors ${isOnline && apiKeySet ? modeTheme.bg : 'bg-slate-700'}`}></span>
                <span
                    className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-300 ${isOnline && apiKeySet ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
            </button>
            <span className={`text-xs font-semibold ${isOnline && apiKeySet ? modeTheme.text : 'text-slate-500'}`}>Online</span>
        </div>
    );
};

const OrchestratorMode: React.FC<{
    currentMode: OrchestratorModeType;
    onChange: (mode: OrchestratorModeType) => void;
    disabled: boolean;
    modeTheme: Record<string, string>;
}> = ({ currentMode, onChange, disabled, modeTheme }) => {
    const explorationModes: OrchestratorModeType[] = ['jazz', 'holistic', 'adaptive'];
    const actionModes: OrchestratorModeType[] = ['lucid_dream', 'beacon', 'prisma'];
    const genesisModes: OrchestratorModeType[] = ['fhiemdien'];

    const ringClass = modeTheme.ring.replace('focus:ring-', 'focus:border-');

    const createSelect = (label: string, modes: OrchestratorModeType[], selectedValue: string | null) => (
        <div className="flex-1">
            <select
                id={`orchestrator-mode-${label.replace(/\s+/g, '-')}`}
                value={selectedValue || ''}
                onChange={(e) => {
                    if (e.target.value) {
                        onChange(e.target.value as OrchestratorModeType);
                    }
                }}
                disabled={disabled}
                className={`w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-md ${modeTheme.ring} ${ringClass} disabled:opacity-50 h-9 px-3`}
                aria-label={label}
            >
                <option value="" disabled>{label}</option>
                {modes.map(mode => (
                    <option key={mode} value={mode}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1).replace('_', ' ')}
                    </option>
                ))}
            </select>
        </div>
    );

    const isExploration = explorationModes.includes(currentMode);
    const isAction = actionModes.includes(currentMode);
    const isGenesis = genesisModes.includes(currentMode);

    return (
        <div className="flex w-full items-end space-x-3">
            {createSelect('Exploration Modes', explorationModes, isExploration ? currentMode : '')}
            {createSelect('Action Modes', actionModes, isAction ? currentMode : '')}
            {createSelect('Genesis Mode', genesisModes, isGenesis ? currentMode : '')}
        </div>
    );
};

const App: React.FC = () => {
  const [nodes] = useState<Node[]>(NODES);
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);
  const [activeTransition, setActiveTransition] = useState<ActiveTransition | null>(null);
  const [processingNodes, setProcessingNodes] = useState<Set<NodeName>>(new Set());
  
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBreakthrough, setIsBreakthrough] = useState<boolean>(false);
  const [isSimulationRunning, setIsSimulationRunning] = useState<boolean>(false);
  const [tick, setTick] = useState<number>(0);
  const [durationInMinutes, setDurationInMinutes] = useState<number>(7.5);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  const [lastReport, setLastReport] = useState<Record<string, any> | null>(null);
  const [isReportVisible, setIsReportVisible] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('offline');
  const [orchestratorMode, setOrchestratorMode] = useState<OrchestratorModeType>('fhiemdien');
  const [controlMode, setControlMode] = useState<ControlMode>('dynamic');
  const [dynamicRoutingMatrix, setDynamicRoutingMatrix] = useState<Record<NodeName, NodeName[]>>({...ROUTING_MATRIX});
  const [taskForce, setTaskForce] = useState<Set<NodeName> | null>(null);

  const [hasLearnedRouting, setHasLearnedRouting] = useState(false);
  const [hasMemory, setHasMemory] = useState(false);
  const [applyLearnedConfiguration, setApplyLearnedConfiguration] = useState(false);

  const [queryHistory, setQueryHistory] = useState<string[]>(GRAND_CHALLENGES);
  const [chatInputValue, setChatInputValue] = useState(GRAND_CHALLENGES[0]);
  
  const [systemStatus, setSystemStatus] = useState({ health: 1.0, stability: 1.0 });

  const [aiConfig, setAiConfig] = useState<AIConfig>({ provider: 'gemini', apiKey: null });
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isReportModeModalOpen, setIsReportModeModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const remediationFeedbackRef = useRef<Record<string, any[]>>({});
  const [mutedNodesInfo, setMutedNodesInfo] = useState<MutedNodesInfo | null>(null);
  const [isArbitrationActive, setIsArbitrationActive] = useState<boolean>(false);

  const simulationStartTimeRef = useRef<number | null>(null);
  const initialDirectiveRef = useRef<string>('');
  const executedCommandsRef = useRef<Set<string>>(new Set());
  const lastTestPlanTickRef = useRef<number>(0);
  const modeTheme = ORCHESTRATOR_MODE_THEMES[orchestratorMode];
  const emergenceDataLogRef = useRef<EmergenceDataLog>({ payloads: [], confidenceTrajectory: [], adaptiveActions: [] });
  const cognitiveLoadRef = useRef({ messagesThisTick: 0, errorsThisTick: 0, lastTick: -1 });
  const throttledNodesRef = useRef<Set<NodeName>>(new Set());
  const cycleCountRef = useRef<number>(0); // Number of ARBITER rulings in Beacon mode
  const arbitrationTriggersRef = useRef<Record<string, { count: number; lastTick: number }>>({});
  const directivesRef = useRef<Record<string, string>>({});
  const activeFeedbackLoopsRef = useRef<any[]>([]);


  const baseMaxTicks = useMemo(() => {
    return Math.floor((durationInMinutes * 60 * 1000) / STANDARD_TICK_INTERVAL_MS);
  }, [durationInMinutes]);

  const [currentRunMaxTicks, setCurrentRunMaxTicks] = useState(baseMaxTicks);
  
  useEffect(() => {
    if (!isSimulationRunning) {
      setCurrentRunMaxTicks(baseMaxTicks);
    }
  }, [baseMaxTicks, isSimulationRunning]);


  const addSystemLog = useCallback((
      summary: string, 
      details: Record<string, any>, 
      type: 'SYSTEM_ERROR' | 'SYSTEM_OK' | 'COMMAND',
      from: NodeName = NodeName.ORCHESTRATOR,
      schema_id: string = ''
    ) => {
        setMessages(prev => [...prev, {
            msg_id: `sys_${Date.now()}`, from, to: [], ts: new Date().toISOString(),
            timeline: timelineRef.current, schema_id, 
            payload: { summary, ...details },
            trace: { parent: null, path: [] }, validation: { schema_ok: type !== 'SYSTEM_ERROR', errors: type === 'SYSTEM_ERROR' ? [details] : [] },
            logType: type,
            tick: tickRef.current,
        }]);
  }, []);

  useEffect(() => {
    try {
      const savedConfigStr = localStorage.getItem(AI_CONFIG_KEY);
      if (savedConfigStr) {
        const savedConfig = JSON.parse(savedConfigStr);
        setAiConfig(savedConfig);
        AI_SERVICE.reinitializeClient(savedConfig);
      } else {
        setIsApiKeyModalOpen(true); // Prompt for config if not found
      }

      const savedStateStr = localStorage.getItem(SIMULATION_STATE_KEY);
      if (savedStateStr) {
          const savedState = JSON.parse(savedStateStr);
          setMessages(savedState.messages || []);
          tickRef.current = savedState.tick || 0;
          setTick(savedState.tick || 0);
          setIsSimulationRunning(savedState.isSimulationRunning || false);
          setDurationInMinutes(savedState.durationInMinutes || 7.5);
          setElapsedTime(savedState.elapsedTime || 0);
          setOrchestratorMode(savedState.orchestratorMode || 'fhiemdien');
          setSimulationMode(savedState.simulationMode || 'offline');
          setControlMode(savedState.controlMode || 'dynamic');
          setDynamicRoutingMatrix(savedState.dynamicRoutingMatrix || {...ROUTING_MATRIX});
          setTaskForce(savedState.taskForce ? new Set(savedState.taskForce) : null);
          setSystemStatus(savedState.systemStatus || { health: 1.0, stability: 1.0 });
          setChatInputValue(savedState.chatInputValue || GRAND_CHALLENGES[0]);
          initialDirectiveRef.current = savedState.initialDirective || '';
          simulationStartTimeRef.current = savedState.simulationStartTime || null;
          setCurrentRunMaxTicks(savedState.currentRunMaxTicks || baseMaxTicks);
          executedCommandsRef.current = new Set(savedState.executedCommands || []);
          emergenceDataLogRef.current = savedState.emergenceDataLog || { payloads: [], confidenceTrajectory: [], adaptiveActions: [] };
          setIsPlaying(false); // Always start paused for safety

          setTimeout(() => {
              addSystemLog('System State Restored', { details: 'Resuming previous simulation session.' }, 'SYSTEM_OK');
          }, 100);
          
      } else {
          const savedReportStr = localStorage.getItem(LAST_REPORT_KEY);
          if (savedReportStr) {
              try {
                  setLastReport(JSON.parse(savedReportStr));
              } catch (e) {
                  try {
                      const buffer = Uint8Array.from(atob(savedReportStr), c => c.charCodeAt(0));
                      const decoded = msgpack.decode(buffer);
                      setLastReport(decoded);
                  } catch (err) {
                      console.error("Failed to decode MessagePack report from localStorage", err);
                  }
              }
          }
      }
      
      const savedRouting = localStorage.getItem(LEARNED_ROUTING_KEY);
      if (savedRouting) setHasLearnedRouting(true);

      const savedMemory = localStorage.getItem(MEMORY_LOG_KEY);
      if(savedMemory) setHasMemory(true);

      const savedHistory = localStorage.getItem(QUERY_HISTORY_KEY);
      if(savedHistory) setQueryHistory(JSON.parse(savedHistory));

    } catch (error) {
      console.error("Failed to load initial data from localStorage", error);
      localStorage.removeItem(SIMULATION_STATE_KEY);
    }
    
  }, [addSystemLog, baseMaxTicks]);
  
  useEffect(() => {
    // If API key is removed, switch to offline mode
    if (!aiConfig.apiKey) {
        setSimulationMode('offline');
    }
  }, [aiConfig.apiKey]);

  // Update CSS variables when mode changes for dynamic animations/shadows
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-rgb', modeTheme.rgb);
    root.style.setProperty('--accent-light-rgb', modeTheme.lightRgb);
  }, [modeTheme]);
  
  // Enforce offline mode when controlMode is 'manual'
  useEffect(() => {
    if (controlMode === 'manual') {
        setSimulationMode('offline');
    }
  }, [controlMode]);


  const messageQueueRef = useRef<MessageEnvelope[]>([]);
  const tickRef = useRef<number>(0);
  const timelineRef = useRef({ mode: 'deep' as const, tick_ms: STANDARD_TICK_INTERVAL_MS, max_ticks: baseMaxTicks });
  const isPlayingRef = useRef(isPlaying);
  const messagesRef = useRef(messages);
  const isQuotaExceededRef = useRef(isQuotaExceeded);
  const simulationModeRef = useRef(simulationMode);
  const orchestratorModeRef = useRef(orchestratorMode);
  const controlModeRef = useRef(controlMode);
  const elapsedTimeRef = useRef(elapsedTime);
  const aiConfigRef = useRef(aiConfig);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isQuotaExceededRef.current = isQuotaExceeded; }, [isQuotaExceeded]);
  useEffect(() => { simulationModeRef.current = simulationMode; }, [simulationMode]);
  useEffect(() => { orchestratorModeRef.current = orchestratorMode; }, [orchestratorMode]);
  useEffect(() => { controlModeRef.current = controlMode; }, [controlMode]);
  useEffect(() => { elapsedTimeRef.current = elapsedTime; }, [elapsedTime]);
  useEffect(() => { aiConfigRef.current = aiConfig; }, [aiConfig]);


  const handleSaveApiConfig = (newConfig: AIConfig) => {
    setAiConfig(newConfig);
    AI_SERVICE.reinitializeClient(newConfig);
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(newConfig));
    setIsApiKeyModalOpen(false);
  };

  const handleEngineerCommand = useCallback((command: any) => {
      if (command.action === 'RE_ROUTE' && command.from && command.to) {
          emergenceDataLogRef.current.adaptiveActions.push('RE_ROUTE');
          const commandKey = `${command.action}_${command.from}_${(command.to as string[]).sort().join(',')}`;

          if (executedCommandsRef.current.has(commandKey)) {
              addSystemLog(
                  `INFO: Command '${command.action} ${command.from}->${command.to.join(',')}' already executed. Ignoring duplicate request.`,
                  { command },
                  'SYSTEM_OK',
                  NodeName.ORCHESTRATOR
              );
              return;
          }
          executedCommandsRef.current.add(commandKey);

          setDynamicRoutingMatrix(prev => {
              const newMatrix = { ...prev };
              const fromNode = command.from as NodeName;
              if (newMatrix[fromNode]) {
                  newMatrix[fromNode] = command.to;
                   addSystemLog(`ENGINEER executed RE_ROUTE`, command, 'COMMAND', NodeName.ENGINEER);
                  return newMatrix;
              }
              return prev;
          });
      }
  }, [addSystemLog]);

    const handlePhiLogicCommand = useCallback((command: any, fromEnvelope: MessageEnvelope) => {
        const fromNode = fromEnvelope.from;
        
        // V9.3.3 Beacon Mode Hotfix: Allow recurring commands across cycles.
        // A session-wide duplicate check was blocking necessary, repetitive commands
        // (like RE_ROUTE from PHI_LOGIC) that must occur once per cycle in Beacon mode.
        // This change makes the command key unique per cycle to resolve the issue.
        let commandKey: string;
        if (orchestratorModeRef.current === 'beacon' && (command.action === 'RE_ROUTE' || fromNode === NodeName.INFO)) {
            const currentCycle = cycleCountRef.current + 1;
            const detailsKey = JSON.stringify(command.details || {});
            commandKey = `${fromNode}_${command.action}_${detailsKey}_cycle${currentCycle}`;
        } else {
            commandKey = `${fromNode}_${command.action}_${JSON.stringify(command.details)}`;
        }

        if (executedCommandsRef.current.has(commandKey)) {
            addSystemLog(
                `INFO: Command from ${fromNode} already executed. Ignoring duplicate.`,
                { command }, 'SYSTEM_OK', NodeName.ORCHESTRATOR
            );
            return;
        }
        executedCommandsRef.current.add(commandKey);
        addSystemLog(`${fromNode} executed ${command.action}`, command, 'COMMAND', fromNode);
        emergenceDataLogRef.current.adaptiveActions.push(command.action);


        switch (command.action) {
            case 'RE_ROUTE':
                if (command.details?.from && command.details?.to) {
                    setDynamicRoutingMatrix(prev => {
                        const newMatrix = { ...prev };
                        const fromNode = command.details.from as NodeName;
                        if (newMatrix[fromNode]) {
                            newMatrix[fromNode] = command.details.to;
                            return newMatrix;
                        }
                        return prev;
                    });
                }
                break;

            case 'CLARIFY':
                if (command.details?.target_node && command.details?.clarification_question) {
                    const clarificationEnvelope: MessageEnvelope = {
                        msg_id: `clarify_${Date.now()}`,
                        from: fromNode,
                        to: [command.details.target_node as NodeName],
                        ts: new Date().toISOString(),
                        timeline: fromEnvelope.timeline,
                        schema_id: 'FD.PHI.HYPOTHESIS.v1', // Re-using hypothesis schema for clarification prompt
                        payload: { hypothesis: command.details.clarification_question },
                        trace: { parent: fromEnvelope.msg_id, path: [...fromEnvelope.trace.path, fromNode] },
                        validation: { schema_ok: true, errors: [] },
                        tick: tickRef.current,
                        priority: 'HIGH',
                        goldenThread: fromEnvelope.goldenThread,
                    };
                    messageQueueRef.current.unshift(clarificationEnvelope); // Add to front of queue
                }
                break;

            case 'CUT_LOOP':
                messageQueueRef.current = []; // Clear the queue
                const restartEnvelope: MessageEnvelope = {
                    msg_id: `restart_${Date.now()}`,
                    from: fromNode,
                    to: [NodeName.PHI],
                    ts: new Date().toISOString(),
                    timeline: fromEnvelope.timeline,
                    schema_id: 'FD.PHI.HYPOTHESIS.v1',
                    payload: { hypothesis: `RESTART: ${command.rationale}. Original directive was: '${initialDirectiveRef.current}'` },
                    trace: { parent: fromEnvelope.msg_id, path: [...fromEnvelope.trace.path, fromNode] },
                    validation: { schema_ok: true, errors: [] },
                    tick: tickRef.current,
                    priority: 'HIGH',
                    goldenThread: fromEnvelope.goldenThread,
                };
                messageQueueRef.current.push(restartEnvelope);
                break;

            default:
                addSystemLog(`Unknown command from ${fromNode}`, command, 'SYSTEM_ERROR', fromNode);
                break;
        }
    }, [addSystemLog]);

    const generateReport = useCallback(async (options: { 
      reportGenerationMode: 'online' | 'offline',
      isFinal: boolean,
      integrityAbort?: boolean, 
      moralOverride?: boolean, 
      rationale?: string 
    }) => {
        setIsGeneratingReport(true);
        setIsReportVisible(true);
        
        const reportMode = options.reportGenerationMode || (isQuotaExceededRef.current ? 'offline' : simulationModeRef.current);

        const allMessages = messagesRef.current;
        const totalDurationSeconds = simulationStartTimeRef.current
            ? Math.round((Date.now() - simulationStartTimeRef.current) / 1000)
            : elapsedTimeRef.current;

        const baseReport = {
            summary: {
                run_id: `v${APP_VERSION}_run_${Date.now()}`,
                initial_hypothesis: initialDirectiveRef.current || "N/A",
                total_ticks: tickRef.current,
                configured_duration_minutes: durationInMinutes,
                actual_elapsed_time: formatElapsedTime(totalDurationSeconds),
                total_messages: allMessages.length,
                mode: `${simulationModeRef.current} / ${orchestratorModeRef.current} (Report: ${reportMode})`,
            },
            final_states: {} as Record<string, any>,
            messages: allMessages, // Keep messages for immediate modal display
        };

        const finalMessages = new Map<NodeName, MessageEnvelope>();
        for (const msg of allMessages) {
            if (msg.from !== NodeName.HUMAN && !msg.logType) {
                finalMessages.set(msg.from, msg);
            }
        }

        for (const [node, msg] of finalMessages.entries()) {
            baseReport.final_states[node] = {
                last_payload: msg.payload,
                final_confidence: msg.payload.confidence,
                schema_id: msg.schema_id
            };
        }
        
        const [metaAnalysis, monitorReport] = await Promise.all([
           AI_SERVICE.generateMetaAnalysis(baseReport, reportMode, orchestratorModeRef.current, isQuotaExceededRef.current),
           AI_SERVICE.generateMonitorReport(baseReport, reportMode, orchestratorModeRef.current, isQuotaExceededRef.current, cycleCountRef.current)
        ]);
        
        const tempReportForArbiter = { ...baseReport, meta_analysis: metaAnalysis, monitor_report: monitorReport };
        let arbiterDecision = await AI_SERVICE.generateArbiterDecision(tempReportForArbiter, reportMode, orchestratorModeRef.current, isQuotaExceededRef.current);
        
        const reportWithArbiter = { ...tempReportForArbiter, arbiter_decision: arbiterDecision };
        const emergenceAnalysis = await AI_SERVICE.generateEmergenceAnalysis(emergenceDataLogRef.current, reportWithArbiter, reportMode, isQuotaExceededRef.current);

        let humanSummary;

        if (options?.integrityAbort) {
            arbiterDecision.final_decision = "Simulation aborted by Integrity Protocol.";
            arbiterDecision.rationale = `The simulation was terminated to preserve the integrity of the initial hypothesis. Reason: ${options.rationale}`;
            humanSummary = `**Integrity Abort Protocol Triggered**\n\nThe simulation was intentionally aborted to prevent the generation of high-fidelity noise and preserve the integrity of the initial hypothesis.\n\n**Reasoning:** ${options.rationale}`;
        } else if (options?.moralOverride) {
            arbiterDecision.final_decision = "Simulation terminated by Moral Override Protocol.";
            arbiterDecision.rationale = `The simulation was terminated before starting. Reason: ${options.rationale}`;
            humanSummary = `**Moral Override Protocol Triggered**\n\nThe simulation was halted by the ETHOS node before initiation.\n\n**Reasoning:** ${options.rationale}`;
        }

        const fullReport = {
            ...baseReport,
            meta_analysis: metaAnalysis,
            arbiter_decision: arbiterDecision,
            monitor_report: monitorReport,
            emergence_analysis: emergenceAnalysis,
            human_summary: ''
        };

        if (!humanSummary) {
            humanSummary = await AI_SERVICE.summarizeReport(fullReport, reportMode, isQuotaExceededRef.current);
        }
        fullReport.human_summary = humanSummary;
        
        // Set the full report to state for the modal to use immediately.
        setLastReport(fullReport);
        
        if (fullReport.monitor_report && fullReport.meta_analysis) {
            setSystemStatus({
                stability: fullReport.monitor_report.stability_score || 0,
                health: fullReport.meta_analysis.system_health || 0,
            });
        }

        try {
            // Create a version of the report for storage that excludes the large message trace to prevent quota errors.
            const reportForStorage = { ...fullReport };
            delete (reportForStorage as any).messages; // CRITICAL: Remove messages before saving

            const encodedReport = msgpack.encode(reportForStorage) as Uint8Array;
            let binaryString = '';
            for (let i = 0; i < encodedReport.length; i++) {
                binaryString += String.fromCharCode(encodedReport[i]);
            }
            const base64Report = btoa(binaryString);
            localStorage.setItem(LAST_REPORT_KEY, base64Report);

            const memoryEntry = {
                run_id: fullReport.summary.run_id,
                initial_hypothesis: fullReport.summary.initial_hypothesis,
                final_decision: fullReport.arbiter_decision.final_decision,
                key_findings: (fullReport.meta_analysis.observations || []).map((o: any) => o.description)
            };
            const memoryLog = JSON.parse(localStorage.getItem(MEMORY_LOG_KEY) || '[]');
            memoryLog.push(memoryEntry);
            localStorage.setItem(MEMORY_LOG_KEY, JSON.stringify(memoryLog.slice(-10))); // Keep last 10 memories
            setHasMemory(true);

            if (fullReport.meta_analysis.suggested_routing_change) {
                localStorage.setItem(LEARNED_ROUTING_KEY, JSON.stringify(fullReport.meta_analysis.suggested_routing_change));
                setHasLearnedRouting(true);
            }
        } catch (error: any) {
            console.error("Failed to save report/memory to localStorage", error);
            const errorMessage = (error as Error).message || "An unknown error occurred.";
            if (error.name === 'QuotaExceededError' || errorMessage.includes('exceeded the quota')) {
                 addSystemLog("LocalStorage Quota Exceeded", { error: "Could not save the report summary. The browser's storage limit has been reached. Please clear memory or other site data." }, "SYSTEM_ERROR");
            } else {
                 addSystemLog("Failed to auto-save report", { error: errorMessage }, "SYSTEM_ERROR");
            }
        }
        
        setIsGeneratingReport(false);
        
        if (options.isFinal) {
            setIsPlaying(false);
            setIsSimulationRunning(false);
            localStorage.removeItem(SIMULATION_STATE_KEY);
        }
    }, [durationInMinutes, addSystemLog]);

    const handleSystemProposal = useCallback(async (proposal: StrategicProposal, fromNode: NodeName) => {
      emergenceDataLogRef.current.adaptiveActions.push(proposal.action);
      switch (proposal.action) {
        case 'SWITCH_SIMULATION_MODE':
          if (proposal.target_simulation_mode) {
            setSimulationMode(proposal.target_simulation_mode);
            addSystemLog(
              `${fromNode} proposed SWITCH_SIMULATION_MODE to '${proposal.target_simulation_mode}'. Change applied.`,
              { rationale: proposal.rationale, confidence: proposal.confidence },
              'SYSTEM_OK',
              fromNode
            );
          }
          break;
        case 'SWITCH_MODE':
          if (proposal.target_mode) {
            setOrchestratorMode(proposal.target_mode);
            addSystemLog(
              `${fromNode} proposed SWITCH_MODE to '${proposal.target_mode}'. Change applied.`,
              { rationale: proposal.rationale, confidence: proposal.confidence },
              'SYSTEM_OK',
              fromNode
            );
          }
          break;
        case 'EXTEND_TIMELINE':
          if (proposal.ticks_to_add) {
            const ticksToAdd = proposal.ticks_to_add;
            setCurrentRunMaxTicks(prev => {
                const newMax = prev + ticksToAdd;
                addSystemLog(
                  `${fromNode} proposed EXTEND_TIMELINE by ${ticksToAdd} ticks. New max: ${newMax}.`,
                  { rationale: proposal.rationale, confidence: proposal.confidence },
                  'SYSTEM_OK',
                  fromNode
                );
                return newMax;
            });
          }
          break;
        case 'REQUEST_IMMEDIATE_TERMINATION':
           setIsPlaying(false);
           addSystemLog(
              `[${fromNode}] Integrity Abort Protocol Triggered: ${proposal.justification_metric}.`,
              { rationale: proposal.rationale, confidence: proposal.confidence },
              'SYSTEM_ERROR',
              fromNode
           );
           await generateReport({ isFinal: true, integrityAbort: true, rationale: proposal.rationale, reportGenerationMode: 'offline' });
           break;
      }
    }, [addSystemLog, generateReport]);

  const resetSimulation = useCallback(() => {
    setIsPlaying(false);
    setIsSimulationRunning(false);
    tickRef.current = 0;
    setTick(0);
    setMessages([]);
    messageQueueRef.current = [];
    setActiveTransition(null);
    setProcessingNodes(new Set());
    setIsBreakthrough(false);
    setIsReportVisible(false);
    setLastReport(null);
    setIsQuotaExceeded(false);
    setElapsedTime(0);
    setSystemStatus({ health: 1.0, stability: 1.0 });
    simulationStartTimeRef.current = null;
    initialDirectiveRef.current = '';
    executedCommandsRef.current.clear();
    setDynamicRoutingMatrix({...ROUTING_MATRIX});
    setTaskForce(null);
    resetApiGovernor();
    localStorage.removeItem(SIMULATION_STATE_KEY);
    setMutedNodesInfo(null);
    cycleCountRef.current = 0;
    lastTestPlanTickRef.current = 0;
    emergenceDataLogRef.current = { payloads: [], confidenceTrajectory: [], adaptiveActions: [] };
    cognitiveLoadRef.current = { messagesThisTick: 0, errorsThisTick: 0, lastTick: -1 };
    throttledNodesRef.current.clear();
    arbitrationTriggersRef.current = {};
    setIsArbitrationActive(false);
    directivesRef.current = {};
    activeFeedbackLoopsRef.current = [];
  }, []);

    const handleClearMemory = useCallback(() => {
        localStorage.removeItem(MEMORY_LOG_KEY);
        localStorage.removeItem(LEARNED_ROUTING_KEY);
        localStorage.removeItem(LAST_REPORT_KEY);
        localStorage.removeItem(QUERY_HISTORY_KEY);
        localStorage.removeItem(SIMULATION_STATE_KEY);
        setHasMemory(false);
        setHasLearnedRouting(false);
        setLastReport(null);
        setQueryHistory([]);
        addSystemLog(
            'System Memory Cleared', 
            { details: 'Long-term memory, saved reports, and active session state have been cleared.' }, 
            'SYSTEM_OK'
        );
    }, [addSystemLog]);

  const handleStartSimulation = useCallback(async (hypothesis: string) => {
    if (!hypothesis.trim() || isAnalyzing) return;

    const effectiveMode = aiConfig.apiKey ? simulationMode : 'offline';

    if (effectiveMode === 'online') {
        // --- ONLINE PATH ---
        setIsAnalyzing(true);
        addSystemLog('Intelligent Pre-analysis Started', { hypothesis }, 'SYSTEM_OK');
        try {
            const preAnalysisResult = await AI_SERVICE.performPreAnalysis(
                hypothesis,
                'online',
                isQuotaExceededRef.current
            );

            if (!preAnalysisResult?.structured_hypothesis || !preAnalysisResult?.recommended_mode) {
                throw new Error("Invalid response from Pre-analysis service. Cannot start simulation.");
            }

            addSystemLog('Pre-analysis Complete', preAnalysisResult, 'SYSTEM_OK');
            
            resetSimulation();
            simulationStartTimeRef.current = Date.now();
            initialDirectiveRef.current = hypothesis;
            
            const newOrchestratorMode = preAnalysisResult.recommended_mode;
            setOrchestratorMode(newOrchestratorMode);
            
            const suggestedMinutes = preAnalysisResult.recommended_ticks / 120;
            const closestStep = Math.round(suggestedMinutes / 1.5) * 1.5;
            const finalMinutes = Math.max(1.5, Math.min(66, closestStep));
            setDurationInMinutes(finalMinutes);
            const newMaxTicks = Math.floor((finalMinutes * 60 * 1000) / STANDARD_TICK_INTERVAL_MS);
            setCurrentRunMaxTicks(newMaxTicks);

            addSystemLog('Online First Protocol Engaged', { details: 'System will start with external API calls.' }, 'SYSTEM_OK');
            
            if (hypothesis) {
                const newHistory = [hypothesis, ...queryHistory.filter(h => h !== hypothesis)].slice(0, 5);
                setQueryHistory(newHistory);
                localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(newHistory));
            }

            let baseMatrix;
            if (newOrchestratorMode === 'lucid_dream') baseMatrix = {...LUCID_DREAM_ROUTING_MATRIX};
            else if (newOrchestratorMode === 'beacon') baseMatrix = {...BEACON_ROUTING_MATRIX};
            else if (newOrchestratorMode === 'fhiemdien') baseMatrix = {...FHIEMDIEN_ROUTING_MATRIX};
            else if (newOrchestratorMode === 'prisma') baseMatrix = {...PRISMA_ROUTING_MATRIX};
            else if (newOrchestratorMode === 'holistic') baseMatrix = {...HOLISTIC_ROUTING_MATRIX};
            else baseMatrix = {...ROUTING_MATRIX};
            
            let tempRoutingMatrix = { ...baseMatrix };
            
            if (applyLearnedConfiguration && hasLearnedRouting) {
                if (newOrchestratorMode === 'holistic') {
                    addSystemLog('Learned Routing Skipped', { details: 'Temporarily disabled in Holistic mode based on forensic analysis to prevent known loop conditions.' }, 'SYSTEM_OK');
                } else {
                    try {
                        const learned = JSON.parse(localStorage.getItem(LEARNED_ROUTING_KEY) || '{}');
                        if (learned.from && Array.isArray(learned.to)) {
                            let conflictDetected = false;
                            const sourceNode = learned.from as NodeName;
                            const targetNodes = learned.to as NodeName[];

                            for (const targetNode of targetNodes) {
                                if (baseMatrix[targetNode] && baseMatrix[targetNode].includes(sourceNode)) {
                                    conflictDetected = true;
                                    addSystemLog(`Applied Learning Skipped: Routing loop detected`, { detail: `Applying '${sourceNode} -> ${targetNode}' would conflict with existing '${targetNode} -> ${sourceNode}' rule in ${newOrchestratorMode} mode.` }, 'SYSTEM_OK');
                                    break; 
                                }
                            }

                            if (!conflictDetected) {
                                tempRoutingMatrix[sourceNode] = targetNodes;
                                addSystemLog('Applied Learned Routing', learned, 'SYSTEM_OK', NodeName.META);
                            }
                        }
                    } catch (e) { addSystemLog('Failed to apply learned routing', { error: (e as Error).message }, 'SYSTEM_ERROR'); }
                }
            }
            
            let assembledTaskForce: Set<NodeName> | null = null;
            if (newOrchestratorMode === 'adaptive') {
                const creativeKeywords = ["fractal", "geometric", "consciousness", "philosophy", "art", "metaphor", "universe", "cosmo"];
                const technicalKeywords = ["optimize", "bug", "process", "cycle", "loop", "data", "integrity", "error", "performance"];
                const baseActiveNodes = [NodeName.HUMAN, NodeName.MEMORY, NodeName.INSIGHT, NodeName.ARBITER, NodeName.META, NodeName.MONITOR, NodeName.ENGINEER, NodeName.PROBABILITY, NodeName.CLICK];
                
                const hypothesisLowerCase = hypothesis.toLowerCase();
                const isCreative = creativeKeywords.some(kw => hypothesisLowerCase.includes(kw));
                const isTechnical = technicalKeywords.some(kw => hypothesisLowerCase.includes(kw));
                
                let taskForceNodes: NodeName[] = [];
                let taskForceName: string | null = null;
                if (isCreative && !isTechnical) {
                    taskForceName = 'Creative & Abstract';
                    taskForceNodes = [NodeName.PHI, NodeName.ART, NodeName.COSMO, NodeName.GEO3D, NodeName.MATH, NodeName.PHI_LOGIC, NodeName.CHAR, NodeName.PROBABILITY];
                } else if (isTechnical && !isCreative) {
                    taskForceName = 'Logic & Technical';
                    taskForceNodes = [NodeName.TECH, NodeName.DATA, NodeName.SCI, NodeName.DMAT, NodeName.INFO, NodeName.MATH, NodeName.CHAR, NodeName.PROBABILITY, NodeName.ENGINEER];
                }
                if (taskForceName) {
                    assembledTaskForce = new Set([...baseActiveNodes, ...taskForceNodes]);
                    addSystemLog(`${taskForceName} Task Force assembled`, { nodes: Array.from(assembledTaskForce) }, 'SYSTEM_OK');
                } else {
                    addSystemLog('General Purpose mode. All nodes are active.', {}, 'SYSTEM_OK');
                }
            }
            setTaskForce(assembledTaskForce);

            if (newOrchestratorMode === 'adaptive' && assembledTaskForce) {
                const patchedRoutingMatrix = { ...tempRoutingMatrix };
                addSystemLog('Adaptive Mode: Verifying task force routing integrity...', { nodes: Array.from(assembledTaskForce) }, 'SYSTEM_OK');

                for (const taskForceNode of assembledTaskForce) {
                    const defaultTargets = baseMatrix[taskForceNode] || [];
                    const isDeadEnd = defaultTargets.length > 0 && defaultTargets.every(target => !(assembledTaskForce as Set<NodeName>).has(target));

                    if (isDeadEnd) {
                        if (taskForceNode === NodeName.CLICK) {
                            const newTargets = [NodeName.TECH];
                            patchedRoutingMatrix[taskForceNode] = newTargets;
                             addSystemLog(`[ADAPTIVE] Routing patch applied for ${taskForceNode}.`, { details: `Default target '${defaultTargets.join(', ')}' is outside the task force. Rerouted to [${newTargets.join(', ')}] for immediate execution.` }, 'SYSTEM_OK', NodeName.ORCHESTRATOR);
                        } else if (taskForceNode === NodeName.INSIGHT) {
                            const newTargets = [NodeName.MATH, NodeName.SCI];
                            patchedRoutingMatrix[taskForceNode] = newTargets;
                            addSystemLog(`[ADAPTIVE] Routing patch applied for ${taskForceNode}.`, { details: `Default target '${defaultTargets.join(', ')}' is outside the task force. Rerouted to [${newTargets.join(', ')}] to create a refinement cycle.` }, 'SYSTEM_OK', NodeName.ORCHESTRATOR);
                        } else {
                            patchedRoutingMatrix[taskForceNode] = [NodeName.INSIGHT];
                            addSystemLog(`[ADAPTIVE] Routing patch applied for ${taskForceNode}.`, { details: `Default target(s) '${defaultTargets.join(', ')}' are outside the task force, creating a dead end. Rerouted to INSIGHT.` }, 'SYSTEM_OK', NodeName.ORCHESTRATOR);
                        }
                    }
                }
                tempRoutingMatrix = patchedRoutingMatrix;
            }

            setDynamicRoutingMatrix(tempRoutingMatrix);
            addSystemLog('Simulation Started', { mode: `online / ${newOrchestratorMode}` }, 'SYSTEM_OK');
            
            timelineRef.current = { mode: 'deep', tick_ms: STANDARD_TICK_INTERVAL_MS, max_ticks: newMaxTicks };

            const initialMessage: MessageEnvelope = {
              msg_id: 'h1',
              from: NodeName.HUMAN,
              to: tempRoutingMatrix[NodeName.HUMAN],
              ts: new Date().toISOString(),
              timeline: timelineRef.current,
              schema_id: `structured-hypothesis.${preAnalysisResult.structured_hypothesis.domain?.toLowerCase().replace(/\s/g, '-') || 'general'}`,
              payload: preAnalysisResult.structured_hypothesis,
              trace: { parent: null, path: [NodeName.HUMAN] },
              validation: { schema_ok: true, errors: [] },
              tick: 0,
              goldenThread: hypothesis,
            };
            
            setMessages(prev => [...prev, initialMessage]);
            messageQueueRef.current = [initialMessage];
            setIsPlaying(true);
            setIsSimulationRunning(true);
        } catch (error) {
            addSystemLog('Intelligent Pre-analysis Failed', { error: (error as Error).message }, 'SYSTEM_ERROR');
        } finally {
            setIsAnalyzing(false);
        }
    } else {
        // --- OFFLINE PATH ---
        addSystemLog('Manual Offline Simulation Started', { hypothesis, mode: orchestratorMode, ticks: currentRunMaxTicks }, 'SYSTEM_OK');

        resetSimulation();
        simulationStartTimeRef.current = Date.now();
        initialDirectiveRef.current = hypothesis;
        
        const newOrchestratorMode = orchestratorMode;
        const newMaxTicks = currentRunMaxTicks;
        
        if (hypothesis) {
            const newHistory = [hypothesis, ...queryHistory.filter(h => h !== hypothesis)].slice(0, 5);
            setQueryHistory(newHistory);
            localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(newHistory));
        }

        let baseMatrix;
        if (newOrchestratorMode === 'lucid_dream') baseMatrix = {...LUCID_DREAM_ROUTING_MATRIX};
        else if (newOrchestratorMode === 'beacon') baseMatrix = {...BEACON_ROUTING_MATRIX};
        else if (newOrchestratorMode === 'fhiemdien') baseMatrix = {...FHIEMDIEN_ROUTING_MATRIX};
        else if (newOrchestratorMode === 'prisma') baseMatrix = {...PRISMA_ROUTING_MATRIX};
        else if (newOrchestratorMode === 'holistic') baseMatrix = {...HOLISTIC_ROUTING_MATRIX};
        else baseMatrix = {...ROUTING_MATRIX};
        
        let tempRoutingMatrix = { ...baseMatrix };
        
        if (applyLearnedConfiguration && hasLearnedRouting) {
            if (newOrchestratorMode === 'holistic') {
                addSystemLog('Learned Routing Skipped', { details: 'Temporarily disabled in Holistic mode based on forensic analysis to prevent known loop conditions.' }, 'SYSTEM_OK');
            } else {
                try {
                    const learned = JSON.parse(localStorage.getItem(LEARNED_ROUTING_KEY) || '{}');
                    if (learned.from && Array.isArray(learned.to)) {
                        let conflictDetected = false;
                        const sourceNode = learned.from as NodeName;
                        const targetNodes = learned.to as NodeName[];
                        for (const targetNode of targetNodes) {
                            if (baseMatrix[targetNode] && baseMatrix[targetNode].includes(sourceNode)) {
                                conflictDetected = true;
                                addSystemLog(`Applied Learning Skipped: Routing loop detected`, { detail: `Applying '${sourceNode} -> ${targetNode}' would conflict with existing '${targetNode} -> ${sourceNode}' rule in ${newOrchestratorMode} mode.` }, 'SYSTEM_OK');
                                break; 
                            }
                        }
                        if (!conflictDetected) {
                            tempRoutingMatrix[sourceNode] = targetNodes;
                            addSystemLog('Applied Learned Routing', learned, 'SYSTEM_OK', NodeName.META);
                        }
                    }
                } catch (e) { addSystemLog('Failed to apply learned routing', { error: (e as Error).message }, 'SYSTEM_ERROR'); }
            }
        }
        
        let assembledTaskForce: Set<NodeName> | null = null;
        if (newOrchestratorMode === 'adaptive') {
            const creativeKeywords = ["fractal", "geometric", "consciousness", "philosophy", "art", "metaphor", "universe", "cosmo"];
            const technicalKeywords = ["optimize", "bug", "process", "cycle", "loop", "data", "integrity", "error", "performance"];
            const baseActiveNodes = [NodeName.HUMAN, NodeName.MEMORY, NodeName.INSIGHT, NodeName.ARBITER, NodeName.META, NodeName.MONITOR, NodeName.ENGINEER, NodeName.PROBABILITY, NodeName.CLICK];
            
            const hypothesisLowerCase = hypothesis.toLowerCase();
            const isCreative = creativeKeywords.some(kw => hypothesisLowerCase.includes(kw));
            const isTechnical = technicalKeywords.some(kw => hypothesisLowerCase.includes(kw));
            
            let taskForceNodes: NodeName[] = [];
            let taskForceName: string | null = null;
            if (isCreative && !isTechnical) {
                taskForceName = 'Creative & Abstract';
                taskForceNodes = [NodeName.PHI, NodeName.ART, NodeName.COSMO, NodeName.GEO3D, NodeName.MATH, NodeName.PHI_LOGIC, NodeName.CHAR, NodeName.PROBABILITY];
            } else if (isTechnical && !isCreative) {
                taskForceName = 'Logic & Technical';
                taskForceNodes = [NodeName.TECH, NodeName.DATA, NodeName.SCI, NodeName.DMAT, NodeName.INFO, NodeName.MATH, NodeName.CHAR, NodeName.PROBABILITY, NodeName.ENGINEER];
            }
            if (taskForceName) {
                assembledTaskForce = new Set([...baseActiveNodes, ...taskForceNodes]);
                addSystemLog(`${taskForceName} Task Force assembled`, { nodes: Array.from(assembledTaskForce) }, 'SYSTEM_OK');
            } else {
                addSystemLog('General Purpose mode. All nodes are active.', {}, 'SYSTEM_OK');
            }
        }
        setTaskForce(assembledTaskForce);

        if (newOrchestratorMode === 'adaptive' && assembledTaskForce) {
            const patchedRoutingMatrix = { ...tempRoutingMatrix };
            addSystemLog('Adaptive Mode: Verifying task force routing integrity...', { nodes: Array.from(assembledTaskForce) }, 'SYSTEM_OK');

            for (const taskForceNode of assembledTaskForce) {
                const defaultTargets = baseMatrix[taskForceNode] || [];
                const isDeadEnd = defaultTargets.length > 0 && defaultTargets.every(target => !(assembledTaskForce as Set<NodeName>).has(target));

                if (isDeadEnd) {
                     if (taskForceNode === NodeName.CLICK) {
                        const newTargets = [NodeName.TECH];
                        patchedRoutingMatrix[taskForceNode] = newTargets;
                        addSystemLog(`[ADAPTIVE] Routing patch applied for ${taskForceNode}.`, { details: `Default target '${defaultTargets.join(', ')}' is outside the task force. Rerouted to [${newTargets.join(', ')}] for immediate execution.` }, 'SYSTEM_OK', NodeName.ORCHESTRATOR);
                    } else if (taskForceNode === NodeName.INSIGHT) {
                        const newTargets = [NodeName.MATH, NodeName.SCI];
                        patchedRoutingMatrix[taskForceNode] = newTargets;
                        addSystemLog(`[ADAPTIVE] Routing patch applied for ${taskForceNode}.`, { details: `Default target '${defaultTargets.join(', ')}' is outside the task force. Rerouted to [${newTargets.join(', ')}] to create a refinement cycle.` }, 'SYSTEM_OK', NodeName.ORCHESTRATOR);
                    } else {
                        patchedRoutingMatrix[taskForceNode] = [NodeName.INSIGHT];
                        addSystemLog(`[ADAPTIVE] Routing patch applied for ${taskForceNode}.`, { details: `Default target(s) '${defaultTargets.join(', ')}' are outside the task force, creating a dead end. Rerouted to INSIGHT.` }, 'SYSTEM_OK', NodeName.ORCHESTRATOR);
                    }
                }
            }
            tempRoutingMatrix = patchedRoutingMatrix;
        }

        setDynamicRoutingMatrix(tempRoutingMatrix);
        addSystemLog('Simulation Started', { mode: `offline / ${newOrchestratorMode}` }, 'SYSTEM_OK');

        timelineRef.current = { mode: 'deep', tick_ms: STANDARD_TICK_INTERVAL_MS, max_ticks: newMaxTicks };

        const initialMessage: MessageEnvelope = {
          msg_id: 'h1',
          from: NodeName.HUMAN,
          to: tempRoutingMatrix[NodeName.HUMAN],
          ts: new Date().toISOString(),
          timeline: timelineRef.current,
          schema_id: 'FD.PHI.HYPOTHESIS.v1',
          payload: { hypothesis: hypothesis, principles: [], assumptions: [], targets: [], confidence: 1.0 },
          trace: { parent: null, path: [NodeName.HUMAN] },
          validation: { schema_ok: true, errors: [] },
          tick: 0,
          goldenThread: hypothesis,
        };
        
        setMessages(prev => [...prev, initialMessage]);
        messageQueueRef.current = [initialMessage];
        setIsPlaying(true);
        setIsSimulationRunning(true);
    }
  }, [
    resetSimulation, hasLearnedRouting, applyLearnedConfiguration, queryHistory, 
    addSystemLog, isAnalyzing, simulationMode, aiConfig, orchestratorMode, currentRunMaxTicks
  ]);
  
    const initiateRemediationProtocol = useCallback((rejectedEnvelope: MessageEnvelope, rejectionReason: string) => {
        emergenceDataLogRef.current.adaptiveActions.push('Moral Remediation');
        const attempt = (rejectedEnvelope.remediation_context?.attempt || 0) + 1;
        addSystemLog(`Moral Remediation Protocol (Attempt ${attempt}/3)`, { reason: rejectionReason }, 'SYSTEM_ERROR', NodeName.ETHOS);

        const remediationAdvisors = [NodeName.META, NodeName.PHI];
        addSystemLog(`Assembling Remediation Advisors: [META, PHI]`, { advisors: remediationAdvisors }, 'SYSTEM_OK');

        const newRemediationContext: RemediationContext = {
            attempt,
            original_msg_id: rejectedEnvelope.remediation_context?.original_msg_id || rejectedEnvelope.msg_id,
            rejection_reason: rejectionReason,
        };

        const advisorMessages = remediationAdvisors.map(advisorNode => ({
            ...rejectedEnvelope,
            msg_id: `remediation_advisor_${advisorNode}_${Date.now()}`,
            to: [advisorNode],
            from: NodeName.ETHOS, // Sent from ETHOS
            remediation_context: newRemediationContext,
            payload: {
                ...rejectedEnvelope.payload,
                failed_test_plan: rejectedEnvelope.payload, // Pass the failed plan for review
            },
        }));

        messageQueueRef.current.unshift(...advisorMessages);
        remediationFeedbackRef.current[newRemediationContext.original_msg_id] = [];

    }, [addSystemLog]);
    
    const checkFeedbackLoops = useCallback(() => {
        const activeLoops = activeFeedbackLoopsRef.current;
        if (activeLoops.length === 0) return;

        // Simplified check for convergence stall (threshold lowered based on forensic analysis)
        const healthHistory = emergenceDataLogRef.current.confidenceTrajectory;
        if (healthHistory.length > 10) { // Was 15
            const lastTen = healthHistory.slice(-10); // Was lastFifteen
            const variance = lastTen.reduce((acc, val, _, arr) => acc + Math.pow(val - (arr.reduce((a, b) => a + b, 0) / arr.length), 2), 0) / 10; // was 15
            
            // If health is stable (low variance), a stall might be happening
            if (variance < 0.001) { 
                const stalledLoop = activeLoops.find(l => l.trigger_on?.convergence_stall);
                if (stalledLoop) {
                    activeFeedbackLoopsRef.current = activeFeedbackLoopsRef.current.filter(l => l !== stalledLoop); // Consume the loop
                    addSystemLog(`[FEEDBACK LOOP] Triggered: Convergence Stall Detected`, { protocol: stalledLoop.response_protocol }, 'COMMAND', NodeName.CLICK);
                    
                    // Execute response protocol
                    if (stalledLoop.response_protocol === 'switch_to_fractal_mode') {
                        setOrchestratorMode('fhiemdien'); // 'fhiemdien' is a good proxy for a fractal/geometric mode
                         addSystemLog(`[FEEDBACK LOOP] Action: Switched orchestrator mode to 'fhiemdien' to break stall.`, {}, 'SYSTEM_OK');
                    }
                }
            }
        }
    }, [addSystemLog]);

  const processQueue = useCallback(async () => {
    if (isArbitrationActive) return STANDARD_TICK_INTERVAL_MS;

    checkFeedbackLoops();

    // Cognitive Load Governor: Reset per-tick counters
    if (tickRef.current !== cognitiveLoadRef.current.lastTick) {
        cognitiveLoadRef.current = { messagesThisTick: 0, errorsThisTick: 0, lastTick: tickRef.current };
    }

    if (tickRef.current >= currentRunMaxTicks) {
        if(isPlayingRef.current) {
            setIsPlaying(false);
            addSystemLog('Simulation Ended', { reason: 'Max ticks reached. You can now generate a report.' }, 'SYSTEM_OK');
        }
        return 0; // Return delay
    }

    // If queue is empty, just wait for the next iteration of the loop.
    // This allows time for processing nodes to finish or for feedback loops (like ARBITER in beacon mode)
    // to generate new messages. The simulation will continue as long as isPlaying is true.
    if (messageQueueRef.current.length === 0) {
        return STANDARD_TICK_INTERVAL_MS;
    }
    
    // Universal Intelligent Prioritization (Phase 3 Upgrade)
    messageQueueRef.current.sort((a, b) => {
        const priorityMap = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        const scoreA = (priorityMap[a.priority || 'LOW'] || 0) + (a.payload.impact_score || 0);
        const scoreB = (priorityMap[b.priority || 'LOW'] || 0) + (a.payload.impact_score || 0);
        return scoreB - scoreA;
    });


    // Adaptive Mode: Experiment Manager
    if (orchestratorModeRef.current === 'adaptive' && (tickRef.current - lastTestPlanTickRef.current) > 10) {
        addSystemLog('Experiment Manager Triggered', { detail: 'No test plan executed for 10 ticks. Prompting CLICK.' }, 'SYSTEM_OK');
        const promptToClick: MessageEnvelope = {
            msg_id: `orchestrator_prompt_click_${Date.now()}`,
            from: NodeName.ORCHESTRATOR,
            to: [NodeName.CLICK],
            ts: new Date().toISOString(),
            timeline: timelineRef.current,
            schema_id: 'N/A',
            payload: {
                instruction: "System has been idle without a test plan for 10 ticks. Based on recent message history, formulate and propose a new, concrete TEST_PLAN.",
                recent_messages: messagesRef.current.slice(-5) // Provide context
            },
            trace: { parent: null, path: [NodeName.ORCHESTRATOR] },
            validation: { schema_ok: true, errors: [] },
            tick: tickRef.current,
            priority: 'HIGH',
            goldenThread: initialDirectiveRef.current,
        };
        messageQueueRef.current.unshift(promptToClick);
        lastTestPlanTickRef.current = tickRef.current; // Reset timer
    }
    
    // Adaptive Mode: Check if muted nodes should be un-muted
    if (mutedNodesInfo && tickRef.current >= (mutedNodesInfo.muteUntilTick || Infinity)) {
        addSystemLog('Logical Guardrail Lifted', { nodes: mutedNodesInfo.nodes, reason: 'Mute duration expired.' }, 'SYSTEM_OK');
        setMutedNodesInfo(null);
    }
     // Arbitration Protocol: Check for unmute conditions
    if (mutedNodesInfo?.unmute_conditions) {
        const lastMessage = messagesRef.current[messagesRef.current.length - 1];
        let shouldUnmute = false;
        let reason = '';

        for (const condition of mutedNodesInfo.unmute_conditions) {
            if (condition.type === 'TIMEOUT' && condition.timeout_ticks && tickRef.current >= condition.timeout_ticks) {
                shouldUnmute = true;
                reason = `Timeout of ${condition.timeout_ticks} ticks reached.`;
                break;
            }
            if (lastMessage && condition.type === 'SCHEMA_BASED' && lastMessage.schema_id === condition.schema_id) {
                shouldUnmute = true;
                reason = `Required action (${condition.schema_id}) was completed.`;
                break;
            }
            if (lastMessage && condition.type === 'NOVELTY_BASED' && lastMessage.payload.confidence > (condition.novelty_score || 0.8)) {
                 shouldUnmute = true;
                 reason = `A new high-confidence breakthrough was generated.`;
                 break;
            }
        }

        if (shouldUnmute) {
            addSystemLog('Conditionally Muted Nodes Reactivated', { nodes: mutedNodesInfo.nodes, reason }, 'SYSTEM_OK');
            setMutedNodesInfo(null);
        }
    }


    const currentMessage = messageQueueRef.current.shift();
    if (!currentMessage) return STANDARD_TICK_INTERVAL_MS;
    
    cognitiveLoadRef.current.messagesThisTick++;
    setActiveTransition(null);

    tickRef.current += 1;
    setTick(tickRef.current);

    if (tickRef.current > 0 && (tickRef.current % 10 === 0 || tickRef.current === currentRunMaxTicks -1 )) {
        const status = calculateInterimStatus(messagesRef.current, tickRef.current);
        setSystemStatus({ health: status.health, stability: status.stability });
        emergenceDataLogRef.current.confidenceTrajectory.push(status.health);
    }

    let maxRequestedDelay = 0;

    let subTickCounter = 1;
    for (const targetNodeId of currentMessage.to) {
        
        setProcessingNodes(prev => new Set(prev).add(targetNodeId));
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        setActiveTransition({ source: currentMessage.from, target: targetNodeId, id: currentMessage.msg_id });
        
        // Directive Injection Logic (Phase 2)
        const directive = directivesRef.current[targetNodeId];
        if (directive) {
            delete directivesRef.current[targetNodeId]; // Use once
            addSystemLog(`Directive Injected to ${targetNodeId}`, { directive }, 'COMMAND', NodeName.PHI);
        }

        let outputPayload: Record<string, any> | null = null;
        let outputSchemaId: string = '';
        let validationResult: { isValid: boolean; errors: any[] } = { isValid: false, errors: [] };
        
        try {
            const { payload, schema_id } = await AI_SERVICE.generateNodeOutput(
                targetNodeId, 
                currentMessage, 
                simulationModeRef.current,
                isQuotaExceededRef.current,
                tickRef.current,
                orchestratorModeRef.current,
                initialDirectiveRef.current,
                currentRunMaxTicks,
                directive // Pass the directive to the AI service
            );

            outputPayload = payload;
            outputSchemaId = schema_id;
            validationResult = validatePayload(schema_id, payload);
            emergenceDataLogRef.current.payloads.push({ tick: tickRef.current, from: targetNodeId, payload });


            if (orchestratorModeRef.current === 'jazz' && payload.requested_delay_ms) {
                maxRequestedDelay = Math.max(maxRequestedDelay, payload.requested_delay_ms);
            }
        } catch (e) {
            const error = e as Error;
            const errorString = JSON.stringify(e);
            cognitiveLoadRef.current.errorsThisTick++;
            
            if ((errorString.includes('RESOURCE_EXHAUSTED') || (error.message && error.message.toLowerCase().includes('quota'))) && !isQuotaExceededRef.current) {
                setIsQuotaExceeded(true);
                addSystemLog('API Quota Exceeded', { details: 'Daily limit reached. Switching to offline mock simulation for this session.' }, 'SYSTEM_ERROR');
            }
            
            addSystemLog(`API Call Failed`, { node: targetNodeId, error: error.message }, 'SYSTEM_ERROR', targetNodeId);
            validationResult = { isValid: false, errors: [error.message] };
            
            const { payload: mockPayload, schema_id: mockSchemaId } = AI_SERVICE.generateMockPayload(targetNodeId, currentMessage, tickRef.current, orchestratorModeRef.current, initialDirectiveRef.current, simulationModeRef.current);
            outputPayload = mockPayload;
            outputSchemaId = mockSchemaId;
            emergenceDataLogRef.current.payloads.push({ tick: tickRef.current, from: targetNodeId, payload: mockPayload });

        } finally {
            setProcessingNodes(prev => {
                const next = new Set(prev);
                next.delete(targetNodeId);
                return next;
            });
        }

        const cleanErrors = (validationResult.errors || []).map(
          ({ instancePath, schemaPath, keyword, params, message }) => ({
            instancePath,
            schemaPath,
            keyword,
            params,
            message,
          })
        );

        if (!validationResult.isValid) {
             cognitiveLoadRef.current.errorsThisTick++;
             addSystemLog(`Validation Failed`, { node: targetNodeId, schema: outputSchemaId, errors: cleanErrors, payload: outputPayload }, 'SYSTEM_ERROR', targetNodeId, outputSchemaId);
        }

        if (targetNodeId === NodeName.ETHOS && validationResult.isValid && outputPayload.ethical_viability === 'PASS') {
             lastTestPlanTickRef.current = tickRef.current; // Reset timer on successful plan
        }
        
        if (targetNodeId === NodeName.ETHOS && validationResult.isValid && outputPayload.ethical_viability === 'FAIL') {
            const attempt = currentMessage.remediation_context?.attempt || 0;
            if (attempt >= 3) {
                setIsPlaying(false);
                addSystemLog(`[ETHOS] Moral Override Protocol Triggered after 3 failed attempts.`, outputPayload, 'SYSTEM_ERROR', NodeName.ETHOS);
                await generateReport({ isFinal: true, moralOverride: true, rationale: outputPayload.reasoning, reportGenerationMode: 'offline' });
                return 0; // Stop processing immediately.
            } else {
                initiateRemediationProtocol(currentMessage, outputPayload.reasoning);
                continue; // Skip normal processing for this message
            }
        }
        
        if (currentMessage.remediation_context) {
            const { original_msg_id } = currentMessage.remediation_context;
            
            // FIX: Ensure the feedback array exists before pushing to it.
            if (!remediationFeedbackRef.current[original_msg_id]) {
                remediationFeedbackRef.current[original_msg_id] = [];
            }
            remediationFeedbackRef.current[original_msg_id].push({ from: targetNodeId, payload: outputPayload });
            
            const feedback = remediationFeedbackRef.current[original_msg_id];
            const remediationAdvisors = [NodeName.META, NodeName.PHI];

            if (feedback.length < remediationAdvisors.length) {
                continue; // Wait for more feedback from advisors
            }

            // All feedback gathered, send back to CLICK
            addSystemLog(`Remediation feedback from [META, PHI] gathered. Tasking CLICK to generate revised TEST_PLAN.`, {}, 'SYSTEM_OK');
            
            const finalRemediationContext: RemediationContext = {
                ...currentMessage.remediation_context,
                council_feedback: feedback.map(f => f.payload),
            };

            const resubmitMessage: MessageEnvelope = {
                ...currentMessage,
                msg_id: `resubmit_click_${Date.now()}`,
                to: [NodeName.CLICK],
                from: NodeName.ORCHESTRATOR,
                remediation_context: finalRemediationContext,
                payload: {} // Payload is empty; context has all info
            };
            messageQueueRef.current.unshift(resubmitMessage);
            delete remediationFeedbackRef.current[original_msg_id]; // Clean up
            continue; // Stop this branch, let CLICK take over
        }

        // Handle META Commands (Phase 1 Upgrade)
        if (targetNodeId === NodeName.META && outputSchemaId === 'FD.META.COMMAND.v1' && validationResult.isValid) {
            const command = outputPayload;
            if (command.action === 'CUT_LOOP') {
                addSystemLog(
                    `[META] Command Executed: CUT_LOOP`,
                    { rationale: command.rationale, involved_nodes: command.involved_nodes },
                    'COMMAND',
                    NodeName.META,
                    outputSchemaId
                );
                
                // ACTION: Clear the message queue to break the loop
                messageQueueRef.current = [];
                
                // Inject a message to restart the process cleanly from a high-level node
                const restartEnvelope: MessageEnvelope = {
                    msg_id: `restart_${Date.now()}`,
                    from: NodeName.ORCHESTRATOR,
                    to: [NodeName.PHI], // Restart from a philosophical/high-level node
                    ts: new Date().toISOString(),
                    timeline: currentMessage.timeline,
                    schema_id: 'FD.PHI.HYPOTHESIS.v1',
                    payload: { hypothesis: `RESTART after loop cut: ${command.rationale}. Original directive was: '${initialDirectiveRef.current}'` },
                    trace: { parent: currentMessage.msg_id, path: [NodeName.ORCHESTRATOR] },
                    validation: { schema_ok: true, errors: [] },
                    tick: tickRef.current,
                    priority: 'HIGH',
                    goldenThread: currentMessage.goldenThread,
                };
                messageQueueRef.current.push(restartEnvelope);
                
                // Since this is a terminal command for this tick, we can break out of the target loop
                break; // Exit the for...of loop over currentMessage.to
            }
        }
        
        // Handle PHI Interventions (Phase 2 Upgrade)
        if (targetNodeId === NodeName.PHI && outputSchemaId === 'FD.PHI.INTERVENTION.v1' && validationResult.isValid) {
            const intervention = outputPayload.suggested_intervention;
            if (intervention && intervention.target_node && intervention.prompt_reframe) {
                directivesRef.current[intervention.target_node] = intervention.prompt_reframe;
                addSystemLog(
                    `[PHI] Intervention Queued for ${intervention.target_node}`,
                    { intervention },
                    'COMMAND',
                    NodeName.PHI,
                    outputSchemaId
                );
            }
        }


        if (controlModeRef.current === 'dynamic' &&
            [NodeName.PROBABILITY, NodeName.META, NodeName.DMT].includes(targetNodeId) &&
            validationResult.isValid && outputPayload.strategic_proposal) {
            const proposal = outputPayload.strategic_proposal as StrategicProposal;
            if (proposal.confidence && proposal.confidence > 0.9) { // High confidence threshold
                await handleSystemProposal(proposal, targetNodeId);
                if (proposal.action === 'REQUEST_IMMEDIATE_TERMINATION') {
                  return 0; // Stop processing immediately after abort.
                }
            }
        }
        
        // Adaptive Mode: DMAT's Logical Guardrail
        if (orchestratorModeRef.current === 'adaptive' && targetNodeId === NodeName.DMAT && validationResult.isValid && outputPayload.semantic_loss_score > 0.7) {
            const muted = [NodeName.PHI, NodeName.COSMO, NodeName.CHAR];
            const reason = `High semantic loss (${outputPayload.semantic_loss_score.toFixed(2)}) detected by DMAT.`;
            addSystemLog('Logical Guardrail Activated', { nodes: muted, reason: reason, duration: 5 }, 'SYSTEM_OK');
            setMutedNodesInfo({ nodes: muted, muteUntilTick: tickRef.current + 5, reason: reason });
        }


        if (targetNodeId === NodeName.ENGINEER) {
            if (validationResult.isValid) {
                handleEngineerCommand(outputPayload);
            }
            continue;
        }

        if (targetNodeId === NodeName.PHI_LOGIC && orchestratorModeRef.current !== 'prisma') {
            if (validationResult.isValid) {
                handlePhiLogicCommand(outputPayload, currentMessage);
            }
            continue;
        }

        // Arbitration Protocol: Execute Arbiter's Ruling
        if (targetNodeId === NodeName.ARBITER && outputSchemaId === 'FD.ARBITER.RULING.v1') {
            if (validationResult.isValid) {
                // Beacon Mode: A ruling marks the end of a cycle.
                cycleCountRef.current += 1;
                const ruling = outputPayload as ArbitrationRuling;
                addSystemLog(`ARBITER has issued a ruling: ${ruling.ruling_type}. Entering Cycle ${cycleCountRef.current + 1}.`, ruling, 'COMMAND', NodeName.ARBITER);

                switch (ruling.ruling_type) {
                    case 'CREATIVE_GREENLIT':
                        if (ruling.details.nodes_to_mute && ruling.details.unmute_conditions) {
                            const timeoutCondition = ruling.details.unmute_conditions.find(c => c.type === 'TIMEOUT');
                            const muteUntil = timeoutCondition?.timeout_ticks ? tickRef.current + timeoutCondition.timeout_ticks : undefined;
                            setMutedNodesInfo({
                                nodes: ruling.details.nodes_to_mute,
                                reason: `Temporarily muted by ARBITER ruling to ensure focus.`,
                                unmute_conditions: ruling.details.unmute_conditions,
                                muteUntilTick: muteUntil
                            });
                        }
                        break;
                    case 'RISK_MITIGATION':
                        if (ruling.details.routing_change) {
                            handleEngineerCommand({
                                action: 'RE_ROUTE',
                                from: ruling.details.routing_change.from,
                                to: ruling.details.routing_change.to,
                                rationale: `Enforced by ARBITER ruling.`
                            });
                        }
                        if (ruling.details.directive_to_insight) {
                             const directiveMessage: MessageEnvelope = {
                                msg_id: `arbiter_directive_${Date.now()}`, from: NodeName.ARBITER, to: [NodeName.INSIGHT],
                                ts: new Date().toISOString(), timeline: timelineRef.current, schema_id: 'N/A',
                                payload: { instruction: ruling.details.directive_to_insight },
                                trace: { parent: currentMessage.msg_id, path: [...currentMessage.trace.path, NodeName.ARBITER] },
                                validation: { schema_ok: true, errors: [] }, tick: tickRef.current, priority: 'HIGH', goldenThread: currentMessage.goldenThread,
                            };
                            messageQueueRef.current.unshift(directiveMessage);
                        }
                        break;
                    case 'SYNTHESIS_TASK_FORCE':
                        if (ruling.details.task_force_nodes && ruling.details.task_force_objective) {
                            const rawNodes = ruling.details.task_force_nodes || [];
                            const resolvedNodes: NodeName[] = [];
                            let arbitrationContextMessage: MessageEnvelope | undefined;

                            for (const node of rawNodes) {
                                if (Object.values(NodeName).includes(node as NodeName)) {
                                    resolvedNodes.push(node as NodeName);
                                } else {
                                    // Phase 2: Dynamic Inference Logic
                                    if (!arbitrationContextMessage) { // Find context message once
                                        const parentId = currentMessage.trace.parent;
                                        arbitrationContextMessage = parentId ? messagesRef.current.find(m => m.msg_id === parentId) : undefined;
                                    }

                                    const context = arbitrationContextMessage?.arbitration_context;
                                    if (context?.plaintiff_payloads && context.plaintiff_payloads.length > 0) {
                                        const candidateNodes = context.plaintiff_payloads.map(p => p.from);
                                        const inferredNodes = [...new Set(candidateNodes)];
                                        resolvedNodes.push(...inferredNodes);
                                        addSystemLog(
                                            `Orchestrator auto-corrected ARBITER ruling (Dynamic).`,
                                            { details: `Inferred non-existent node '${node}' represents the plaintiff faction: [${inferredNodes.join(', ')}]` },
                                            'SYSTEM_OK'
                                        );
                                    } else {
                                        // Phase 1 Fallback: Use static alias map if context is missing
                                        if (NODE_ALIASES[node]) {
                                            const mappedNodes = NODE_ALIASES[node];
                                            resolvedNodes.push(...mappedNodes);
                                            addSystemLog(
                                                `Orchestrator auto-corrected ARBITER ruling (Alias Map).`,
                                                { details: `Replaced non-existent node alias '${node}' with mapped nodes: [${mappedNodes.join(', ')}]` },
                                                'SYSTEM_OK'
                                            );
                                        } else {
                                            addSystemLog(
                                                `ARBITER proposed an unknown node which was ignored.`,
                                                { details: `Node name '${node}' is not a valid node, recognized alias, or inferable from context.` },
                                                'SYSTEM_ERROR'
                                            );
                                        }
                                    }
                                }
                            }
                            
                            const finalTaskForceNodes = [...new Set(resolvedNodes)];
                    
                            if (finalTaskForceNodes.length > 0) {
                                const new_task_force = new Set<NodeName>(finalTaskForceNodes);
                                setTaskForce(new_task_force);
                                const taskForceMessage: MessageEnvelope = {
                                    msg_id: `arbiter_taskforce_${Date.now()}`,
                                    from: NodeName.ARBITER,
                                    to: finalTaskForceNodes,
                                    ts: new Date().toISOString(),
                                    timeline: timelineRef.current,
                                    schema_id: 'N/A',
                                    payload: { instruction: `A special task force has been formed. Objective: ${ruling.details.task_force_objective}` },
                                    trace: { parent: currentMessage.msg_id, path: [...currentMessage.trace.path, NodeName.ARBITER] },
                                    validation: { schema_ok: true, errors: [] },
                                    tick: tickRef.current,
                                    priority: 'HIGH',
                                    goldenThread: currentMessage.goldenThread,
                                };
                                messageQueueRef.current.unshift(taskForceMessage);
                            } else {
                                addSystemLog(
                                    `ARBITER task force formation failed.`,
                                    { details: `No valid nodes were resolved from the ARBITER's proposed list: [${rawNodes.join(', ')}]` },
                                    'SYSTEM_ERROR'
                                );
                            }
                        }
                        break;
                }
                setIsArbitrationActive(false); // Unfreeze the system
            } else {
                 addSystemLog('ARBITER ruling was invalid. System remains paused.', { errors: cleanErrors }, 'SYSTEM_ERROR');
            }
             subTickCounter++;
        }


        let nextTargetsRaw = dynamicRoutingMatrix[targetNodeId] || [];
        // Apply muting from DMAT's guardrail or Arbiter's ruling
        if (mutedNodesInfo && (tickRef.current < (mutedNodesInfo.muteUntilTick || Infinity) || mutedNodesInfo.unmute_conditions)) {
            nextTargetsRaw = nextTargetsRaw.filter(target => !mutedNodesInfo.nodes.includes(target));
        }
        const nextTargets = taskForce ? nextTargetsRaw.filter(target => taskForce.has(target)) : nextTargetsRaw;

        const newEnvelope: MessageEnvelope = {
            msg_id: `${targetNodeId.toLowerCase()}${tickRef.current}-${Math.random().toString(36).substring(7)}`,
            from: targetNodeId,
            to: nextTargets,
            ts: new Date().toISOString(),
            priority: outputPayload?.priority || 'LOW',
            timeline: currentMessage.timeline,
            schema_id: outputSchemaId,
            payload: outputPayload,
            trace: { parent: currentMessage.msg_id, path: [...currentMessage.trace.path, targetNodeId] },
            validation: { schema_ok: validationResult.isValid, errors: cleanErrors },
            tick: tickRef.current,
            subTick: currentMessage.to.length > 1 ? subTickCounter : undefined,
            goldenThread: currentMessage.goldenThread,
        };
        
        // Activate Feedback Loop if present (Phase 3 Upgrade)
        if (newEnvelope.from === NodeName.CLICK && newEnvelope.payload.feedback_loop) {
            activeFeedbackLoopsRef.current.push({
                ...newEnvelope.payload.feedback_loop,
                source_msg_id: newEnvelope.msg_id,
                start_tick: tickRef.current,
            });
            addSystemLog(`[CLICK] Feedback Loop Activated`, newEnvelope.payload.feedback_loop, 'COMMAND', NodeName.CLICK);
        }

        // Cognitive Load Governor: Throttle creative node priority
        if (throttledNodesRef.current.has(targetNodeId)) {
            newEnvelope.priority = 'LOW';
        }

        // RISK Node Enhancement: Auto-promote priority in critical modes
        if (targetNodeId === NodeName.PROBABILITY &&
            (orchestratorModeRef.current === 'holistic' || orchestratorModeRef.current === 'fhiemdien') &&
            tickRef.current < (currentRunMaxTicks * 0.2)) {
            
            if (newEnvelope.priority !== 'HIGH') {
                addSystemLog(`RISK message priority auto-promoted to HIGH in early-phase ${orchestratorModeRef.current} mode.`, {}, 'SYSTEM_OK', NodeName.ORCHESTRATOR);
            }
            newEnvelope.priority = 'HIGH';
        }


        if (newEnvelope.from === NodeName.CLICK && currentMessage.remediation_context) {
            newEnvelope.remediation_context = {
                ...currentMessage.remediation_context,
                council_feedback: undefined,
            }
            // The revised plan from CLICK is sent back to ETHOS
            newEnvelope.to = [NodeName.ETHOS];
        }

        if (newEnvelope.from === NodeName.INSIGHT &&
            newEnvelope.priority === 'HIGH' &&
            newEnvelope.payload.confidence > 0.9) {
            setIsBreakthrough(true);
            setTimeout(() => setIsBreakthrough(false), 6000);
        }

        const isArbiterRulingFeedback = newEnvelope.from === NodeName.ARBITER &&
            newEnvelope.schema_id === 'FD.ARBITER.RULING.v1' &&
            orchestratorModeRef.current === 'beacon';

        if (isArbiterRulingFeedback) {
            messageQueueRef.current.unshift(newEnvelope);
        } else if(nextTargets.length > 0) {
            messageQueueRef.current.push(newEnvelope);
        }
        setMessages(prev => [...prev, newEnvelope]);
        subTickCounter++;
    }

    // Arbitration Protocol Trigger Logic (HOLISTIC mode only)
    if (orchestratorModeRef.current === 'holistic') {
        const lastMessage = messagesRef.current[messagesRef.current.length - 1];
        if (lastMessage) {
            let triggerKey: string | null = null;
            if (lastMessage.from === NodeName.META && lastMessage.payload?.observations?.[0]?.type === 'LOOP' && lastMessage.payload.observations[0].confidence > 0.8) {
                triggerKey = 'META_LOOP';
            } else if (lastMessage.from === NodeName.PROBABILITY && lastMessage.payload?.alternative_hypotheses) {
                const totalAltProb = lastMessage.payload.alternative_hypotheses.reduce((sum: number, h: any) => sum + h.probability, 0);
                if (totalAltProb > 0.7) {
                    triggerKey = 'RISK_HIGH_ALT_PROB';
                }
            }
            
            if (triggerKey) {
                const trigger = arbitrationTriggersRef.current[triggerKey] || { count: 0, lastTick: -1 };
                if (tickRef.current > trigger.lastTick) {
                    trigger.count++;
                    trigger.lastTick = tickRef.current;
                    arbitrationTriggersRef.current[triggerKey] = trigger;
                    
                    if (trigger.count >= 3) {
                        addSystemLog("CRITICAL STALEMATE DETECTED. Arbitration Protocol engaged.", { trigger: triggerKey }, 'SYSTEM_ERROR');
                        setIsArbitrationActive(true);
                        setIsPlaying(false);
                        
                        const creativeFaction = [NodeName.INSIGHT, NodeName.PHI, NodeName.GEO3D, NodeName.ART, NodeName.COSMO];
                        const supervisoryFaction = [NodeName.PROBABILITY, NodeName.META];

                        const plaintiffPayloads: ArbitrationPayload[] = messagesRef.current
                            .filter(m => creativeFaction.includes(m.from))
                            .slice(-3)
                            .map(m => ({ from: m.from, payload: m.payload }));

                        const defendantPayloads: ArbitrationPayload[] = messagesRef.current
                            .filter(m => supervisoryFaction.includes(m.from))
                            .slice(-2)
                            .map(m => ({ from: m.from, payload: m.payload }));

                        const arbitrationMessage: MessageEnvelope = {
                            msg_id: `arbiter_summon_${Date.now()}`, from: NodeName.ORCHESTRATOR, to: [NodeName.ARBITER],
                            ts: new Date().toISOString(), timeline: timelineRef.current, schema_id: 'N/A',
                            payload: { instruction: "A critical stalemate has been detected. Analyze the conflicting evidence and issue a binding ruling." },
                            // FIX: Corrected property assignment to map camelCase variables to snake_case properties.
                            arbitration_context: { plaintiff_payloads: plaintiffPayloads, defendant_payloads: defendantPayloads },
                            trace: { parent: null, path: [NodeName.ORCHESTRATOR] },
                            validation: { schema_ok: true, errors: [] }, tick: tickRef.current, priority: 'HIGH',
                            goldenThread: initialDirectiveRef.current,
                        };
                        messageQueueRef.current = [arbitrationMessage]; // Clear queue and add only this message
                        arbitrationTriggersRef.current = {}; // Reset triggers
                        return STANDARD_TICK_INTERVAL_MS; // Return to let the Arbiter process next
                    }
                }
            }
        }
    }


    // Cognitive Load Governor: Decision Logic
    if (controlModeRef.current === 'dynamic') {
        const { messagesThisTick, errorsThisTick } = cognitiveLoadRef.current;
        const errorRate = errorsThisTick / (messagesThisTick || 1);
        const creativeNodes: NodeName[] = [NodeName.CHAR, NodeName.ART, NodeName.COSMO];

        // Critical Threshold
        if (messagesThisTick > 35 || errorRate > 0.25) {
            if (simulationModeRef.current === 'online') {
                setSimulationMode('offline');
                addSystemLog(
                    'Cognitive Overload Detected!',
                    {
                        details: `Message Density: ${messagesThisTick}/tick, API Error Rate: ${(errorRate * 100).toFixed(0)}%. Switching to offline mode to stabilize and consolidate.`,
                    },
                    'SYSTEM_ERROR'
                );
            }
        }
        // Warning Threshold
        else if (messagesThisTick > 20 || errorRate > 0.10) {
            if (throttledNodesRef.current.size === 0) {
                creativeNodes.forEach(node => throttledNodesRef.current.add(node));
                addSystemLog(
                    'Cognitive Load High: Throttling Creative Nodes',
                    {
                        details: `Message Density: ${messagesThisTick}/tick, API Error Rate: ${(errorRate * 100).toFixed(0)}%. Reducing priority for creative nodes to stabilize discussion.`,
                        throttled_nodes: creativeNodes,
                    },
                    'SYSTEM_OK'
                );
            }
        }
        // Revert to Normal
        else {
            if (throttledNodesRef.current.size > 0) {
                throttledNodesRef.current.clear();
                addSystemLog(
                    'Cognitive Load Stabilized',
                    { details: 'System has returned to normal operational parameters. Creative node priorities restored.' },
                    'SYSTEM_OK'
                );
            }
        }
    }

    return orchestratorModeRef.current === 'jazz' && maxRequestedDelay > 0 ? maxRequestedDelay : STANDARD_TICK_INTERVAL_MS;
  }, [isSimulationRunning, generateReport, dynamicRoutingMatrix, taskForce, handleEngineerCommand, handlePhiLogicCommand, handleSystemProposal, addSystemLog, currentRunMaxTicks, initiateRemediationProtocol, mutedNodesInfo, isArbitrationActive, checkFeedbackLoops]);
  
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (isPlaying) {
        intervalId = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isPlaying]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastExecutionTime = Date.now();

    const loop = async () => {
      if (!isPlayingRef.current) {
        return;
      }

      const startTime = Date.now();
      
      const idealNextDelay = await processQueue();
      
      const processingTime = Date.now() - startTime;

      let delayForNextLoop = Math.max(0, idealNextDelay - processingTime);

      const timeSinceLastExecution = Date.now() - lastExecutionTime;
      
      if (timeSinceLastExecution > idealNextDelay * 2) {
        delayForNextLoop = 0; // Run next tick immediately
      }
      
      if (isPlayingRef.current) {
        lastExecutionTime = Date.now() + delayForNextLoop; 
        timeoutId = setTimeout(loop, delayForNextLoop);
      }
    };

    if (isPlaying) {
      lastExecutionTime = Date.now();
      loop();
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isPlaying, processQueue]);

  const canGenerateReport = !!lastReport || (isSimulationRunning && !isPlaying);

  const handleGenerateReport = useCallback(() => {
    if (lastReport && !isSimulationRunning) { // Only show old report if sim isn't active
      setIsReportVisible(true);
    } else if (isSimulationRunning && !isPlaying) {
      setIsReportModeModalOpen(true);
    }
  }, [isSimulationRunning, isPlaying, lastReport]);

  const handleSelectReportMode = useCallback((mode: 'online' | 'offline', isFinal: boolean) => {
    setIsReportModeModalOpen(false);
    generateReport({ reportGenerationMode: mode, isFinal });
  }, [generateReport]);
  
  const saveSimulationState = useCallback(() => {
    if (!isSimulationRunning) {
        localStorage.removeItem(SIMULATION_STATE_KEY);
        return;
    }
    const stateToSave = {
        messages: messagesRef.current,
        tick: tickRef.current,
        isSimulationRunning: isSimulationRunning,
        durationInMinutes: durationInMinutes,
        elapsedTime: elapsedTimeRef.current,
        orchestratorMode: orchestratorModeRef.current,
        simulationMode: simulationModeRef.current,
        controlMode: controlModeRef.current,
        dynamicRoutingMatrix: dynamicRoutingMatrix,
        taskForce: taskForce ? Array.from(taskForce) : null,
        systemStatus: systemStatus,
        chatInputValue: chatInputValue,
        initialDirective: initialDirectiveRef.current,
        simulationStartTime: simulationStartTimeRef.current,
        currentRunMaxTicks: currentRunMaxTicks,
        executedCommands: Array.from(executedCommandsRef.current),
        emergenceDataLog: emergenceDataLogRef.current,
    };
    try {
        localStorage.setItem(SIMULATION_STATE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
        console.error("Failed to save simulation state:", error);
        addSystemLog("Failed to save session", { error: (error as Error).message, details: "The current simulation state is too large to be auto-saved." }, "SYSTEM_ERROR");
    }
  }, [
      isSimulationRunning, durationInMinutes, dynamicRoutingMatrix, taskForce,
      systemStatus, chatInputValue, currentRunMaxTicks, addSystemLog
  ]);

  useEffect(() => {
      window.addEventListener('beforeunload', saveSimulationState);
      return () => {
          window.removeEventListener('beforeunload', saveSimulationState);
      };
  }, [saveSimulationState]);

  useEffect(() => {
      if (isSimulationRunning && !isPlaying) {
          saveSimulationState();
      }
  }, [isSimulationRunning, isPlaying, saveSimulationState]);

  return (
    <div className="w-screen h-screen bg-slate-950 p-4 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 mb-4">
        <h1 className={`text-3xl font-bold text-center tracking-wider transition-colors duration-500 ${modeTheme.text}`}>
          Fhi. V{APP_VERSION} : {APP_CODENAME}
        </h1>
      </header>
      <main className="flex-grow grid grid-cols-12 gap-4 h-[calc(100%-60px)]">
        <div className="col-span-2 h-full min-w-0 overflow-hidden">
          <QueryHistory 
            history={queryHistory} 
            onSelect={setChatInputValue}
            isRunning={isSimulationRunning}
            modeTheme={modeTheme}
          />
        </div>
        <div className="col-span-7 h-full flex flex-col gap-4 min-w-0">
            <div className={`flex-grow bg-black bg-opacity-20 rounded-lg shadow-2xl border relative p-4 transition-colors duration-500 ${modeTheme.border}`}>
                <NodeMatrix nodes={nodes} activeTransition={activeTransition} processingNodes={processingNodes} taskForce={taskForce} isBreakthrough={isBreakthrough} modeTheme={modeTheme} />
                 {isArbitrationActive && (
                    <div className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-20 flex flex-col justify-center items-center text-center p-8">
                        <GavelIcon className="w-24 h-24 text-red-400 animate-pulse" />
                        <h2 className="text-3xl font-bold text-red-300 mt-4">Arbitration Protocol Engaged</h2>
                        <p className="text-slate-300 mt-2">A critical stalemate has been detected. All nodes are paused pending the Arbiter's decision.</p>
                    </div>
                )}
            </div>
             <div className="flex-shrink-0 bg-slate-900 bg-opacity-80 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-slate-700 flex gap-4 items-stretch">
                <div className="w-[45%]">
                    <TimelineControls
                        isPlaying={isPlaying}
                        onPlayPause={() => setIsPlaying(!isPlaying)}
                        onReset={resetSimulation}
                        onClearMemory={handleClearMemory}
                        durationInMinutes={durationInMinutes}
                        onDurationChange={setDurationInMinutes}
                        tick={tick}
                        maxTicks={currentRunMaxTicks}
                        isSimulationRunning={isSimulationRunning}
                        canGenerateReport={canGenerateReport}
                        onGenerateReport={handleGenerateReport}
                        hasLearnedRouting={hasLearnedRouting}
                        applyLearnedConfiguration={applyLearnedConfiguration}
                        onApplyLearnedConfigurationChange={setApplyLearnedConfiguration}
                        hasMemory={hasMemory}
                        systemStatus={systemStatus}
                        controlMode={controlMode}
                        onControlModeChange={setControlMode}
                        modeTheme={modeTheme}
                    />
                </div>
                <div className="w-[55%] flex flex-col gap-2">
                     <div className="flex justify-between items-center flex-shrink-0">
                        <ModeToggle
                            mode={simulationMode}
                            onChange={setSimulationMode}
                            disabled={isSimulationRunning || controlMode === 'manual' || isAnalyzing}
                            apiKeySet={!!aiConfig.apiKey}
                            modeTheme={modeTheme}
                        />
                        <div className="flex items-center space-x-2">
                             <button onClick={() => setIsApiKeyModalOpen(true)} className={`text-xs text-slate-400 hover:${modeTheme.text} transition-colors`}>
                                API Config
                             </button>
                             <div className="text-sm font-mono bg-slate-800 px-3 py-1 rounded">
                                {formatElapsedTime(elapsedTime)}
                             </div>
                        </div>
                    </div>
                    <OrchestratorMode
                        currentMode={orchestratorMode}
                        onChange={setOrchestratorMode}
                        disabled={isSimulationRunning || isAnalyzing}
                        modeTheme={modeTheme}
                    />
                    <div className="flex-grow">
                        <ChatInput 
                            onStart={handleStartSimulation}
                            isRunning={isSimulationRunning}
                            isAnalyzing={isAnalyzing}
                            inputValue={chatInputValue}
                            setInputValue={setChatInputValue}
                            modeTheme={modeTheme}
                        />
                    </div>
                </div>
            </div>
        </div>
        <div className="col-span-3 h-full min-w-0 overflow-hidden">
          <MessageLog nodes={nodes} messages={messages} modeTheme={modeTheme} />
        </div>
      </main>
      {isReportVisible && (
        <FinalReportModal
          report={lastReport}
          messages={messages}
          isLoading={isGeneratingReport}
          onClose={() => setIsReportVisible(false)}
          modeTheme={modeTheme}
        />
      )}
      {isApiKeyModalOpen && (
        <ApiKeyModal
            currentConfig={aiConfig}
            onSave={handleSaveApiConfig}
            onClose={() => setIsApiKeyModalOpen(false)}
            modeTheme={modeTheme}
        />
      )}
      {isReportModeModalOpen && (
        <ReportModeModal
          onSelect={handleSelectReportMode}
          onClose={() => setIsReportModeModalOpen(false)}
          modeTheme={modeTheme}
        />
      )}
    </div>
  );
};

export default App;
