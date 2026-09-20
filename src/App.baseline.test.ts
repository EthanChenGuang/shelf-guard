import {beforeEach, describe, expect, it, vi} from 'vitest';
import {loadImageDimensions} from './lib/imageDimensions';

const TEST_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';

class MockImage {
  naturalWidth = 1920;
  naturalHeight = 1080;
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

describe('App baseline upload (STAB-04)', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage);
  });

  it('loadImageDimensions returns naturalWidth/naturalHeight from data URL', async () => {
    const dims = await loadImageDimensions(TEST_DATA_URL);
    expect(dims.width).toBe(1920);
    expect(dims.height).toBe(1080);
  });
});
