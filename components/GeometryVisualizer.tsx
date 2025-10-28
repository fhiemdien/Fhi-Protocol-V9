import React, { useRef, useEffect } from 'react';

interface GeometryVisualizerProps {
  geometryData: any;
  modeTheme: Record<string, string>;
  onClose: () => void;
}

const GeometryVisualizer: React.FC<GeometryVisualizerProps> = ({ geometryData, modeTheme, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    
    const accentColor = `rgba(${modeTheme.rgb}, 0.8)`;
    const glowColor = `rgba(${modeTheme.lightRgb}, 0.6)`;

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = glowColor;

    const drawFractalTree = (x: number, y: number, angle: number, depth: number, len: number) => {
      if (depth === 0) return;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      const newX = x + len * Math.cos(angle);
      const newY = y + len * Math.sin(angle);
      ctx.lineTo(newX, newY);
      ctx.stroke();
      
      // Draw branches immediately and synchronously
      drawFractalTree(newX, newY, angle - Math.PI / 8, depth - 1, len * 0.8);
      drawFractalTree(newX, newY, angle + Math.PI / 8, depth - 1, len * 0.8);
    };

    const drawTopologyGraph = () => {
        const { nodes = [], edges = [] } = geometryData.topology_map || {};
        if (nodes.length === 0) return;

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;
        const positions: { [key: string]: { x: number; y: number } } = {};
        
        nodes.forEach((nodeId: string, index: number) => {
            const angle = (index / nodes.length) * 2 * Math.PI;
            positions[nodeId] = {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            };
        });
        
        // Draw nodes
        ctx.fillStyle = accentColor;
        for (const nodeId of nodes) {
            const pos = positions[nodeId];
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Draw edges
        let edgeIndex = 0;
        const drawEdge = () => {
            if (edgeIndex >= edges.length) return;
            const edge = edges[edgeIndex];
            const sourcePos = positions[edge.source];
            const targetPos = positions[edge.target];
            if (sourcePos && targetPos) {
                ctx.beginPath();
                ctx.moveTo(sourcePos.x, sourcePos.y);
                ctx.lineTo(targetPos.x, targetPos.y);
                ctx.stroke();
            }
            edgeIndex++;
            animationFrameId.current = requestAnimationFrame(drawEdge);
        };
        drawEdge();
    };

    ctx.clearRect(0, 0, width, height);

    if (geometryData.geometry_type?.toLowerCase().includes('fractal') || geometryData.generation_rule?.toLowerCase().includes('fractal')) {
      const startLength = Math.min(width, height) / 10;
      drawFractalTree(width / 2, height, -Math.PI / 2, 7, startLength);
    } else if (geometryData.topology_map) {
      drawTopologyGraph();
    }
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };

  }, [geometryData, modeTheme]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 z-40 flex flex-col justify-center items-center animate-fade-in"
      onClick={onClose}
    >
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
      <canvas ref={canvasRef} className="w-3/4 h-3/4 max-w-[800px] max-h-[600px]"></canvas>
       <div className={`mt-4 text-xl font-bold tracking-widest uppercase ${modeTheme.text}`} style={{ textShadow: `0 0 10px rgba(${modeTheme.lightRgb}, 0.7)` }}>
        {geometryData.geometry_type || 'Geometric Model'}
      </div>
    </div>
  );
};

export default GeometryVisualizer;