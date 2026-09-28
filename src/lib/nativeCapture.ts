import type { ShelfCalibration } from '../types';

const MAX_LONG_EDGE = 1920;
const ASPECT_TOLERANCE = 0.12;

// Uploaded baselines come from the OS camera/gallery and always carry this id prefix.
export function isNativeCameraBaseline(baseline: ShelfCalibration): boolean {
  return baseline.id.startsWith('custom-baseline-');
}

/** Decode a system-camera photo with EXIF orientation applied, downscaled to a 1920px long edge. */
export async function normalizeNativePhoto(
  file: Blob,
): Promise<{ dataUrl: string; width: number; height: number; focalLength: number | null }> {
  const focalLength = await readExifFocalLength(file);
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width, height, focalLength };
  } finally {
    bitmap.close();
  }
}

const FOCAL_TOLERANCE = 0.15;

/**
 * Read the lens focal length from JPEG EXIF: 35mm-equivalent (0xA405) when present, else raw
 * FocalLength (0x920A). Returns null when the file has no usable EXIF.
 */
export async function readExifFocalLength(file: Blob): Promise<number | null> {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      const size = view.getUint16(offset + 2);
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
        return parseTiffFocal(view, offset + 10);
      }
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

function parseTiffFocal(view: DataView, tiff: number): number | null {
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);
  const findTag = (ifd: number, tag: number): number | null => {
    const count = u16(ifd);
    for (let i = 0; i < count; i += 1) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === tag) return entry;
    }
    return null;
  };
  const exifPtr = findTag(tiff + u32(tiff + 4), 0x8769);
  if (exifPtr === null) return null;
  const exifIfd = tiff + u32(exifPtr + 8);
  const eq35 = findTag(exifIfd, 0xa405);
  if (eq35 !== null && u16(eq35 + 8) > 0) return u16(eq35 + 8);
  const focal = findTag(exifIfd, 0x920a);
  if (focal !== null) {
    const valueAt = tiff + u32(focal + 8);
    const den = u32(valueAt + 4);
    if (den > 0) return u32(valueAt) / den;
  }
  return null;
}

/** False only when both focal lengths are known and differ (i.e. a different lens was used). */
export function isSameLens(a: number | null | undefined, b: number | null | undefined): boolean {
  if (!a || !b) return true;
  return Math.abs(a - b) / b <= FOCAL_TOLERANCE;
}

/** True when two images have the same orientation and a comparable aspect ratio. */
export function isFramingCompatible(
  a: { width: number; height: number },
  b: { width: number; height: number },
): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.abs(ra - rb) / rb <= ASPECT_TOLERANCE;
}
