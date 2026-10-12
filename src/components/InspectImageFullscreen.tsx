import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DetectedAnomaly, Language, ShelfCalibration } from '../types';
import { I18N } from '../lib/constants';
import { usePinchPanZoom } from '../hooks/usePinchPanZoom';
import { useBlinkCompareHold } from '../hooks/useBlinkCompareHold';
import { useVisualViewport } from '../hooks/useVisualViewport';
import { InspectShelfCanvas } from './InspectShelfCanvas';
import { touchAt } from '../lib/touchAt';

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
  const { transform, reset, style, touchHandlers } = usePinchPanZoom();
  const hold = useBlinkCompareHold();
  const vv = useVisualViewport();

  useEffect(() => {
    if (!open) {
      reset();
      hold.cancel();
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
  }, [open, onClose, reset, hold.cancel]);

  if (!open) return null;

  const displayUrl = hold.isBlinking ? baseline.imageDataUrl : imageUrl;
  const coverViewport = { width: vv.width, height: vv.height };

  const overlay = (
    <div
      className="z-[200] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={t.comparisonFullscreenTitle}
      data-testid="inspect-image-fullscreen"
      style={{
        position: 'fixed',
        top: vv.offsetTop,
        left: vv.offsetLeft,
        width: vv.width,
        height: vv.height,
        right: 'auto',
        bottom: 'auto',
      }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden touch-none"
        data-testid="inspect-image-fullscreen-stage"
        data-zoom-scale={transform.scale.toFixed(2)}
        onTouchStart={(e) => {
          touchHandlers.onTouchStart(e);
          if (e.touches.length >= 2) {
            hold.cancel();
            return;
          }
          const t0 = touchAt(e.touches, 0);
          hold.begin(t0?.clientX ?? 0, t0?.clientY ?? 0);
        }}
        onTouchMove={(e) => {
          touchHandlers.onTouchMove(e);
          if (e.touches.length >= 2) {
            hold.cancel();
            return;
          }
          const t0 = touchAt(e.touches, 0);
          if (t0) hold.move(t0.clientX, t0.clientY);
        }}
        onTouchEnd={(e) => {
          touchHandlers.onTouchEnd(e);
          hold.end();
        }}
        onTouchCancel={(e) => {
          touchHandlers.onTouchEnd(e);
          hold.cancel();
        }}
        onMouseDown={(e) => hold.begin(e.clientX, e.clientY)}
        onMouseMove={(e) => {
          if (e.buttons) hold.move(e.clientX, e.clientY);
        }}
        onMouseUp={() => hold.end()}
        onMouseLeave={() => hold.cancel()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="will-change-transform" style={style}>
          <InspectShelfCanvas
            imageUrl={displayUrl}
            baseline={baseline}
            activeAnomalies={hold.isBlinking ? [] : activeAnomalies}
            showArLayers={!hold.isBlinking && showArLayers}
            lang={lang}
            layout="cover"
            coverViewport={coverViewport}
            showingBaseline={hold.isBlinking}
          />
        </div>
      </div>

      <button
        type="button"
        data-testid="inspect-image-fullscreen-close"
        onClick={onClose}
        aria-label={t.exitFullscreen}
        className="absolute right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white active:scale-95"
        style={{ top: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <X className="h-6 w-6" />
      </button>

      <p className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-0 right-0 z-20 px-4 text-center text-xs text-white/80">
        {hold.isBlinking ? t.goldenBaseline : t.comparisonFullscreenHint}
      </p>
    </div>
  );

  return createPortal(overlay, document.body);
};
