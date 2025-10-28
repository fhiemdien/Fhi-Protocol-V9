import React, { useState } from 'react';

interface ReportModeModalProps {
  onSelect: (mode: 'online' | 'offline', isFinal: boolean) => void;
  onClose: () => void;
  modeTheme: Record<string, string>;
}

const ReportModeModal: React.FC<ReportModeModalProps> = ({ onSelect, onClose, modeTheme }) => {
  const [isFinal, setIsFinal] = useState(false);
  const ringClass = modeTheme.ring.replace('focus:ring-', 'focus:border-');
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className={`bg-slate-900 border ${modeTheme.border} rounded-lg shadow-2xl w-full max-w-lg`}
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-700">
          <h2 className={`text-xl font-bold ${modeTheme.text}`}>Choose Report Generation Mode</h2>
        </header>
        
        <main className="p-6 space-y-6">
            <p className="text-sm text-slate-400">
                Select how you want to generate the post-simulation analysis.
            </p>

            <div className="flex justify-around items-stretch gap-4">
                <button 
                    onClick={() => onSelect('offline', isFinal)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors text-center border-2 border-slate-600 hover:border-slate-500"
                >
                    <h3 className="text-lg">Quick (Offline)</h3>
                    <p className="text-xs text-slate-300 mt-1 font-normal">Generates an instant, free report using local mock data. Ideal for a fast overview.</p>
                </button>
                <button 
                    onClick={() => onSelect('online', isFinal)}
                    className={`flex-1 ${modeTheme.bg} ${modeTheme.hoverBg} text-white font-bold py-3 px-4 rounded-lg transition-colors text-center border-2 ${modeTheme.border}`}
                >
                    <h3 className="text-lg">Deep Analysis (Online)</h3>
                    <p className="text-xs text-white/80 mt-1 font-normal">Uses AI for in-depth analysis of results. This provides higher quality insights but will use your API quota.</p>
                </button>
            </div>
             <div className="pt-4 mt-4 border-t border-slate-700">
                <label className="flex items-center justify-center space-x-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isFinal}
                        onChange={(e) => setIsFinal(e.target.checked)}
                        className={`w-5 h-5 ${modeTheme.text} bg-slate-700 border-slate-600 rounded ${modeTheme.ring} ${ringClass}`}
                    />
                    <span className="text-slate-300 font-semibold">End simulation and finalize report</span>
                </label>
                 <p className="text-xs text-slate-500 mt-2 text-center">
                    If checked, this will be treated as the final report and the current simulation will be terminated.
                    Leave unchecked to generate an interim report and resume the simulation later.
                </p>
            </div>
        </main>

        <footer className="p-4 border-t border-slate-700 flex justify-end">
             <button 
                onClick={onClose}
                className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
                Cancel
            </button>
        </footer>
      </div>
    </div>
  );
};

export default ReportModeModal;