/** Draw source into dest canvas using CSS object-cover (center crop). */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  destWidth: number,
  destHeight: number,
): void {
  if (srcWidth <= 0 || srcHeight <= 0) return;
  const scale = Math.max(destWidth / srcWidth, destHeight / srcHeight);
  const drawW = srcWidth * scale;
  const drawH = srcHeight * scale;
  const x = (destWidth - drawW) / 2;
  const y = (destHeight - drawH) / 2;
  ctx.drawImage(source, x, y, drawW, drawH);
}
