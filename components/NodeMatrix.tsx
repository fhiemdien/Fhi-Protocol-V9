import React from 'react';
import type { Node, ActiveTransition } from '../types';
import { NodeName } from '../types';
import { 
    ShieldCheckIcon, BrainIcon, AtomIcon, ChipIcon, DatabaseIcon, PaintBrushIcon,
    SignalIcon, SigmaIcon, ChartBarIcon, GavelIcon, NetworkIcon, PenNibIcon,
    HeartbeatIcon, GalaxyIcon, CubeIcon, HistoryIcon, LightbulbIcon, DiceIcon, WrenchIcon, BalanceIcon,
    TestTubeIcon, CursorClickIcon
} from './icons';

interface NodeMatrixProps {
  nodes: Node[];
  activeTransition: ActiveTransition | null;
  processingNodes: Set<NodeName>;
  taskForce: Set<NodeName> | null;
  isBreakthrough: boolean;
  modeTheme: Record<string, string>;
}

const NODE_ICONS: Record<NodeName, React.FC<{ className?: string }> | null> = {
    [NodeName.PHI]: BrainIcon,
    [NodeName.SCI]: AtomIcon,
    [NodeName.TECH]: ChipIcon,
    [NodeName.INFO]: DatabaseIcon,
    [NodeName.ART]: PaintBrushIcon,
    [NodeName.PHI_LOGIC]: ShieldCheckIcon,
    [NodeName.DMAT]: SignalIcon,
    [NodeName.MATH]: SigmaIcon,
    [NodeName.DATA]: ChartBarIcon,
    [NodeName.ARBITER]: GavelIcon,
    [NodeName.META]: NetworkIcon,
    [NodeName.CHAR]: PenNibIcon,
    [NodeName.MONITOR]: HeartbeatIcon,
    [NodeName.COSMO]: GalaxyIcon,
    [NodeName.GEO3D]: CubeIcon,
    [NodeName.MEMORY]: HistoryIcon,
    [NodeName.INSIGHT]: LightbulbIcon,
    [NodeName.PROBABILITY]: DiceIcon,
    [NodeName.ENGINEER]: WrenchIcon,
    [NodeName.ETHOS]: BalanceIcon,
    [NodeName.DMT]: TestTubeIcon,
    [NodeName.CLICK]: CursorClickIcon,
    [NodeName.ORCHESTRATOR]: null,
    [NodeName.HUMAN]: null, // No icon for the abstract human input
};


// A 20-node, two-ring hierarchical layout with INSIGHT at the center
const getHierarchicalLayout = () => {
    const positions: Record<string, { top: string; left: string; }> = {};
    const centerNode = NodeName.INSIGHT;
    
    // Core processing nodes
    const innerRingNodes: NodeName[] = [
        NodeName.PHI, NodeName.SCI, NodeName.MATH, NodeName.TECH, 
        NodeName.DATA, NodeName.INFO, NodeName.ART, NodeName.MEMORY
    ];
    
    // Specialized and meta nodes, including the new ETHOS and DMT nodes
    const outerRingNodes: NodeName[] = [
        NodeName.ETHOS, NodeName.COSMO, NodeName.GEO3D, NodeName.CHAR, 
        NodeName.DMAT, NodeName.PHI_LOGIC, NodeName.META, NodeName.MONITOR, 
        NodeName.ARBITER, NodeName.PROBABILITY, NodeName.ENGINEER, NodeName.DMT,
        NodeName.CLICK
    ];

    // Place INSIGHT at the center
    positions[centerNode] = { top: '50%', left: '50%' };
    
    const centerX = 50; // in percentage
    const centerY = 50; // in percentage

    // Layout Inner Ring (8 nodes)
    const innerRadiusX = 25;
    const innerRadiusY = 22;
    const innerAngleStep = 360 / innerRingNodes.length;
    innerRingNodes.forEach((nodeId, index) => {
        const angle = innerAngleStep * index - 90; // Start from top
        const angleRad = (angle * Math.PI) / 180;
        const x = centerX + innerRadiusX * Math.cos(angleRad);
        const y = centerY + innerRadiusY * Math.sin(angleRad);
        positions[nodeId] = { top: `${y}%`, left: `${x}%` };
    });

    // Layout Outer Ring
    const outerRadiusX = 46;
    const outerRadiusY = 42;
    const outerAngleStep = 360 / outerRingNodes.length;
    outerRingNodes.forEach((nodeId, index) => {
        const angle = outerAngleStep * index - 90; // Start from top
        const angleRad = (angle * Math.PI) / 180;
        const x = centerX + outerRadiusX * Math.cos(angleRad);
        const y = centerY + outerRadiusY * Math.sin(angleRad);
        positions[nodeId] = { top: `${y}%`, left: `${x}%` };
    });
    
    return positions;
};

const NODE_POSITIONS = getHierarchicalLayout();

const DynamicNodeCard: React.FC<{
  node: Node;
  pos: { top: string, left: string };
  isSending: boolean;
  isReceiving: boolean;
  isProcessing: boolean;
  isDimmed: boolean;
  isBreakthrough: boolean;
  modeTheme: Record<string, string>;
}> = ({ node, pos, isSending, isReceiving, isProcessing, isDimmed, isBreakthrough, modeTheme }) => {
  
  const isCentral = node.id === NodeName.INSIGHT;
  const IconComponent = NODE_ICONS[node.id];
  
  // Define glow states
  const idleGlow = 'shadow-[0_0_12px_2px_rgba(51,65,85,0.6)] border-slate-700';
  // "Thinking" state: yellow pulse, as requested.
  const processingGlow = 'animate-pulse border-yellow-300 shadow-[0_0_25px_8px_rgba(253,224,71,0.7)]';
  // "Finished/Sending" state: a distinct, consistent cyan blue, as requested.
  const sendingGlow = 'shadow-[0_0_20px_5px_rgba(6,182,212,0.7)] border-cyan-500';
  // "Receiving" state: uses the current mode's theme color.
  const receivingGlow = `shadow-[0_0_20px_5px_rgba(var(--accent-rgb),0.7)] ${modeTheme.border}`;

  const glowClass = isBreakthrough
    ? 'animate-breakthrough-pulse border-yellow-300' // Breakthrough overrides all
    : isProcessing 
    ? processingGlow // Highest priority after breakthrough
    : isSending 
    ? sendingGlow
    : isReceiving 
    ? receivingGlow 
    : idleGlow;

  const cardSize = isCentral ? 'w-40 h-28' : 'w-32 h-22';
  const titleSize = isCentral ? 'text-xl' : 'text-base';
  const descriptionSize = isCentral ? 'text-sm' : 'text-xs';
  const dimmedClass = isDimmed ? 'opacity-40' : 'opacity-100';

  const style = {
      top: pos.top,
      left: pos.left,
      transform: 'translate(-50%, -50%)',
  };

  return (
    <div
      className={`absolute z-10 bg-slate-900 bg-opacity-60 backdrop-blur-md rounded-lg border transition-all duration-300 flex flex-col justify-center items-center p-2 text-center ${glowClass} ${cardSize} ${dimmedClass}`}
      style={style}
    >
      <div className={`font-bold ${modeTheme.text} ${titleSize} flex items-center justify-center gap-2`}>
        {IconComponent && <IconComponent className="w-5 h-5 flex-shrink-0" />}
        <span>{node.label}</span>
      </div>
      <div className={`text-slate-400 mt-1 ${descriptionSize}`}>{node.description.split(',')[0]}</div>
    </div>
  );
};


const NodeMatrix: React.FC<NodeMatrixProps> = ({ nodes, activeTransition, processingNodes, taskForce, isBreakthrough, modeTheme }) => {
  return (
    <div className="w-full h-full relative">
       {isBreakthrough && (
        <>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
            <div className="breakthrough-wave" style={{ transformOrigin: 'center' }}></div>
            <div className="breakthrough-wave" style={{ animationDelay: '1s', transformOrigin: 'center' }}></div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[220px] text-4xl font-bold text-yellow-200 animate-fade-in-out tracking-widest uppercase pointer-events-none z-20">
            Breakthrough
          </div>
        </>
      )}
      {nodes.map(node => {
        const pos = NODE_POSITIONS[node.id] || { top: '10%', left: '10%' }; // Default fallback
        const isDimmed = taskForce !== null && !taskForce.has(node.id);
        const isCentral = node.id === NodeName.INSIGHT;
        
        // Determine node states for visual feedback
        const isSending = activeTransition?.source === node.id;
        const isReceiving = activeTransition?.target === node.id;

        return (
            <DynamicNodeCard
              key={node.id}
              node={node}
              pos={pos}
              isSending={isSending}
              isReceiving={isReceiving}
              isProcessing={processingNodes.has(node.id)}
              isDimmed={isDimmed}
              isBreakthrough={isBreakthrough && isCentral}
              modeTheme={modeTheme}
            />
        );
       })}
    </div>
  );
};

export default NodeMatrix;