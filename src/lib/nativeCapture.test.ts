/**
 * @vitest-environment node
 */
import {describe, expect, it} from 'vitest';
import {
  isFramingCompatible,
  isNativeCameraBaseline,
  isSameLens,
  readExifFocalLength,
} from './nativeCapture';
import {DEFAULT_CALIBRATION} from './constants';

/** Minimal JPEG with an Exif IFD holding FocalLengthIn35mmFilm and/or FocalLength. */
function jpegWithExif(opts: {focal35?: number; focal?: [number, number]; bigEndian?: boolean}): Blob {
  const le = !opts.bigEndian;
  const tiff: number[] = [];
  const u16 = (v: number) => (le ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) =>
    le
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24]
      : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const exifEntries: number[][] = [];
  if (opts.focal35) exifEntries.push([...u16(0xa405), ...u16(3), ...u32(1), ...u16(opts.focal35), 0, 0]);
  const ifd0At = 8;
  const exifIfdAt = ifd0At + 2 + 12 + 4;
  const rationalAt = exifIfdAt + 2 + (exifEntries.length + (opts.focal ? 1 : 0)) * 12 + 4;
  if (opts.focal) exifEntries.push([...u16(0x920a), ...u16(5), ...u32(1), ...u32(rationalAt)]);
  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0At));
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifIfdAt), ...u32(0));
  tiff.push(...u16(exifEntries.length), ...exifEntries.flat(), ...u32(0));
  if (opts.focal) tiff.push(...u32(opts.focal[0]), ...u32(opts.focal[1]));
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  return new Blob([
    new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...app1, 0xff, 0xd9]),
  ]);
}

describe('readExifFocalLength', () => {
  it('prefers the 35mm-equivalent focal length', async () => {
    expect(await readExifFocalLength(jpegWithExif({focal35: 13, focal: [220, 100]}))).toBe(13);
  });

  it('falls back to the raw FocalLength rational', async () => {
    expect(await readExifFocalLength(jpegWithExif({focal: [555, 100]}))).toBeCloseTo(5.55);
  });

  it('handles big-endian (Motorola) EXIF', async () => {
    expect(await readExifFocalLength(jpegWithExif({focal35: 26, bigEndian: true}))).toBe(26);
  });

  it('returns null for non-JPEG or EXIF-less files', async () => {
    expect(await readExifFocalLength(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]))).toBeNull();
    expect(await readExifFocalLength(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])]))).toBeNull();
  });
});

describe('isSameLens', () => {
  it('rejects a 1x shot against an ultra-wide baseline', () => {
    expect(isSameLens(27, 13)).toBe(false);
  });

  it('accepts the same lens and passes when either side is unknown', () => {
    expect(isSameLens(13, 13)).toBe(true);
    expect(isSameLens(null, 13)).toBe(true);
    expect(isSameLens(27, undefined)).toBe(true);
  });
});

describe('isFramingCompatible', () => {
  it('accepts same-orientation photos with matching aspect ratio', () => {
    expect(isFramingCompatible({width: 1920, height: 1440}, {width: 4000, height: 3000})).toBe(true);
    expect(isFramingCompatible({width: 1080, height: 1920}, {width: 1080, height: 1920})).toBe(true);
  });

  it('rejects a portrait capture against a landscape baseline', () => {
    expect(isFramingCompatible({width: 1080, height: 1920}, {width: 1920, height: 1440})).toBe(false);
  });

  it('rejects a clearly different aspect ratio in the same orientation', () => {
    expect(isFramingCompatible({width: 1920, height: 1080}, {width: 1920, height: 1440})).toBe(false);
  });

  it('rejects empty dimensions', () => {
    expect(isFramingCompatible({width: 0, height: 0}, {width: 1920, height: 1440})).toBe(false);
  });
});

describe('isNativeCameraBaseline', () => {
  it('detects uploaded / OS-camera baselines by id', () => {
    expect(isNativeCameraBaseline({...DEFAULT_CALIBRATION, id: 'custom-baseline-1727'})).toBe(true);
  });

  it('treats in-app captured baselines as live', () => {
    expect(isNativeCameraBaseline({...DEFAULT_CALIBRATION, id: 'baseline-0-1727'})).toBe(false);
    expect(isNativeCameraBaseline(DEFAULT_CALIBRATION)).toBe(false);
  });
});
