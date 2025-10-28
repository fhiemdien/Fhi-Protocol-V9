import React, { useState, useEffect } from 'react';
import { AIConfig, AIProviderType } from '../types';

interface ApiKeyModalProps {
  currentConfig: AIConfig;
  onSave: (config: AIConfig) => void;
  onClose: () => void;
  modeTheme: Record<string, string>;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ currentConfig, onSave, onClose, modeTheme }) => {
  const [provider, setProvider] = useState<AIProviderType>(currentConfig.provider);
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [baseURL, setBaseURL] = useState(currentConfig.baseURL || '');
  const [modelName, setModelName] = useState(currentConfig.modelName || '');

  useEffect(() => {
    setProvider(currentConfig.provider);
    setApiKey(currentConfig.apiKey || '');
    setBaseURL(currentConfig.baseURL || '');
    setModelName(currentConfig.modelName || '');
  }, [currentConfig]);

  const handleSave = () => {
    if (apiKey.trim()) {
      onSave({
        provider,
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim(),
        modelName: modelName.trim(),
      });
    }
  };

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
        <header className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h2 className={`text-xl font-bold ${modeTheme.text}`}>Configure AI Provider</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </header>
        
        <main className="p-6 space-y-4">
            <p className="text-sm text-slate-400">
                To use 'Online' mode, please provide your API key. The configuration will be saved in your browser's local storage.
            </p>

            <div>
                <label htmlFor="ai-provider-select" className="block text-sm font-medium text-slate-300 mb-2">
                    AI Provider
                </label>
                <select
                    id="ai-provider-select"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as AIProviderType)}
                    className={`w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 ${modeTheme.ring} ${ringClass}`}
                >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai-compatible">OpenAI-Compatible</option>
                </select>
            </div>

            <div>
                <label htmlFor="api-key-input" className="block text-sm font-medium text-slate-300 mb-2">
                    API Key
                </label>
                <input
                    id="api-key-input"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API Key here"
                    className={`w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 ${modeTheme.ring}`}
                />
            </div>

            {provider === 'openai-compatible' && (
                <>
                    <div>
                        <label htmlFor="base-url-input" className="block text-sm font-medium text-slate-300 mb-2">
                            Base URL (Optional)
                        </label>
                        <input
                            id="base-url-input"
                            type="text"
                            value={baseURL}
                            onChange={(e) => setBaseURL(e.target.value)}
                            placeholder="e.g., https://api.groq.com/openai/v1"
                            className={`w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 ${modeTheme.ring}`}
                        />
                         <p className="text-xs text-slate-500 mt-1">Leave empty to use the default OpenAI API endpoint.</p>
                    </div>
                    <div>
                        <label htmlFor="model-name-input" className="block text-sm font-medium text-slate-300 mb-2">
                            Model Name
                        </label>
                        <input
                            id="model-name-input"
                            type="text"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            placeholder="e.g., llama3-70b-8192"
                            className={`w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 focus:outline-none focus:ring-2 ${modeTheme.ring}`}
                        />
                    </div>
                </>
            )}
             {provider === 'gemini' && (
                <p className="text-xs text-slate-400 text-center">
                    Get your key from{' '}
                    <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className={`${modeTheme.text} hover:underline`}>
                        Google AI Studio
                    </a>.
                </p>
             )}


        </main>

        <footer className="p-4 border-t border-slate-700 flex justify-end items-center gap-4">
            <button 
                onClick={onClose}
                className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
                Cancel
            </button>
            <button 
                onClick={handleSave}
                disabled={!apiKey.trim()}
                className={`${modeTheme.bg} ${modeTheme.hoverBg} text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50`}
            >
                Save Configuration
            </button>
        </footer>
      </div>
    </div>
  );
};

export default ApiKeyModal;