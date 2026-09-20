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
    <div className="fixed inset-0 z-50 bg-[#0F172A] overflow-hidden flex flex-col items-center justify-center select-none">
      <img
        src={frozenFrameUrl}
        alt="Frozen frame for scanning"
        className="w-full h-full object-cover filter brightness-90"
      />

      {isProcessing ? (
        <div className="absolute inset-0 bg-[#0F172A]/40 pointer-events-none animate-pulse" />
      ) : (
        <>
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent shadow-[0_0_20px_#38BDF8,0_0_40px_#10B981] animate-scan-beam" />
            <div className="w-full h-24 bg-gradient-to-t from-[#38BDF8]/25 to-transparent animate-scan-beam" />
          </div>
          <div className="absolute inset-0 bg-white/40 pointer-events-none animate-shutter-flash" />
        </>
      )}

      <div className="absolute bottom-16 px-4 py-2 rounded-full bg-[#0F172A]/85 backdrop-blur-md shadow-2xl border border-white/20 flex items-center gap-2">
        {isProcessing ? (
          <Loader2 className="w-4 h-4 text-[#38BDF8] animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 text-[#38BDF8] animate-spin" />
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
