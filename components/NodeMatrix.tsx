import React, { useState, useEffect } from 'react';
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
    [NodeName.SCI]: TestTubeIcon,
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
    [NodeName.QTM]: AtomIcon,
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
        NodeName.ARBITER, NodeName.PROBABILITY, NodeName.ENGINEER, 
        // FIX: Replaced non-existent `DMT` node with `QTM` to correctly position it on the graph.
        NodeName.QTM,
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

const TransitionLine: React.FC<{ sourceId: NodeName; targetId: NodeName; modeTheme: Record<string, string> }> = ({ sourceId, targetId, modeTheme }) => {
  const [coords, setCoords] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);

  useEffect(() => {
    const sourceEl = document.getElementById(`node-${sourceId}`);
    const targetEl = document.getElementById(`node-${targetId}`);
    const parentEl = sourceEl?.parentElement;

    if (sourceEl && targetEl && parentEl) {
      const parentRect = parentEl.getBoundingClientRect();
      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      const x1 = sourceRect.left + sourceRect.width / 2 - parentRect.left;
      const y1 = sourceRect.top + sourceRect.height / 2 - parentRect.top;
      let x2 = targetRect.left + targetRect.width / 2 - parentRect.left;
      let y2 = targetRect.top + targetRect.height / 2 - parentRect.top;

      setCoords({ x1, y1, x2, y2 });
    }
  }, [sourceId, targetId]);

  if (!coords) return null;

  return (
    <g>
      {/* The faint, underlying trail */}
      <line
        x1={coords.x1}
        y1={coords.y1}
        x2={coords.x2}
        y2={coords.y2}
        stroke={`rgba(var(--accent-rgb), 0.3)`}
        strokeWidth="2"
        filter="url(#glow)"
      >
        <animate attributeName="opacity" from="1" to="0" dur="1.2s" begin="0s" fill="freeze" />
      </line>

      {/* The bright, traveling pulse */}
      <circle r="4" fill={`rgba(var(--accent-light-rgb), 1)`} filter="url(#glow)">
        <animateMotion
          path={`M${coords.x1},${coords.y1} L${coords.x2},${coords.y2}`}
          dur="0.6s"
          begin="0s"
          fill="freeze"
          calcMode="spline"
          keyTimes="0; 1"
          keySplines="0.4 0 0.2 1"
        />
        <animate attributeName="r" from="5" to="0" dur="0.6s" begin="0s" fill="freeze" />
        <animate attributeName="opacity" from="1" to="0" dur="0.6s" begin="0.2s" fill="freeze" />
      </circle>
    </g>
  );
};


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
  // "Thinking" state: yellow pulse
  const processingGlow = 'animate-pulse border-yellow-300 shadow-[0_0_25px_8px_rgba(253,224,71,0.7)]';
  // "Finished/Sending" state: a distinct, consistent cyan blue
  const sendingGlow = `shadow-[0_0_20px_5px_rgba(var(--accent-rgb),0.7)] border-[rgb(var(--accent-rgb))]`;
  
  let glow = idleGlow;
  if (isProcessing) {
    glow = processingGlow;
  } else if (isSending || isReceiving) {
    glow = sendingGlow;
  }
  
  const sizeClass = isCentral ? "w-28 h-28" : "w-20 h-20";
  const labelSizeClass = isCentral ? "text-sm" : "text-xs";
  const iconSizeClass = isCentral ? "w-8 h-8" : "w-7 h-7";

  const isHighlighted = isSending || isReceiving || isProcessing;
  
  const finalGlow = (isCentral && isBreakthrough) ? 'animate-breakthrough-pulse' : glow;

  return (
    <div
      id={`node-${node.id}`}
      className={`absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${sizeClass} ${finalGlow}`}
      style={{ 
        ...pos, 
        transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out, box-shadow 0.3s ease-in-out, border-color 0.3s ease-in-out',
        opacity: isDimmed && !isHighlighted ? 0.2 : 1,
        transform: `translate(-50%, -50%) scale(${isSending || isReceiving ? 1.1 : 1})`,
        borderRadius: '50%',
        backgroundColor: 'rgba(15, 23, 42, 0.8)', // slate-900 with opacity
        backdropFilter: 'blur(4px)',
        borderWidth: '2px',
      }}
      title={node.description}
    >
      {isCentral && isBreakthrough && <div className="breakthrough-wave"></div>}
      {IconComponent && <IconComponent className={`mb-1 transition-colors duration-300 ${iconSizeClass} ${isHighlighted ? modeTheme.text : 'text-slate-400'}`} />}
      <span className={`font-bold transition-colors duration-300 ${labelSizeClass} ${isHighlighted ? 'text-white' : 'text-slate-400'}`}>{node.label}</span>
    </div>
  );
};


const NodeMatrix: React.FC<NodeMatrixProps> = ({ nodes, activeTransition, processingNodes, taskForce, isBreakthrough, modeTheme }) => {

  const isNodeDimmed = (nodeId: NodeName) => {
    if (!taskForce) return false; // No one is dimmed if no task force is active
    return !taskForce.has(nodeId);
  };
  
  return (
    <div className="relative w-full h-full">
      {/* Render Nodes */}
      {nodes.filter(node => NODE_POSITIONS[node.id]).map(node => (
        <DynamicNodeCard
          key={node.id}
          node={node}
          pos={NODE_POSITIONS[node.id]}
          isSending={activeTransition?.source === node.id}
          isReceiving={activeTransition?.target === node.id}
          isProcessing={processingNodes.has(node.id)}
          isDimmed={isNodeDimmed(node.id)}
          isBreakthrough={isBreakthrough}
          modeTheme={modeTheme}
        />
      ))}

      {/* Render a single active transition line */}
      {activeTransition && (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <TransitionLine
            sourceId={activeTransition.source}
            targetId={activeTransition.target}
            modeTheme={modeTheme}
          />
        </svg>
      )}
    </div>
  );
};

export default NodeMatrix;