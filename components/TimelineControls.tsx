import React from 'react';
import { PlayIcon, PauseIcon, StopIcon, ResetIcon, ShieldCheckIcon, ScissorsIcon } from './icons';
import { OrchestratorMode, ControlMode } from '../types';

interface SystemStatus {
    health: number;
    stability: number;
}

interface TimelineControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onClearMemory: () => void;
  durationInMinutes: number;
  onDurationChange: (duration: number) => void;
  tick: number;
  maxTicks: number;
  isSimulationRunning: boolean;
  canGenerateReport: boolean;
  onGenerateReport: () => void;
  hasLearnedRouting: boolean;
  applyLearnedConfiguration: boolean;
  onApplyLearnedConfigurationChange: (apply: boolean) => void;
  hasMemory: boolean;
  systemStatus: SystemStatus;
  controlMode: ControlMode;
  onControlModeChange: (mode: ControlMode) => void;
  modeTheme: Record<string, string>;
}

const getStatusLabel = (score: number): { text: string; color: string } => {
    if (score >= 0.9) return { text: 'Excellent', color: 'text-green-400' };
    if (score >= 0.7) return { text: 'Good', color: 'text-teal-400' };
    if (score >= 0.5) return { text: 'Moderate', color: 'text-yellow-400' };
    if (score >= 0.3) return { text: 'Poor', color: 'text-orange-400' };
    return { text: 'Critical', color: 'text-red-500' };
};

const StatusBar: React.FC<{ label: string; score: number }> = ({ label, score }) => {
    const status = getStatusLabel(score);
    const progressPercentage = score * 100;
    const barColor = status.color.replace('text-', 'bg-').replace('-400', '-500').replace('-500', '-600');
    const labelParts = label.split(' ');

    return (
        <div className="flex items-center space-x-3 text-sm">
            <div className="font-semibold text-slate-400 w-20 text-right leading-tight">
                <span>{labelParts[0]}</span><br/>
                <span>{labelParts[1]}:</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5 flex-grow">
                <div 
                    className={`${barColor} h-2.5 rounded-full transition-all duration-500`} 
                    style={{ width: `${progressPercentage}%` }}>
                </div>
            </div>
            <div className={`flex flex-col font-mono font-bold w-20 ${status.color}`}>
                <span>{score.toFixed(2)}</span>
                <span className="text-xs font-semibold">({status.text})</span>
            </div>
        </div>
    );
};

const LearningToggle: React.FC<{
    apply: boolean;
    onChange: (apply: boolean) => void;
    disabled: boolean;
    modeTheme: Record<string, string>;
}> = ({ apply, onChange, disabled, modeTheme }) => {
    return (
        <div className="flex items-center space-x-2" title="Apply routing changes suggested by META node in previous run">
             <label htmlFor="learning-toggle" className="text-xs font-semibold text-slate-400 cursor-pointer">Apply Learning:</label>
             <input
                id="learning-toggle"
                type="checkbox"
                checked={apply}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className={`w-4 h-4 ${modeTheme.text} bg-slate-700 border-slate-600 rounded ${modeTheme.ring} disabled:opacity-50`}
             />
        </div>
    )
}

const TimelineControls: React.FC<TimelineControlsProps> = ({
  isPlaying,
  onPlayPause,
  onReset,
  onClearMemory,
  durationInMinutes,
  onDurationChange,
  tick,
  maxTicks,
  isSimulationRunning,
  canGenerateReport,
  onGenerateReport,
  hasLearnedRouting,
  applyLearnedConfiguration,
  onApplyLearnedConfigurationChange,
  hasMemory,
  systemStatus,
  controlMode,
  onControlModeChange,
  modeTheme
}) => {
  const progressPercentage = maxTicks > 0 ? (tick / maxTicks) * 100 : 0;
  const title = controlMode === 'dynamic' ? 'Orchestrator ∆§' : 'Orchestrator Controls';

  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const confirmTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearButtonRef = React.useRef<HTMLButtonElement>(null);

  const [tickInputValue, setTickInputValue] = React.useState<string | number>(maxTicks);

  React.useEffect(() => {
    setTickInputValue(maxTicks);
  }, [maxTicks]);


  const handleClearClick = () => {
    if (isConfirmingClear) {
      onClearMemory();
      setIsConfirmingClear(false);
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    } else {
      setIsConfirmingClear(true);
      confirmTimeoutRef.current = setTimeout(() => {
        setIsConfirmingClear(false);
      }, 5000); 
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isConfirmingClear && clearButtonRef.current && !clearButtonRef.current.contains(event.target as Node)) {
        setIsConfirmingClear(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, [isConfirmingClear]);

  const handleTickChange = (newTicks: number) => {
    // Clamp the value, snap to the nearest step, then update the parent.
    const clampedTicks = Math.round(Math.max(20, Math.min(7920, newTicks)) / 5) * 5;
    const newMinutes = clampedTicks / 120; // 120 ticks per minute
    onDurationChange(newMinutes);
  };

  const progressBarColor = modeTheme.bg.replace('bg-', 'bg-').replace('-600', '-500');

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center">
            <h2 className={`text-lg font-bold ${modeTheme.text}`}>{title}</h2>
            <div className="flex bg-slate-800 rounded-md p-0.5 w-44">
                <button
                    onClick={() => onControlModeChange('manual')}
                    disabled={isSimulationRunning}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm transition-colors w-1/2 ${
                        controlMode === 'manual' ? `${modeTheme.bg} text-white` : 'bg-transparent text-slate-400 hover:bg-slate-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    Manual
                </button>
                <button
                    onClick={() => onControlModeChange('dynamic')}
                    disabled={isSimulationRunning}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm transition-colors w-1/2 ${
                        controlMode === 'dynamic' ? `${modeTheme.bg} text-white` : 'bg-transparent text-slate-400 hover:bg-slate-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    Dynamic ∆§
                </button>
            </div>
        </div>

        <div className="my-2 text-sm font-mono">
          <span>Tick: <span className="font-bold text-white">{tick}</span> / {maxTicks}</span>
        </div>

        <div className="mb-3">
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className={`${progressBarColor} h-2 rounded-full transition-all duration-500`} 
              style={{width: `${progressPercentage}%`}}>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-3">
            <div className="flex items-center space-x-2">
                 <button
                    onClick={onPlayPause}
                    disabled={!isSimulationRunning}
                    className={`p-2 rounded-full ${modeTheme.bg} text-white ${modeTheme.hoverBg} transition-all duration-200 focus:outline-none focus:ring-2 ${modeTheme.ring} disabled:bg-slate-600 disabled:cursor-not-allowed`}
                    aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
                  >
                    {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={onReset}
                    disabled={isPlaying}
                    className="p-2 rounded-full bg-slate-600 text-white hover:bg-slate-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Reset simulation"
                  >
                    <ResetIcon className="w-5 h-5" />
                  </button>
                   <button
                    ref={clearButtonRef}
                    onClick={handleClearClick}
                    disabled={isSimulationRunning}
                    className={`p-2 rounded-full text-white transition-all duration-200 focus:outline-none focus:ring-2 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isConfirmingClear
                        ? 'bg-yellow-500 hover:bg-yellow-400 focus:ring-yellow-300'
                        : 'bg-red-800 hover:bg-red-700 focus:ring-red-400'
                    }`}
                    aria-label={isConfirmingClear ? "Confirm clear memory" : "Clear all saved reports, memories, and learned lessons"}
                    title={isConfirmingClear ? "Click again to confirm clearing memory" : "Clear all saved reports, memories, and learned lessons"}
                  >
                    {isConfirmingClear ? <ShieldCheckIcon className="w-5 h-5" /> : <ScissorsIcon className="w-5 h-5" />}
                  </button>
            </div>
            <div className="flex items-center space-x-3">
                <button
                    onClick={onGenerateReport}
                    disabled={!canGenerateReport}
                    className="text-xs bg-slate-600 text-white px-3 py-1.5 rounded-md hover:bg-slate-500 transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                    aria-label="Generate or view report"
                  >
                    Report
                </button>
                 {hasLearnedRouting && (
                    <LearningToggle
                        apply={applyLearnedConfiguration}
                        onChange={onApplyLearnedConfigurationChange}
                        disabled={isSimulationRunning}
                        modeTheme={modeTheme}
                    />
                 )}
            </div>
        </div>
        <div className="flex items-center w-full space-x-3">
            <label htmlFor="duration-slider" className="text-xs font-semibold text-slate-400 whitespace-nowrap">Sim Length</label>
            <input
              id="duration-slider"
              type="range"
              min="20"
              max="7920"
              step="5"
              value={maxTicks}
              onChange={(e) => handleTickChange(Number(e.target.value))}
              disabled={isSimulationRunning}
              className={`flex-grow h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer ${modeTheme.accent} disabled:opacity-50`}
            />
            <div className="flex items-center flex-shrink-0 bg-slate-800 border border-slate-700 rounded-md">
                <button
                    onClick={() => handleTickChange(maxTicks - 5)}
                    disabled={isSimulationRunning || maxTicks <= 20}
                    className="px-2 py-1 text-slate-300 hover:bg-slate-700 rounded-l-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease simulation length by 5 ticks"
                >
                    -
                </button>
                <input
                    type="number"
                    min="20"
                    max="7920"
                    step="5"
                    value={tickInputValue}
                    onChange={(e) => setTickInputValue(e.target.value)}
                    onBlur={(e) => handleTickChange(parseInt(e.target.value, 10))}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    disabled={isSimulationRunning}
                    className="w-16 bg-transparent text-center text-white font-mono text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label="Simulation length in ticks"
                />
                <button
                    onClick={() => handleTickChange(maxTicks + 5)}
                    disabled={isSimulationRunning || maxTicks >= 7920}
                    className="px-2 py-1 text-slate-300 hover:bg-slate-700 rounded-r-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Increase simulation length by 5 ticks"
                >
                    +
                </button>
            </div>
        </div>
      </div>
      
      <div className="pt-2 mt-2 border-t border-slate-700 space-y-2">
         <StatusBar label="System Stability" score={systemStatus.stability} />
         <StatusBar label="System Health" score={systemStatus.health} />
      </div>

    </div>
  );
};

export default TimelineControls;