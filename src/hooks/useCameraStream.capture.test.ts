import {beforeEach, describe, expect, it, vi} from 'vitest';
import {DEFAULT_SHELF_IMAGE_URL} from '../lib/constants';
import {captureDemoFrameFromUrl} from './useCameraStream';

const TEST_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';

class MockImage {
  naturalWidth = 100;
  naturalHeight = 100;
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

describe('useCameraStream captureFrame (CAM-09)', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage);
    const drawImage = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({drawImage})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => 'data:image/jpeg;base64,capturedFromBaseline',
    );
  });

  it('demo capture returns data:image/jpeg URL, not DEFAULT_SHELF_IMAGE_URL', async () => {
    const result = await captureDemoFrameFromUrl(TEST_DATA_URL);
    expect(result).toMatch(/^data:image\/jpeg/);
    expect(result).not.toBe(DEFAULT_SHELF_IMAGE_URL);
  });

  it('uses the passed baselineImageUrl in demo mode (drawImage called on loaded img)', async () => {
    const drawImage = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({drawImage})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    await captureDemoFrameFromUrl(TEST_DATA_URL);

    expect(drawImage).toHaveBeenCalled();
    const drawnImg = drawImage.mock.calls[0]?.[0] as MockImage;
    expect(drawnImg?.src).toBe(TEST_DATA_URL);
  });
});
