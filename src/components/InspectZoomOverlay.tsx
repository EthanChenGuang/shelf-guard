import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DetectedAnomaly, Language, ShelfCalibration } from '../types';
import { I18N } from '../lib/constants';
import { InspectShelfCanvas } from './InspectShelfCanvas';
import type { BlinkCompareHold } from '../hooks/useBlinkCompareHold';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePinchPanZoom } from '../hooks/usePinchPanZoom';
import { touchAt } from '../lib/touchAt';
import { aspectRatio } from '../lib/frameBox';

interface InspectZoomOverlayProps {
  imageUrl: string;
  baseline: ShelfCalibration;
  activeAnomalies: DetectedAnomaly[];
  showArLayers: boolean;
  showingBaseline: boolean;
  hold: BlinkCompareHold;
  lang: Language;
  onDismissAnomaly: (id: string, e: React.MouseEvent) => void;
  onExit: () => void;
}

/**
 * Full-screen zoom mode for the results photo. Pinch/pan only exist here (touch-action: none
 * on the stage), so the inline photo never captures vertical page swipes. Page scroll is
 * locked while open and fully restored on unmount.
 */
export const InspectZoomOverlay: React.FC<InspectZoomOverlayProps> = ({
  imageUrl,
  baseline,
  activeAnomalies,
  showArLayers,
  showingBaseline,
  hold,
  lang,
  onDismissAnomaly,
  onExit,
}) => {
  const t = I18N[lang];
  const stageRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const { transform, style, touchHandlers, pointerHandlers } = usePinchPanZoom(stageRef);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useBodyScrollLock(true);

  useEffect(() => {
    exitRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExitRef.current();
      } else if (e.key === 'Tab') {
        // The close button is the only focusable control; keep focus inside the dialog.
        e.preventDefault();
        exitRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const ratio = aspectRatio(baseline.imageDimensions);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.zoomDialog}
      data-testid="inspect-zoom-overlay"
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-black select-none"
      style={{ touchAction: 'none' }}
    >
      <div
        ref={stageRef}
        data-testid="inspect-zoom-stage"
        data-zoom-scale={transform.scale.toFixed(2)}
        className="relative flex min-h-0 flex-1 items-center justify-center"
        style={{ touchAction: 'none', containerType: 'size' }}
        onMouseDown={(e) => hold.begin(e.clientX, e.clientY)}
        onMouseMove={(e) => {
          if (e.buttons) hold.move(e.clientX, e.clientY);
        }}
        onMouseUp={() => hold.end()}
        onMouseLeave={() => hold.cancel()}
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
          if (e.touches.length === 0) hold.end();
          else hold.cancel();
        }}
        onTouchCancel={(e) => {
          touchHandlers.onTouchEnd(e);
          hold.cancel();
        }}
        onPointerDown={(e) => pointerHandlers.onPointerDown(e)}
        onPointerMove={(e) => pointerHandlers.onPointerMove(e)}
        onPointerUp={(e) => pointerHandlers.onPointerUp(e)}
        onPointerCancel={(e) => pointerHandlers.onPointerUp(e)}
      >
        <div
          data-testid="inspect-zoom-layer"
          style={{
            ...style,
            aspectRatio: `${ratio}`,
            width: `min(100cqw, calc(100cqh * ${ratio.toFixed(4)}))`,
          }}
        >
          <InspectShelfCanvas
            imageUrl={imageUrl}
            baseline={baseline}
            activeAnomalies={activeAnomalies}
            showArLayers={showArLayers}
            lang={lang}
            onDismissAnomaly={onDismissAnomaly}
            showingBaseline={showingBaseline}
          />
        </div>
      </div>

      <div
        data-testid="inspect-zoom-hint"
        role="status"
        className="pointer-events-none relative z-10 flex shrink-0 justify-center bg-black/70 px-3 pt-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <span
          className={`max-w-full truncate rounded-full px-3 py-1 text-xs font-bold ring-1 ${
            showingBaseline ? 'bg-emerald-950/85 text-emerald-50 ring-emerald-200/90' : 'text-white ring-white/60'
          }`}
        >
          {showingBaseline ? t.goldenBaseline : t.zoomModeHint}
        </span>
      </div>

      <button
        ref={exitRef}
        type="button"
        onClick={onExit}
        aria-label={t.zoomExit}
        data-testid="inspect-zoom-exit"
        className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white ring-2 ring-white/80 shadow-lg active:scale-95"
        style={{
          top: 'max(0.75rem, env(safe-area-inset-top))',
          right: 'max(0.75rem, env(safe-area-inset-right))',
        }}
      >
        <X className="h-6 w-6" />
      </button>
    </div>,
    document.body,
  );
};
