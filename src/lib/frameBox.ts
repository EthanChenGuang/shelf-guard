import type { CSSProperties } from 'react';

export function aspectRatio(dims: { width: number; height: number }): number {
  return dims.width > 0 && dims.height > 0 ? dims.width / dims.height : 9 / 16;
}

/**
 * Box that keeps the photo's own aspect ratio (so %-positioned overlays line up with the
 * pixels) while fitting within the available width less `sideGutter` and `maxHeight` tall.
 *
 * Width is a definite `min()` so a block with `mx-auto` actually centers — do not wrap this
 * in `width: fit-content` with a child `min(100%, …)` (100% cyclic sizing left-aligns).
 */
export function frameBoxStyle(
  dims: { width: number; height: number },
  maxHeight: string,
  sideGutter = '0px',
): CSSProperties {
  const ratio = aspectRatio(dims);
  return {
    aspectRatio: `${ratio}`,
    width: `min(calc(100% - ${sideGutter}), calc(${maxHeight} * ${ratio.toFixed(4)}))`,
  };
}
