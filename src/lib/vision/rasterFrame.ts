export interface RasterFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Decode ImageBitmap to RGBA raster (worker-safe via OffscreenCanvas). */
export async function rasterFromImageBitmap(bitmap: ImageBitmap): Promise<RasterFrame> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return {
    width: bitmap.width,
    height: bitmap.height,
    data: imageData.data,
  };
}

/** Build RasterFrame from RGBA bytes (test fixture loader). */
export function rasterFromRgba(
  width: number,
  height: number,
  data: Uint8Array | Uint8ClampedArray,
): RasterFrame {
  return {
    width,
    height,
    data: data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data),
  };
}
