import {beforeEach, describe, expect, it, vi} from 'vitest';
import {compressToJpegBlob, isQuotaError} from './blobUtils';

const TEST_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';

class MockImage {
  naturalWidth = 640;
  naturalHeight = 480;
  width = 640;
  height = 480;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

describe('blobUtils', () => {
  describe('isQuotaError', () => {
    it('returns true for DOMException QuotaExceededError', () => {
      const err = new DOMException('Quota exceeded', 'QuotaExceededError');
      expect(isQuotaError(err)).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isQuotaError(new Error('other'))).toBe(false);
      expect(isQuotaError(new DOMException('Abort', 'AbortError'))).toBe(false);
      expect(isQuotaError(null)).toBe(false);
    });
  });

  describe('compressToJpegBlob', () => {
    beforeEach(() => {
      vi.stubGlobal('Image', MockImage);
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn(async (source: {width: number; height: number}) => ({
          width: source.width ?? 640,
          height: source.height ?? 480,
          close: vi.fn(),
        })),
      );

      HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        drawImage: vi.fn(),
      })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

      HTMLCanvasElement.prototype.toBlob = vi.fn(function (
        this: HTMLCanvasElement,
        callback: BlobCallback,
        type?: string,
      ) {
        callback(new Blob(['jpeg-bytes'], {type: type ?? 'image/jpeg'}));
      });
    });

    it('produces image/jpeg Blob from data URL source', async () => {
      const blob = await compressToJpegBlob(TEST_DATA_URL);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
    });

    it('produces image/jpeg Blob from Blob source', async () => {
      const source = new Blob(['png'], {type: 'image/png'});
      const blob = await compressToJpegBlob(source);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
    });
  });
});
