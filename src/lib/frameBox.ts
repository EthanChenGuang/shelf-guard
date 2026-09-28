import type { CSSProperties } from 'react';

/**
 * Box that keeps the photo's own aspect ratio (so %-positioned overlays line up with the
 * pixels) while fitting within 28rem wide and `maxHeight` tall.
 */
export function frameBoxStyle(
  dims: { width: number; height: number },
  maxHeight: string,
): CSSProperties {
  const ratio = dims.width > 0 && dims.height > 0 ? dims.width / dims.height : 9 / 16;
  return {
    aspectRatio: `${ratio}`,
    width: `min(100%, 28rem, calc(${maxHeight} * ${ratio.toFixed(4)}))`,
  };
}
