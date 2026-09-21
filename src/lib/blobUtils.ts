/** Convert a data URL to a Blob via fetch — used in migration and save paths (D-06). */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Detect IndexedDB quota exhaustion from idb-keyval write failures (D-19). */
export function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'QuotaExceededError';
}

/** Downscale and compress to JPEG Blob for audit thumbnails (D-12). */
export async function compressToJpegBlob(
  source: Blob | string,
  maxWidth = 320,
  quality = 0.75,
): Promise<Blob> {
  const bitmap =
    source instanceof Blob
      ? await createImageBitmap(source)
      : await loadBitmapFromDataUrl(source);

  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });
}

function loadBitmapFromDataUrl(dataUrl: string): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      createImageBitmap(img).then(resolve).catch(reject);
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}
