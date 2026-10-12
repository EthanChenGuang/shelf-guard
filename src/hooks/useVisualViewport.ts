import { useEffect, useState } from 'react';

export interface VisualViewportRect {
  offsetTop: number;
  offsetLeft: number;
  width: number;
  height: number;
}

export interface ViewportMetrics {
  innerWidth: number;
  innerHeight: number;
  visualViewport?: {
    offsetTop: number;
    offsetLeft: number;
    width: number;
    height: number;
  };
}

export interface SmallViewportSize {
  width: number;
  height: number;
}

function positiveOrAbsent(n: number | undefined): number | undefined {
  return typeof n === 'number' && n > 0 ? n : undefined;
}

/** Typical iOS Edge/Safari overlay address bar. Used only when every metric agrees on the full layout viewport. */
export const IOS_OVERLAY_CHROME_PX = 56;

type WebkitDocument = Document & { webkitFullscreenElement?: Element | null };

/** iPhone/iPad (including iPadOS desktop UA). Not Android, where innerHeight already excludes chrome. */
export function iosOverlayChromePx(
  nav: { userAgent?: string; platform?: string; maxTouchPoints?: number } | undefined,
  fullscreenActive: boolean,
): number {
  if (!nav) return 0;
  const ua = nav.userAgent ?? '';
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
  if (!ios || fullscreenActive) return 0;
  return IOS_OVERLAY_CHROME_PX;
}

/**
 * Visible rect inside the layout viewport. Height is min(innerHeight, measured
 * 100svh, visualViewport.height); top is max(offsetTop, innerHeight - height)
 * so a WebKit lie (offsetTop 0 while chrome still covers the top) still parks
 * the overlay below the bar.
 *
 * When every API still reports the full layout size on iOS (100svh === innerHeight
 * and visualViewport.offsetTop === 0), apply a conservative top inset so the
 * overlay does not sit under a persistent address bar.
 */
export function readVisibleViewport(
  metrics: ViewportMetrics,
  small: SmallViewportSize,
  fallbackChromePx = 0,
): VisualViewportRect {
  const visualWidth = metrics.visualViewport?.width ?? metrics.innerWidth;
  const visualHeight = metrics.visualViewport?.height ?? metrics.innerHeight;
  const offsetTop = metrics.visualViewport?.offsetTop ?? 0;
  const offsetLeft = metrics.visualViewport?.offsetLeft ?? 0;
  const smallW = positiveOrAbsent(small.width);
  const smallH = positiveOrAbsent(small.height);

  const width = Math.min(metrics.innerWidth, smallW ?? visualWidth, visualWidth);
  const height = Math.min(metrics.innerHeight, smallH ?? visualHeight, visualHeight);
  const top = Math.max(offsetTop, metrics.innerHeight - height);
  const left = Math.max(offsetLeft, metrics.innerWidth - width);

  if (fallbackChromePx > 0 && height >= metrics.innerHeight - 1 && top <= 0) {
    return {
      offsetTop: fallbackChromePx,
      offsetLeft: left,
      width,
      height: Math.max(1, metrics.innerHeight - fallbackChromePx),
    };
  }

  return { offsetTop: top, offsetLeft: left, width, height };
}

export function measureCssSmallViewport(): SmallViewportSize {
  if (typeof document === 'undefined') {
    return { width: 0, height: 0 };
  }
  const probe = document.createElement('div');
  probe.setAttribute('data-css-small-viewport', 'true');
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:100svw;height:100svh;pointer-events:none;opacity:0;z-index:-1;';
  document.documentElement.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { width: rect.width, height: rect.height };
}

function readFromWindow(): VisualViewportRect {
  const vv = window.visualViewport;
  const doc = document as WebkitDocument;
  return readVisibleViewport(
    {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualViewport: vv
        ? {
            offsetTop: vv.offsetTop,
            offsetLeft: vv.offsetLeft,
            width: vv.width,
            height: vv.height,
          }
        : undefined,
    },
    measureCssSmallViewport(),
    iosOverlayChromePx(navigator, !!(doc.fullscreenElement || doc.webkitFullscreenElement)),
  );
}

/** Visible browser viewport, including address-bar and pinch-zoom offsets on mobile. */
export function useVisualViewport(): VisualViewportRect {
  const [rect, setRect] = useState<VisualViewportRect>(() =>
    typeof window === 'undefined'
      ? { offsetTop: 0, offsetLeft: 0, width: 0, height: 0 }
      : readFromWindow(),
  );

  useEffect(() => {
    const update = () => setRect(readFromWindow());
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    const onOrientation = () => {
      update();
      window.setTimeout(update, 250);
    };
    window.addEventListener('orientationchange', onOrientation);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, []);

  return rect;
}
