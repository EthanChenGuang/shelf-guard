import { useLayoutEffect } from 'react';

export const ZOOM_MODE_ATTR = 'data-inspect-zoom-mode';

/**
 * Freeze page scroll under a full-screen modal. `overflow: hidden` alone does not stop
 * touch scrolling on older iOS Safari, so the body is also pinned with `position: fixed`
 * at the current offset. Returns a restore function that puts back the exact inline styles
 * of <html>/<body> and the previous scroll position.
 */
export function lockBodyScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const htmlCss = html.style.cssText;
  const bodyCss = body.style.cssText;

  html.setAttribute(ZOOM_MODE_ATTR, 'true');
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `${-scrollY}px`;
  body.style.left = `${-scrollX}px`;
  body.style.right = '0';
  body.style.width = '100%';

  return () => {
    html.style.cssText = htmlCss;
    body.style.cssText = bodyCss;
    html.removeAttribute(ZOOM_MODE_ATTR);
    window.scrollTo(scrollX, scrollY);
  };
}

export function useBodyScrollLock(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}
