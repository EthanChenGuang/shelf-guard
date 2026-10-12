import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { DetectedAnomaly, Language, ShelfCalibration } from '../types';
import { I18N } from '../lib/constants';
import { usePinchPanZoom } from '../hooks/usePinchPanZoom';
import { InspectShelfCanvas } from './InspectShelfCanvas';

export interface InspectImageFullscreenProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  baseline: ShelfCalibration;
  activeAnomalies: DetectedAnomaly[];
  showArLayers: boolean;
  lang: Language;
}

export const InspectImageFullscreen: React.FC<InspectImageFullscreenProps> = ({
  open,
  onClose,
  imageUrl,
  baseline,
  activeAnomalies,
  showArLayers,
  lang,
}) => {
  const t = I18N[lang];
  const { reset, style, touchHandlers } = usePinchPanZoom();

  useEffect(() => {
    if (!open) {
      reset();
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, reset]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={t.comparisonFullscreenTitle}
      data-testid="inspect-image-fullscreen"
    >
      <header className="flex shrink-0 items-center justify-between px-4 py-3 safe-area-inset-top">
        <p className="text-sm font-semibold text-white/90">{t.comparisonFullscreenTitle}</p>
        <button
          type="button"
          data-testid="inspect-image-fullscreen-close"
          onClick={onClose}
          aria-label={t.exitFullscreen}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white active:scale-95"
        >
          <X className="h-6 w-6" />
        </button>
      </header>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-4"
        {...touchHandlers}
      >
        <div className="w-full max-w-[100vw] will-change-transform" style={style}>
          <InspectShelfCanvas
            imageUrl={imageUrl}
            baseline={baseline}
            activeAnomalies={activeAnomalies}
            showArLayers={showArLayers}
            lang={lang}
            viewportHeight={undefined}
            className="w-full max-h-[85dvh] mx-auto"
            imageClassName="w-full h-full max-h-[85dvh] object-contain pointer-events-none"
          />
        </div>
      </div>

      <p className="shrink-0 pb-4 text-center text-xs text-white/60">{t.comparisonFullscreenHint}</p>
    </div>
  );
};
