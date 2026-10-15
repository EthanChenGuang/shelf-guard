import { useEffect } from 'react';

const VAR = '--inspect-vh';
/** iOS fires orientationchange before innerHeight settles: resizes this soon after a rotation count too. */
const ROTATION_SETTLE_MS = 1000;

/**
 * Pins the viewport height used to size the results photo (`--inspect-vh`, px on <html>) to its
 * value at mount, instead of `100dvh`, which follows the mobile URL bar and made the photo grow and
 * shrink while the page scrolled.
 *
 * Re-measured only on rotation (orientationchange / orientation media query) or a real width change.
 * A height-only resize (toolbar collapsing mid-scroll) is ignored. Never scrolls; registers no touch
 * listeners, only a passive resize listener that compares the width.
 */
export function useStableViewportHeight(): void {
  useEffect(() => {
    const root = document.documentElement;
    let width = window.innerWidth;
    let rotatedAt = -Infinity;
    const measure = () => {
      width = window.innerWidth;
      root.style.setProperty(VAR, `${window.innerHeight}px`);
    };
    const onRotate = () => {
      rotatedAt = Date.now();
      measure();
    };
    const onResize = () => {
      if (Math.abs(window.innerWidth - width) > 1 || Date.now() - rotatedAt < ROTATION_SETTLE_MS) measure();
    };
    const portrait = window.matchMedia?.('(orientation: portrait)');
    measure();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onRotate);
    portrait?.addEventListener?.('change', onRotate);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onRotate);
      portrait?.removeEventListener?.('change', onRotate);
      root.style.removeProperty(VAR);
    };
  }, []);
}
