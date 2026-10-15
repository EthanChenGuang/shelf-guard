import { useEffect } from 'react';

function resetHorizontalOffset() {
  // Only undo a sideways offset; never touch the vertical position (a scrollTo while the user is
  // scrolling kills iOS momentum and snaps Android back to a stale main-thread scrollY).
  if (window.scrollX !== 0) window.scrollTo({ left: 0 });
}

/**
 * After iOS/Android rotate, the layout viewport can keep a horizontal offset that leaves a white
 * strip on the left. CSS (`html { overflow-x: hidden }`, body/#root `overflow-x: clip`) stops the
 * page from being wider than the viewport; this snaps any leftover scrollX back on rotation only.
 *
 * No resize/visualViewport handlers: those fire continuously while mobile toolbars collapse during
 * a scroll. No document touch listeners: page pinch is blocked by `touch-action: pan-y` on <html>
 * (Chrome) and `gesturestart` (iOS Safari ignores user-scalable=no); gesture events never cancel a
 * one-finger scroll. Zoom-mode pinch listeners live on the overlay stage only.
 */
export function useLayoutViewportLock(): void {
  useEffect(() => {
    const timers: number[] = [];
    const onOrientationChange = () => {
      resetHorizontalOffset();
      timers.push(window.setTimeout(resetHorizontalOffset, 50), window.setTimeout(resetHorizontalOffset, 250));
    };
    const preventGesture = (ev: Event) => {
      ev.preventDefault();
    };
    window.addEventListener('orientationchange', onOrientationChange);
    // iOS Safari native page-pinch; not the zoom implementation (TouchEvents still drive scale).
    document.addEventListener('gesturestart', preventGesture, { passive: false, capture: true });
    document.addEventListener('gesturechange', preventGesture, { passive: false, capture: true });
    resetHorizontalOffset();
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('orientationchange', onOrientationChange);
      document.removeEventListener('gesturestart', preventGesture, true);
      document.removeEventListener('gesturechange', preventGesture, true);
    };
  }, []);
}
