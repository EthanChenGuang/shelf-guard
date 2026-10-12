import type { CSSProperties } from 'react';

function aspectRatio(dims: { width: number; height: number }): number {
  return dims.width > 0 && dims.height > 0 ? dims.width / dims.height : 9 / 16;
}

/**
 * Box that keeps the photo's own aspect ratio (so %-positioned overlays line up with the
 * pixels) while fitting within 28rem wide and `maxHeight` tall.
 *
 * Width is a definite `min()` so a block with `mx-auto` actually centers — do not wrap this
 * in `width: fit-content` with a child `min(100%, …)` (100% cyclic sizing left-aligns).
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

/** Uniform cover of a pixel-sized viewport (visual viewport, not 100dvh/100vw). */
export function coverViewportStyle(
  dims: { width: number; height: number },
  viewport: { width: number; height: number },
): CSSProperties {
  const ratio = aspectRatio(dims);
  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);
  const containerRatio = vw / vh;
  if (ratio >= containerRatio) {
    return {
      aspectRatio: `${ratio}`,
      height: `${vh}px`,
      width: `${vh * ratio}px`,
      maxWidth: 'none',
      maxHeight: 'none',
    };
  }
  return {
    aspectRatio: `${ratio}`,
    width: `${vw}px`,
    height: `${vw / ratio}px`,
    maxWidth: 'none',
    maxHeight: 'none',
  };
}
