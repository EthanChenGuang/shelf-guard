import { useEffect } from 'react';

function lockHorizontalViewport() {
  // Only undo a horizontal offset; keep the user's vertical scroll position.
  window.scrollTo(0, window.scrollY);
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  const root = document.getElementById('root');
  if (root) root.scrollLeft = 0;
  document.documentElement.style.overflowX = 'hidden';
  document.body.style.overflowX = 'hidden';
  if (root) root.style.overflowX = 'hidden';
}

/**
 * After iOS/Android rotate (or a leftover page-pinch), visualViewport offset /
 * scrollX can leave a white strip on the left with content shifted right.
 * Lock overflow-x and snap scroll on orientationchange/resize for every screen.
 */
export function useLayoutViewportLock(): void {
  useEffect(() => {
    const run = () => {
      lockHorizontalViewport();
      requestAnimationFrame(lockHorizontalViewport);
    };
    const delayed = () => {
      run();
      window.setTimeout(run, 50);
      window.setTimeout(run, 250);
    };
    const preventPagePinch = (ev: TouchEvent) => {
      if (ev.touches.length >= 2) ev.preventDefault();
    };
    const preventGesture = (ev: Event) => {
      ev.preventDefault();
    };
    window.addEventListener('orientationchange', delayed);
    window.addEventListener('resize', delayed);
    window.visualViewport?.addEventListener('resize', run);
    window.visualViewport?.addEventListener('scroll', run);
    document.addEventListener('touchmove', preventPagePinch, { passive: false, capture: true });
    document.addEventListener('touchstart', preventPagePinch, { passive: false, capture: true });
    // iOS Safari native page-pinch; not the zoom implementation (TouchEvents still drive scale).
    document.addEventListener('gesturestart', preventGesture, { passive: false, capture: true });
    document.addEventListener('gesturechange', preventGesture, { passive: false, capture: true });
    run();
    return () => {
      window.removeEventListener('orientationchange', delayed);
      window.removeEventListener('resize', delayed);
      window.visualViewport?.removeEventListener('resize', run);
      window.visualViewport?.removeEventListener('scroll', run);
      document.removeEventListener('touchmove', preventPagePinch, true);
      document.removeEventListener('touchstart', preventPagePinch, true);
      document.removeEventListener('gesturestart', preventGesture, true);
      document.removeEventListener('gesturechange', preventGesture, true);
    };
  }, []);
}
