import React from 'react';
import { EmergenceAnalysisReport } from '../types';

interface EmergenceAnalysisPanelProps {
  analysis: EmergenceAnalysisReport;
  modeTheme: Record<string, string>;
}

const MetricCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-800 p-4 rounded-lg">
    <h4 className="text-sm font-bold text-slate-300 mb-3">{title}</h4>
    {children}
  </div>
);

const ProgressBar: React.FC<{ value: number; maxValue?: number, modeTheme: Record<string, string> }> = ({ value, maxValue = 1, modeTheme }) => {
  const percentage = (value / maxValue) * 100;
  const barColor = modeTheme.bg.replace('bg-','bg-').replace('-600', '-500');
  return (
    <div className="w-full bg-slate-700 rounded-full h-2.5">
      <div
        className={`${barColor} h-2.5 rounded-full`}
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

const EmergenceAnalysisPanel: React.FC<EmergenceAnalysisPanelProps> = ({ analysis, modeTheme }) => {
  if (!analysis) {
    return (
        <div className="mt-6 p-4 border-t border-slate-700 text-slate-500 text-center">
            Emergence Analysis data could not be generated for this report.
        </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-slate-700">
      <h3 className={`text-xl font-bold ${modeTheme.text} mb-4`}>Emergence Analysis</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        
        {/* Diversity */}
        <MetricCard title="Diversity Score (Sáng tạo Phân kỳ)">
          <div className="flex items-center space-x-3 mb-3">
            <ProgressBar value={analysis.diversity_score} modeTheme={modeTheme} />
            <span className="font-bold text-lg text-white">{analysis.diversity_score.toFixed(2)}</span>
          </div>
          <ul className="space-y-1 text-xs text-slate-400">
            {analysis.key_idea_clusters.map(cluster => (
              <li key={cluster.cluster_name}>
                <span className="font-semibold text-slate-300">{cluster.cluster_name}:</span> {cluster.percentage.toFixed(0)}%
              </li>
            ))}
          </ul>
        </MetricCard>

        {/* Cohesion */}
        <MetricCard title="Cohesion Score (Sáng tạo Hội tụ)">
          <div className="flex items-center space-x-3 mb-3">
            <ProgressBar value={analysis.cohesion_score} modeTheme={modeTheme} />
            <span className="font-bold text-lg text-white">{analysis.cohesion_score.toFixed(2)}</span>
          </div>
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Consensus Trajectory:</span> {analysis.consensus_trajectory}
          </div>
        </MetricCard>

        {/* Novelty */}
        <MetricCard title="Novelty Rate (Khả năng Đột phá)">
          <div className="flex items-center space-x-3 mb-3">
            <ProgressBar value={analysis.novelty_rate} modeTheme={modeTheme} />
            <span className="font-bold text-lg text-white">{(analysis.novelty_rate * 100).toFixed(0)}%</span>
          </div>
          <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside">
            {analysis.key_novelty_events.slice(0, 2).map(event => (
              <li key={event.tick} className="truncate">
                <span className="font-semibold text-slate-300">Tick {event.tick}:</span> {event.summary}
              </li>
            ))}
          </ul>
        </MetricCard>

        {/* Adaptability */}
        <MetricCard title="Adaptability Score (Tự sửa lỗi)">
            <div className="flex items-center justify-between mb-3">
                 <span className={`font-bold text-lg ${modeTheme.text}`}>{analysis.adaptability_score}</span>
                 <span className="text-xs text-slate-500">
                    {analysis.key_adaptive_actions.reduce((sum, a) => sum + a.count, 0)} total actions
                 </span>
            </div>
            <ul className="space-y-1 text-xs text-slate-400">
              {analysis.key_adaptive_actions.map(action => (
                <li key={action.action_type}>
                  <span className="font-semibold text-slate-300">{action.action_type}:</span> {action.count}
                </li>
              ))}
            </ul>
        </MetricCard>

        {/* Surprise */}
        <MetricCard title="Surprise Index (Tính Khó đoán)">
            <div className="flex items-center justify-between mb-3">
                 <span className={`font-bold text-lg ${modeTheme.text}`}>{analysis.automated_surprise_index}</span>
                 <span className="text-xs text-slate-500">Significant Events</span>
            </div>
            <p className="text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Most Surprising:</span> Tick {analysis.most_surprising_event.tick} - {analysis.most_surprising_event.summary}
            </p>
        </MetricCard>

      </div>
    </div>
  );
};

export default EmergenceAnalysisPanel;
