import { useEffect } from 'react';

export const INSPECT_ZOOMED_ATTR = 'data-inspect-zoomed';

export function isInspectZoomed(): boolean {
  return document.documentElement.getAttribute(INSPECT_ZOOMED_ATTR) === 'true';
}

function appShell(): HTMLElement | null {
  const root = document.getElementById('root');
  return (root?.firstElementChild as HTMLElement | null) ?? null;
}

function lockHorizontalViewport() {
  window.scrollTo(0, 0);
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  const root = document.getElementById('root');
  if (root) root.scrollLeft = 0;
  if (isInspectZoomed()) return;
  const html = document.documentElement;
  const body = document.body;
  html.style.overflowX = 'hidden';
  body.style.overflowX = 'hidden';
  if (root) root.style.overflowX = 'hidden';
}

/** While the results image is pinch-zoomed, lift overflow clipping so it can paint over the screen. */
export function setInspectZoomed(zoomed: boolean): void {
  const html = document.documentElement;
  const body = document.body;
  const root = document.getElementById('root');
  const app = appShell();
  if (zoomed) {
    html.setAttribute(INSPECT_ZOOMED_ATTR, 'true');
    html.style.overflowX = 'visible';
    html.style.overflowY = 'visible';
    body.style.overflowX = 'visible';
    body.style.overflowY = 'visible';
    if (root) {
      root.style.overflowX = 'visible';
      root.style.overflowY = 'visible';
    }
    if (app) {
      app.style.overflowX = 'visible';
      app.style.overflowY = 'visible';
    }
    return;
  }
  html.removeAttribute(INSPECT_ZOOMED_ATTR);
  html.style.overflowY = '';
  body.style.overflowY = '';
  if (root) root.style.overflowY = '';
  if (app) {
    app.style.overflowX = '';
    app.style.overflowY = '';
  }
  lockHorizontalViewport();
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
