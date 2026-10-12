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

/**
 * Visible rect inside the layout viewport. Height is min(innerHeight, measured
 * 100svh, visualViewport.height); top is max(offsetTop, innerHeight - height)
 * so a WebKit lie (offsetTop 0 while chrome still covers the top) still parks
 * the overlay below the bar.
 */
export function readVisibleViewport(
  metrics: ViewportMetrics,
  small: SmallViewportSize,
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

  return { offsetTop: top, offsetLeft: left, width, height };
}

export function measureCssSmallViewport(): SmallViewportSize {
  if (typeof document === 'undefined') {
    return { width: 0, height: 0 };
  }
  const probe = document.createElement('div');
  probe.setAttribute('data-css-small-viewport', 'true');
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:100svw;height:100svh;pointer-events:none;visibility:hidden;';
  document.documentElement.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { width: rect.width, height: rect.height };
}

function readFromWindow(): VisualViewportRect {
  const vv = window.visualViewport;
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
    window.addEventListener('orientationchange', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return rect;
}
