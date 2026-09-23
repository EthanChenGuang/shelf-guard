import React from 'react';
import {Loader2, Sparkles} from 'lucide-react';
import {Language} from '../types';
import {I18N} from '../lib/constants';

interface ScanningAnimationOverlayProps {
  lang: Language;
  frozenFrameUrl: string;
  variant?: 'scanning' | 'processing';
}

export const ScanningAnimationOverlay: React.FC<ScanningAnimationOverlayProps> = ({
  lang,
  frozenFrameUrl,
  variant = 'scanning',
}) => {
  const t = I18N[lang];
  const isProcessing = variant === 'processing';

  return (
    <div className="fixed inset-0 z-50 bg-sg-camera overflow-hidden flex flex-col items-center justify-center select-none">
      <img
        src={frozenFrameUrl}
        alt="Frozen frame for scanning"
        className="w-full h-full object-cover filter brightness-90"
      />

      {isProcessing ? (
        <div className="absolute inset-0 bg-sg-camera/40 pointer-events-none animate-pulse" />
      ) : (
        <>
          <div className="absolute inset-0 pointer-events-none">
            <div className="animate-scan-beam h-1.5 w-full bg-gradient-to-r from-transparent via-sg-scan to-transparent shadow-[0_0_24px_rgba(56,189,248,0.95),0_0_48px_rgba(56,189,248,0.55),0_0_64px_rgba(16,185,129,0.25)]" />
            <div className="animate-scan-beam h-28 w-full bg-gradient-to-t from-sg-scan/35 via-sg-scan/10 to-transparent" />
            <div className="animate-scan-beam absolute inset-x-0 h-32 bg-gradient-to-b from-sg-scan/20 to-transparent blur-xl" />
          </div>
          <div className="pointer-events-none absolute inset-0 animate-shutter-flash bg-white/40" />
        </>
      )}

      <div className="absolute bottom-16 flex items-center gap-2 rounded-full border border-white/20 bg-sg-camera/85 px-4 py-2 shadow-2xl backdrop-blur-md">
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-sg-scan" />
        ) : (
          <Sparkles className="h-4 w-4 animate-spin text-sg-scan" />
        )}
        <span className="text-white text-xs font-semibold tracking-wide">
          {isProcessing ? t.processing : t.scanning}
        </span>
      </div>

      {!isProcessing && (
        <style>{`
          @keyframes scanBeam {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(1100%); }
          }
          .animate-scan-beam {
            animation: scanBeam 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
          @keyframes shutterFlash {
            0% { opacity: 0.8; }
            100% { opacity: 0; }
          }
          .animate-shutter-flash {
            animation: shutterFlash 0.25s ease-out forwards;
          }
        `}</style>
      )}
    </div>
  );
};
