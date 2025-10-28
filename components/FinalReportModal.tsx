import React, { useState } from 'react';
import type { MessageEnvelope, EmergenceAnalysisReport } from '../types';
import EmergenceAnalysisPanel from './EmergenceAnalysisPanel'; // New Import
import { APP_VERSION } from '../constants';

interface FinalReportModalProps {
  report: Record<string, any> | null;
  messages: MessageEnvelope[];
  isLoading: boolean;
  onClose: () => void;
  modeTheme: Record<string, string>;
}

const generateMarkdownReport = (report: Record<string, any>): string => {
    let md = `# Fhi. V${APP_VERSION} Simulation Report\n\n`;

    md += `## 1. Simulation Summary\n\n`;
    md += `- **Initial Hypothesis:** ${report.summary.initial_hypothesis}\n`;
    md += `- **Total Ticks:** ${report.summary.total_ticks}\n`;
    md += `- **Mode:** ${report.summary.mode}\n`;
    md += `- **Actual Elapsed Time:** ${report.summary.actual_elapsed_time}\n`;
    md += `- **Configured Duration:** ${report.summary.configured_duration_minutes} minutes\n\n`;


    md += `## 2. AI-Generated Analysis\n\n`;
    md += (report.human_summary || "Summary could not be generated.") + `\n\n`;
    
    md += `## 3. Post-Simulation Analysis\n\n`;
    md += `### Monitor's Report\n\n\`\`\`json\n${JSON.stringify(report.monitor_report, null, 2)}\n\`\`\`\n\n`;
    md += `### Meta-Researcher Analysis\n\n\`\`\`json\n${JSON.stringify(report.meta_analysis, null, 2)}\n\`\`\`\n\n`;
    md += `### Arbiter's Final Decision\n\n\`\`\`json\n${JSON.stringify(report.arbiter_decision, null, 2)}\n\`\`\`\n\n`;
    
    if (report.emergence_analysis) {
        md += `### Emergence Analysis\n\n`;
        const ea = report.emergence_analysis;
        md += `- **Diversity Score:** ${ea.diversity_score.toFixed(2)}\n`;
        md += `- **Cohesion Score:** ${ea.cohesion_score.toFixed(2)} (Trajectory: ${ea.consensus_trajectory})\n`;
        md += `- **Novelty Rate:** ${(ea.novelty_rate * 100).toFixed(0)}%\n`;
        md += `- **Adaptability Score:** ${ea.adaptability_score}\n`;
        md += `- **Surprise Index:** ${ea.automated_surprise_index} events\n\n`;
    }


    md += `## 4. Final Node States\n\n`;
    for (const nodeName in report.final_states) {
        const state = report.final_states[nodeName];
        md += `### Node: ${nodeName}\n\n`;
        md += `- **Schema ID:** \`${state.schema_id}\`\n`;
        const confidence = state.final_confidence;
        md += `- **Final Confidence:** ${confidence !== null && confidence !== undefined ? (confidence * 100).toFixed(1) + '%' : 'N/A'}\n`;
        md += `- **Final Payload:**\n`;
        md += `\`\`\`json\n${JSON.stringify(state.last_payload, null, 2)}\n\`\`\`\n\n`;
    }

    return md;
}

const generateCSVReport = (messages: MessageEnvelope[]): string => {
  const headers = ['tick', 'subTick', 'timestamp', 'from_node', 'to_nodes', 'schema_id', 'is_valid', 'confidence', 'payload_summary'];
  const rows = messages.map(msg => {
    const confidence = msg.payload.confidence !== undefined && msg.payload.confidence !== null ? msg.payload.confidence : '';
    const summary = msg.payload.summary || msg.payload.hypothesis || msg.payload.decision || (msg.payload.metaphors ? msg.payload.metaphors[0] : JSON.stringify(msg.payload).substring(0, 50) + '...');
    
    const row = [
        msg.tick ?? '',
        msg.subTick ?? '',
        msg.ts,
        msg.from,
        msg.to.join(';'),
        msg.schema_id,
        msg.validation.schema_ok,
        confidence,
        `"${String(summary).replace(/"/g, '""')}"` // Escape quotes for CSV
    ];
    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};


const FinalReportModal: React.FC<FinalReportModalProps> = ({ report, messages, isLoading, onClose, modeTheme }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'json'>('summary');
  
  const handleExport = (format: 'json' | 'md' | 'csv') => {
    if (!report) return;
    const filename = `fhi-v${APP_VERSION}-report-${new Date().toISOString().split('T')[0]}`;
    let content = '';
    let mimeType = '';

    if (format === 'json') {
      content = JSON.stringify(report, null, 2);
      mimeType = 'application/json';
    } else if (format === 'md') {
      content = generateMarkdownReport(report);
      mimeType = 'text/markdown';
    } else if (format === 'csv') {
      content = generateCSVReport(messages);
      mimeType = 'text/csv';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeTabBorderColor = modeTheme.border.replace('border-', 'border-b-');
  
  const reportGenerationMode = report?.summary?.mode?.includes('(Report: online)') 
    ? 'online' 
    : 'offline';

  const TabButton: React.FC<{ tabId: 'summary' | 'json'; children: React.ReactNode }> = ({ tabId, children }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
        activeTab === tabId
          ? `bg-slate-800 ${modeTheme.text} border-b-2 ${activeTabBorderColor}`
          : 'text-slate-400 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );

  const renderContent = () => {
    if (isLoading) {
      const loaderBorder = modeTheme.border.replace('border-','border-b-');
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${loaderBorder} mb-4`}></div>
            <h3 className="text-xl font-semibold text-slate-200">Generating Post-Simulation Analysis...</h3>
            <p className="text-slate-400">The Arbiter, Meta, and Monitor nodes are reviewing the results.</p>
        </div>
      );
    }
    
    if (!report) {
         return <div className="text-center p-8 text-slate-400">No report data available.</div>;
    }
    
    if (activeTab === 'summary') {
        return (
            <div>
                <div className="prose prose-invert text-slate-300 max-w-none" dangerouslySetInnerHTML={{ __html: report.human_summary ? report.human_summary.replace(/\n/g, '<br />') : "Summary could not be generated." }}>
                </div>
                {report.emergence_analysis && (
                    <EmergenceAnalysisPanel analysis={report.emergence_analysis} modeTheme={modeTheme} />
                )}
            </div>
        )
    }
    
    return (
        <pre className="text-sm text-slate-200 bg-slate-800 p-4 rounded-md">
            {JSON.stringify(report, null, 2)}
        </pre>
    )
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className={`bg-slate-900 border ${modeTheme.border} rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-4">
              <h2 className={`text-2xl font-bold ${modeTheme.text}`}>Final Report</h2>
              {report && !isLoading && (
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                      reportGenerationMode === 'online' 
                          ? `${modeTheme.bg} text-white` 
                          : 'bg-slate-700 text-slate-300'
                  }`}>
                      {reportGenerationMode === 'online' ? 'Deep Analysis (Online)' : 'Quick Analysis (Offline)'}
                  </span>
              )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </header>
        
        {!isLoading && report && (
          <nav className="px-6 border-b border-slate-700 flex-shrink-0">
              <div className="flex -mb-px">
                  <TabButton tabId="summary">Human-Readable Summary</TabButton>
                  <TabButton tabId="json">Raw JSON Data</TabButton>
              </div>
          </nav>
        )}

        <main className="p-6 overflow-y-auto">
          {renderContent()}
        </main>

        <footer className="p-4 border-t border-slate-700 flex justify-center items-center gap-4 flex-shrink-0">
            <button 
                onClick={() => handleExport('json')}
                disabled={isLoading || !report}
                className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
                Export JSON
            </button>
             <button 
                onClick={() => handleExport('csv')}
                disabled={isLoading || !report}
                className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
                Export CSV
            </button>
            <button 
                onClick={() => handleExport('md')}
                disabled={isLoading || !report}
                className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
                Export Markdown
            </button>
            <button 
                onClick={onClose}
                className={`${modeTheme.bg} ${modeTheme.hoverBg} text-white font-bold py-2 px-6 rounded-lg transition-colors`}
            >
                Close
            </button>
        </footer>
      </div>
    </div>
  );
};

export default FinalReportModal;