export const SWIPE_THRESHOLD_PX = 50;

export interface ShelfSwipeOptions {
  enabled: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

export function attachShelfSwipe(
  el: HTMLElement,
  opts: ShelfSwipeOptions,
): () => void {
  let startX = 0;
  let startY = 0;

  const onPointerDown = (e: PointerEvent) => {
    if (!opts.enabled) return;
    startX = e.clientX;
    startY = e.clientY;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!opts.enabled) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) opts.onSwipeLeft();
    else opts.onSwipeRight();
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
  };
}
