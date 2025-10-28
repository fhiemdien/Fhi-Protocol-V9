import React from 'react';
import { HistoryIcon } from './icons';

interface QueryHistoryProps {
  history: string[];
  onSelect: (query: string) => void;
  isRunning: boolean;
  modeTheme: Record<string, string>;
}

const QueryHistory: React.FC<QueryHistoryProps> = ({ history, onSelect, isRunning, modeTheme }) => {
  return (
    <div className="bg-slate-900 bg-opacity-50 backdrop-blur-sm p-4 rounded-lg shadow-lg h-full flex flex-col border border-slate-700">
      <h2 className={`text-lg font-bold ${modeTheme.text} mb-4 flex-shrink-0 flex items-center gap-2`}>
        <HistoryIcon className="w-5 h-5" />
        Query History
      </h2>
      <div className="flex-grow overflow-y-auto pr-2 space-y-2">
        {history.length === 0 ? (
          <div className="text-sm text-slate-500 text-center pt-8">
            No history yet. Start a simulation to save its hypothesis here.
          </div>
        ) : (
          history.map((query, index) => (
            <button
              key={index}
              onClick={() => onSelect(query)}
              disabled={isRunning}
              className="w-full text-left bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-md text-sm text-slate-300 transition-colors"
              title="Click to reuse this hypothesis"
            >
              <p className="truncate">
                {query}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default QueryHistory;