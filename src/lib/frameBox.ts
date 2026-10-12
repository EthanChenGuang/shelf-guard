import type { CSSProperties } from 'react';

function aspectRatio(dims: { width: number; height: number }): number {
  return dims.width > 0 && dims.height > 0 ? dims.width / dims.height : 9 / 16;
}

/**
 * Box that keeps the photo's own aspect ratio (so %-positioned overlays line up with the
 * pixels) while fitting within 28rem wide and `maxHeight` tall.
 */
export function frameBoxStyle(
  dims: { width: number; height: number },
  maxHeight: string,
): CSSProperties {
  const ratio = aspectRatio(dims);
  return {
    aspectRatio: `${ratio}`,
    width: `min(100%, 28rem, calc(${maxHeight} * ${ratio.toFixed(4)}))`,
  };
}

/**
 * Uniformly scale the photo box so it covers the phone viewport. Overflow is clipped by
 * the fullscreen stage; overlay percentages still match the image pixels.
 */
export function coverViewportStyle(dims: { width: number; height: number }): CSSProperties {
  const ratio = aspectRatio(dims);
  return {
    aspectRatio: `${ratio}`,
    width: `max(100vw, calc(100dvh * ${ratio.toFixed(4)}))`,
    height: `max(100dvh, calc(100vw / ${ratio.toFixed(4)}))`,
    maxWidth: 'none',
    maxHeight: 'none',
  };
}
