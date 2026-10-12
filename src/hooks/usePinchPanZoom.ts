import { useCallback, useRef, useState, type CSSProperties, type TouchEvent } from 'react';

export interface PinchPanTransform {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function touchDistance(touches: TouchEvent['touches']): number {
  if (touches.length < 2) return 0;
  const t0 = touches.item(0);
  const t1 = touches.item(1);
  if (!t0 || !t1) return 0;
  const dx = t0.clientX - t1.clientX;
  const dy = t0.clientY - t1.clientY;
  return Math.hypot(dx, dy);
}

export function usePinchPanZoom(): {
  transform: PinchPanTransform;
  reset: () => void;
  style: CSSProperties;
  touchHandlers: {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: (e: TouchEvent) => void;
  };
} {
  const [transform, setTransform] = useState<PinchPanTransform>({ scale: 1, tx: 0, ty: 0 });
  const gestureRef = useRef<{
    mode: 'idle' | 'pan' | 'pinch';
    startTransform: PinchPanTransform;
    startX: number;
    startY: number;
    startDist: number;
  }>({
    mode: 'idle',
    startTransform: { scale: 1, tx: 0, ty: 0 },
    startX: 0,
    startY: 0,
    startDist: 0,
  });

  const reset = useCallback(() => {
    setTransform({ scale: 1, tx: 0, ty: 0 });
    gestureRef.current.mode = 'idle';
  }, []);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      gestureRef.current = {
        mode: 'pinch',
        startTransform: transform,
        startX: 0,
        startY: 0,
        startDist: touchDistance(e.touches),
      };
    } else if (e.touches.length === 1 && transform.scale > 1) {
      gestureRef.current = {
        mode: 'pan',
        startTransform: transform,
        startX: e.touches.item(0)?.clientX ?? 0,
        startY: e.touches.item(0)?.clientY ?? 0,
        startDist: 0,
      };
    }
  }, [transform]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const g = gestureRef.current;
    if (g.mode === 'pinch' && e.touches.length >= 2) {
      e.preventDefault();
      const dist = touchDistance(e.touches);
      if (g.startDist <= 0) return;
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, g.startTransform.scale * (dist / g.startDist)),
      );
      setTransform({ ...g.startTransform, scale: nextScale });
    } else if (g.mode === 'pan' && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches.item(0);
      if (!touch) return;
      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;
      setTransform({
        scale: g.startTransform.scale,
        tx: g.startTransform.tx + dx,
        ty: g.startTransform.ty + dy,
      });
    } else if (e.touches.length === 2 && g.mode !== 'pinch') {
      gestureRef.current = {
        mode: 'pinch',
        startTransform: transform,
        startX: 0,
        startY: 0,
        startDist: touchDistance(e.touches),
      };
    }
  }, [transform]);

  const onTouchEnd = useCallback(() => {
    gestureRef.current.mode = 'idle';
  }, []);

  const style: CSSProperties = {
    transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
    transformOrigin: 'center center',
    touchAction: 'none',
  };

  return { transform, reset, style, touchHandlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
