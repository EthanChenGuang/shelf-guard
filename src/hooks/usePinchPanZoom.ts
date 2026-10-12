import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject, type TouchEvent } from 'react';
import { touchAt } from '../lib/touchAt';

export interface PinchPanTransform {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const PAN_START_PX = 8;

function touchDistance(touches: TouchEvent['touches'] | TouchList): number {
  if (touches.length < 2) return 0;
  const t0 = touchAt(touches, 0);
  const t1 = touchAt(touches, 1);
  if (!t0 || !t1) return 0;
  return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
}

function remainingCount(e?: TouchEvent | globalThis.TouchEvent): number {
  return e?.touches?.length ?? 0;
}

export function usePinchPanZoom(targetRef?: RefObject<HTMLElement | null>): {
  transform: PinchPanTransform;
  reset: () => void;
  style: CSSProperties;
  touchHandlers: {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: (e?: TouchEvent) => void;
  };
} {
  const [transform, setTransform] = useState<PinchPanTransform>({ scale: 1, tx: 0, ty: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;
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
    const next = { scale: 1, tx: 0, ty: 0 };
    transformRef.current = next;
    setTransform(next);
    gestureRef.current.mode = 'idle';
  }, []);

  const reanchorPinch = (touches: TouchEvent['touches'] | TouchList) => {
    gestureRef.current = {
      mode: 'pinch',
      startTransform: transformRef.current,
      startX: 0,
      startY: 0,
      startDist: touchDistance(touches),
    };
  };

  const reanchorPanOrigin = (touches: TouchEvent['touches'] | TouchList) => {
    const t = touchAt(touches, 0);
    gestureRef.current = {
      mode: 'idle',
      startTransform: transformRef.current,
      startX: t?.clientX ?? 0,
      startY: t?.clientY ?? 0,
      startDist: 0,
    };
  };

  const onTouchStart = useCallback((e: TouchEvent) => {
    const current = transformRef.current;
    if (e.touches.length >= 2) {
      reanchorPinch(e.touches);
      return;
    }
    if (e.touches.length === 1 && current.scale > 1) {
      reanchorPanOrigin(e.touches);
    }
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const g = gestureRef.current;
    const current = transformRef.current;
    if (e.touches.length >= 2) {
      e.preventDefault();
      if (g.mode !== 'pinch') {
        reanchorPinch(e.touches);
      }
      const dist = touchDistance(e.touches);
      const startDist = gestureRef.current.startDist;
      if (startDist <= 0) return;
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, gestureRef.current.startTransform.scale * (dist / startDist)),
      );
      const next = { ...gestureRef.current.startTransform, scale: nextScale };
      transformRef.current = next;
      setTransform(next);
      return;
    }
    if (e.touches.length === 1 && current.scale > 1) {
      const touch = touchAt(e.touches, 0);
      if (!touch) return;
      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;
      if (g.mode !== 'pan') {
        if (Math.hypot(dx, dy) < PAN_START_PX) return;
        gestureRef.current.mode = 'pan';
      }
      e.preventDefault();
      const next = {
        scale: g.startTransform.scale,
        tx: g.startTransform.tx + dx,
        ty: g.startTransform.ty + dy,
      };
      transformRef.current = next;
      setTransform(next);
    }
  }, []);

  const onTouchEnd = useCallback((e?: TouchEvent) => {
    const remaining = remainingCount(e);
    if (remaining >= 2 && e) {
      reanchorPinch(e.touches);
      return;
    }
    if (remaining === 1 && e) {
      reanchorPanOrigin(e.touches);
      return;
    }
    gestureRef.current.mode = 'idle';
  }, []);

  useEffect(() => {
    const el = targetRef?.current;
    if (!el) return;
    const preventPageZoom = (ev: globalThis.TouchEvent) => {
      if (ev.touches.length >= 2 || transformRef.current.scale > 1) {
        ev.preventDefault();
      }
    };
    el.addEventListener('touchstart', preventPageZoom, { passive: false });
    el.addEventListener('touchmove', preventPageZoom, { passive: false });
    return () => {
      el.removeEventListener('touchstart', preventPageZoom);
      el.removeEventListener('touchmove', preventPageZoom);
    };
  }, [targetRef]);

  const style: CSSProperties = {
    transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
    transformOrigin: 'center center',
    touchAction: 'none',
  };

  return { transform, reset, style, touchHandlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
