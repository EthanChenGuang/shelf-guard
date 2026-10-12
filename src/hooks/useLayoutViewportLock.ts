import { useEffect } from 'react';

function lockHorizontalViewport() {
  const html = document.documentElement;
  const body = document.body;
  html.style.overflowX = 'hidden';
  body.style.overflowX = 'hidden';
  html.scrollLeft = 0;
  body.scrollLeft = 0;
  window.scrollTo(0, 0);
  const root = document.getElementById('root');
  if (root) {
    root.style.overflowX = 'hidden';
    root.scrollLeft = 0;
  }
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
    window.addEventListener('orientationchange', delayed);
    window.addEventListener('resize', delayed);
    window.visualViewport?.addEventListener('resize', run);
    window.visualViewport?.addEventListener('scroll', run);
    document.addEventListener('touchmove', preventPagePinch, { passive: false, capture: true });
    document.addEventListener('touchstart', preventPagePinch, { passive: false, capture: true });
    run();
    return () => {
      window.removeEventListener('orientationchange', delayed);
      window.removeEventListener('resize', delayed);
      window.visualViewport?.removeEventListener('resize', run);
      window.visualViewport?.removeEventListener('scroll', run);
      document.removeEventListener('touchmove', preventPagePinch, true);
      document.removeEventListener('touchstart', preventPagePinch, true);
    };
  }, []);
}
