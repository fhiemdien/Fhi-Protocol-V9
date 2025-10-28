import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { MessageEnvelope, Node, NodeName } from '../types';

interface MessageLogProps {
  messages: MessageEnvelope[];
  nodes: Node[];
  modeTheme: Record<string, string>;
}

const LogEntry: React.FC<{ message: MessageEnvelope; nodeLabelMap: Record<string, string>; modeTheme: Record<string, string> }> = ({ message, nodeLabelMap, modeTheme }) => {
  const [isOpen, setIsOpen] = useState(false);

  const fromColor = "text-yellow-400";
  const toColor = "text-green-400";

  const getBorderColor = () => {
    switch (message.logType) {
      case 'SYSTEM_ERROR':
        return 'border-red-500';
      case 'SYSTEM_OK':
        return 'border-green-500';
      // FIX: Add a distinct border color for COMMAND log types for better UI feedback.
      case 'COMMAND':
        return 'border-blue-500';
      default:
        return message.validation.schema_ok ? modeTheme.border : 'border-orange-500';
    }
  };

  const isSystemMessage = message.logType === 'SYSTEM_ERROR' || message.logType === 'SYSTEM_OK' || message.logType === 'COMMAND';

  const stepDisplay = typeof message.tick === 'number'
    ? message.subTick
      // FIX: Corrected typo `message.g/subTick` to `message.subTick` to properly display the sub-tick number.
      ? `#${message.tick}.${message.subTick}`
      : `#${message.tick}`
    : '#-';
  
  const fromLabel = nodeLabelMap[message.from] || message.from;
  const toLabels = message.to.map(id => nodeLabelMap[id] || id).join(', ');


  return (
    <div className={`bg-slate-800 bg-opacity-70 border-l-4 ${getBorderColor()} p-3 rounded-r-md mb-2 text-sm font-mono`}>
      <div className="flex justify-between items-center cursor-pointer gap-2" onClick={() => setIsOpen(!isOpen)}>
        {isSystemMessage ? (
           <div className="min-w-0">
             <span className="font-bold mr-2">{message.logType === 'COMMAND' ? `[${fromLabel}]` : fromLabel}</span>
             <span className="text-slate-400 truncate">{message.payload.summary || message.payload.rationale}</span>
           </div>
        ) : (
          <div className="min-w-0 truncate">
            <span className="font-bold mr-2">{stepDisplay}</span>
            <span className={fromColor}>{fromLabel}</span>
            <span className="text-slate-400 mx-2">→</span>
            <span className={toColor}>{toLabels}</span>
          </div>
        )}
        <div className="flex-shrink-0 text-xs text-slate-500">{new Date(message.ts).toLocaleTimeString()}</div>
      </div>
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(message.payload, null, 2)}
          </pre>
          <div className="text-xs mt-2 text-slate-500">
            <span>ID: {message.msg_id}</span>
            <span> | Schema: {message.schema_id}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const MessageLog: React.FC<MessageLogProps> = ({ messages, nodes, modeTheme }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  const nodeLabelMap = useMemo(() => {
    return nodes.reduce((acc, node) => {
      acc[node.id] = node.label;
      return acc;
    }, {} as Record<string, string>);
  }, [nodes]);


  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="bg-slate-900 bg-opacity-50 backdrop-blur-sm p-4 rounded-lg shadow-lg h-full flex flex-col border border-slate-700">
      <h2 className={`text-lg font-bold ${modeTheme.text} mb-4 flex-shrink-0`}>Message Trace</h2>
      <div ref={logContainerRef} className="flex-grow overflow-y-auto pr-2">
        {messages.map((msg, index) => (
          <LogEntry key={`${msg.msg_id}-${index}`} message={msg} nodeLabelMap={nodeLabelMap} modeTheme={modeTheme} />
        ))}
      </div>
    </div>
  );
};

export default MessageLog;