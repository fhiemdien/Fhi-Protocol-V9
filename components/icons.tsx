import React from 'react';

export const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const PauseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

export const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h12v12H6z" />
  </svg>
);

export const ResetIcon: React.FC<{ className?: string }> = ({ className }) => (
 <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
  </svg>
);

export const ScissorsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.14,9.36l-3.53,3.53-3.5-3.5L7.58,13.42l3.53,3.53-2,2L3.81,13.62A3,3,0,0,1,3.81,9.39l2.12-2.12a3,3,0,0,1,4.24,0l3.54,3.53,3.53-3.53a3,3,0,0,1,4.24,4.24l-2.12,2.12a3,3,0,0,1-4.24,0l-2-2,3.53-3.53Zm-6.79-4.24a1,1,0,1,0-1.41,1.41,1,1,0,0,0,1.41-1.41ZM18.5,4.5a1,1,0,1,0,1.41,1.41A1,1,0,0,0,18.5,4.5Z"/></svg>
);

export const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
);

export const ShieldCheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="m9 12 2 2 4-4"></path>
    </svg>
);

export const HistoryIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 0 1 7-7 7 7 0 0 1 7 7 7 7 0 0 1-7 7v2a9 9 0 0 0 9-9 9 9 0 0 0-9-9zm-1 5v5l4.25 2.52.75-1.23-3.5-2.07V8H12z" />
    </svg>
);

export const BalanceIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
      <path d="M5 5h14" />
      <path d="M12 3v18" />
      <path d="M5 15a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
      <path d="M11 15a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
    </svg>
);

export const TestTubeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M6 21v-15a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v15" />
        <path d="M6 13h12" />
    </svg>
);


// New Icons for Nodes
export const BrainIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" />
        <path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" />
        <path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-1.5" />
        <path d="M6.5 16a3.5 3.5 0 0 1 0 -7h1.5" />
        <path d="M16 5.5m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
        <path d="M8 5.5m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
        <path d="M12 7.5c2.5 0 4.5 -2 5 -5" />
        <path d="M12 7.5c-2.5 0 -4.5 -2 -5 -5" />
    </svg>
);

export const AtomIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M12 12v.01" />
        <path d="M12 19a7 7 0 1 0 0 -14" />
        <path d="M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
        <path d="M12 5a7 7 0 1 0 0 14" />
    </svg>
);

export const ChipIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z" />
        <path d="M8 9h8" />
        <path d="M8 12h8" />
        <path d="M8 15h8" />
        <path d="M5 8v1" />
        <path d="M5 11v1" />
        <path d="M5 14v1" />
        <path d="M19 8v1" />
        <path d="M19 11v1" />
        <path d="M19 14v1" />
        <path d="M12 5v-2" />
        <path d="M12 19v2" />
    </svg>
);

export const DatabaseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M12 6m-8 0c0 1.657 3.582 3 8 3s8 -1.343 8 -3c0 -1.657 -3.582 -3 -8 -3s-8 1.343 -8 3" />
        <path d="M4 6v6c0 1.657 3.582 3 8 3s8 -1.343 8 -3v-6" />
        <path d="M4 12v6c0 1.657 3.582 3 8 3s8 -1.343 8 -3v-6" />
    </svg>
);

export const PaintBrushIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M3 21v-4a4 4 0 0 1 4 -4h4" />
        <path d="M21 3a16 16 0 0 0 -12.8 10.2" />
        <path d="M21 3a16 16 0 0 1 -10.2 12.8" />
        <path d="M10.6 9a9 9 0 0 1 4.4 4.4" />
    </svg>
);

export const SignalIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M14.466 10.222a5 5 0 0 1 -5.683 5.683" />
        <path d="M17.616 6.51a9 9 0 0 1 -8.329 8.328" />
        <path d="M12 4c1.918 0 3.813 .465 5.5 1.35" />
    </svg>
);

export const SigmaIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M18 18h-12l6 -6l-6 -6h12" />
    </svg>
);

export const ChartBarIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M3 12m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M9 8m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M15 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M4 20l14 0" />
    </svg>
);

export const GavelIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M13 10l5 -5" />
        <path d="M16 13l-1.5 -1.5" />
        <path d="M10 16l-1.5 -1.5" />
        <path d="M18 7l-5 5" />
        <path d="M8.711 11.289a2.404 2.404 0 0 0 -3.4 3.4l5.689 5.69l3.4 -3.4l-5.689 -5.69z" />
        <path d="M11.289 8.711a2.404 2.404 0 0 0 3.4 -3.4l-5.69 -5.689l-3.4 3.4l5.69 5.689z" />
    </svg>
);

export const NetworkIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M12 9m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0" />
        <path d="M12 15m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
        <path d="M12 9v-3" />
        <path d="M12 15v3" />
        <path d="M10 20.5c-1.333 -1 -2 -2.5 -2 -4.5" />
        <path d="M14 20.5c1.333 -1 2 -2.5 2 -4.5" />
        <path d="M6 3.5c1.333 1 2 2.5 2 4.5" />
        <path d="M18 3.5c-1.333 1 -2 2.5 -2 4.5" />
    </svg>
);

export const PenNibIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M14 6l7 7l-4 4" />
        <path d="M5.828 18.172a2.828 2.828 0 0 0 4 0l10.586 -10.586a2 2 0 0 0 0 -2.828l-2.172 -2.172a2 2 0 0 0 -2.828 0l-10.586 10.586a2.828 2.828 0 0 0 0 4z" />
        <path d="M4 20l1.768 -1.768" />
    </svg>
);

export const HeartbeatIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M19.5 13.572l-7.5 7.428l-2.896 -2.868m-6.104 -6.132l4.32 -4.32l4.32 4.32l-2.64 2.64" />
        <path d="M3 13.572l5.43 -5.43" />
        <path d="M12 21l8 -7.928" />
    </svg>
);

export const GalaxyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M7.181 5.319a5.5 5.5 0 0 0 5.319 7.181" />
        <path d="M12.5 13.5a3 3 0 0 0 3 -3" />
        <path d="M12 5.5a7 7 0 0 0 7 7" />
        <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    </svg>
);

export const CubeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M21 12l-9 -9l-9 9l9 9l9 -9" />
        <path d="M3 12v6l9 3l9 -3v-6" />
        <path d="M12 21v-9" />
        <path d="M21 6l-9 -3l-9 3" />
    </svg>
);

export const LightbulbIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" />
        <path d="M9.7 17l4.6 0" />
        <path d="M12 3v4" />
        <path d="M3.5 6.5l2.8 2.8" />
        <path d="M17.7 9.3l2.8 -2.8" />
    </svg>
);

export const DiceIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z" />
        <path d="M10 10m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        <path d="M14 14m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </svg>
);

export const WrenchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M14.735 17.685l-1.735 -1.685l-2.634 3.03l-1.464 -1.464l3.03 -2.634l-1.685 -1.735a2.15 2.15 0 0 1 0 -3.037l5.315 -5.315a2.15 2.15 0 0 1 3.037 0l1.685 1.685a2.15 2.15 0 0 1 0 3.037l-5.315 5.315a2.15 2.15 0 0 1 -3.037 0z" />
        <path d="M5.635 17.685l-2.635 3.03l-1.465 -1.464l3.03 -2.635l-1.002 -1.002a2.15 2.15 0 0 1 0 -3.037l5.315 -5.315a2.15 2.15 0 0 1 3.037 0l1.002 1.002" />
    </svg>
);

export const CursorClickIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <path d="M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5" />
        <path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0v2.5" />
        <path d="M14 10.5a1.5 1.5 0 0 1 3 0v1.5" />
        <path d="M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.497 1.497 0 0 1 2.048 .53z" />
    </svg>
);