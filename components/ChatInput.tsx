import React from 'react';
import { SendIcon } from './icons';

interface ChatInputProps {
  onStart: (hypothesis: string) => void;
  isRunning: boolean;
  isAnalyzing: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  modeTheme: Record<string, string>;
}

const ChatInput: React.FC<ChatInputProps> = ({ onStart, isRunning, isAnalyzing, inputValue, setInputValue, modeTheme }) => {

  const handleStandardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isRunning && !isAnalyzing) {
      onStart(inputValue);
    }
  };

  const placeholderText = isAnalyzing
    ? "Performing intelligent pre-analysis... structuring hypothesis..."
    : "Propose a grand challenge or an unsolved problem...";
    
  const ringClass = modeTheme.ring.replace('focus:ring-offset-2', '');

  return (
    <form 
        onSubmit={handleStandardSubmit} 
        className="flex items-center gap-4 h-full"
    >
      <div className="flex-grow relative h-full">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholderText}
          disabled={isRunning || isAnalyzing}
          rows={4}
          className={`w-full h-full bg-slate-800 border border-slate-600 rounded-md p-2 pr-14 text-slate-200 focus:outline-none focus:ring-2 ${ringClass} disabled:opacity-50 resize-none`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isRunning || isAnalyzing || !inputValue.trim()}
              className={`p-2 rounded-full ${modeTheme.bg} text-white ${modeTheme.hoverBg} transition-all duration-200 focus:outline-none focus:ring-2 ${modeTheme.ring} disabled:bg-slate-600 disabled:cursor-not-allowed`}
              aria-label="Start simulation"
            >
              <SendIcon className={`w-5 h-5 ${isAnalyzing ? 'animate-pulse' : ''}`} />
            </button>
        </div>
      </div>
    </form>
  );
};

export default ChatInput;