import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  captureVideoFrame,
  waitForVideoReady,
} from './useCameraStream';

type VideoStub = HTMLVideoElement & { emit: (type: string) => void };

function makeVideoStub(overrides: Partial<HTMLVideoElement> = {}): VideoStub {
  const listeners = new Map<string, Set<EventListener>>();
  const stub = {
    videoWidth: 0,
    videoHeight: 0,
    readyState: HTMLMediaElement.HAVE_NOTHING,
    paused: false,
    srcObject: {} as MediaStream,
    play: vi.fn(async () => {}),
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        listener(new Event(type));
      }
    },
    ...overrides,
  };
  return stub as VideoStub;
}

function stubNonBlackCanvas() {
  const drawImage = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage,
    getImageData: () => ({
      data: new Uint8ClampedArray([200, 200, 200, 255]),
    }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => 'data:image/jpeg;base64,live-frame',
  );
}

describe('useCameraStream live capture helpers', () => {
  beforeEach(() => {
    stubNonBlackCanvas();
  });

  it('waitForVideoReady resolves immediately when a decoded frame exists', async () => {
    const video = makeVideoStub({
      videoWidth: 1280,
      readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    await expect(waitForVideoReady(video, 100)).resolves.toBe(true);
  });

  it('waitForVideoReady resolves after loadeddata when video mounts late', async () => {
    const video = makeVideoStub();
    const readyPromise = waitForVideoReady(video, 1000);

    queueMicrotask(() => {
      Object.defineProperty(video, 'videoWidth', {value: 1920, configurable: true});
      Object.defineProperty(video, 'readyState', {
        value: HTMLMediaElement.HAVE_CURRENT_DATA,
        configurable: true,
      });
      video.emit('loadeddata');
    });

    await expect(readyPromise).resolves.toBe(true);
  });

  it('captureVideoFrame returns JPEG data URL from the live video element', async () => {
    const video = makeVideoStub({
      videoWidth: 1920,
      videoHeight: 1080,
      readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    const frame = await captureVideoFrame(video);
    expect(frame).toBe('data:image/jpeg;base64,live-frame');
    expect(frame).toMatch(/^data:image\/jpeg/);
  });

  it('captureVideoFrame retries when the first canvas sample is black', async () => {
    let attempts = 0;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
      getImageData: () => {
        attempts += 1;
        const value = attempts >= 2 ? 200 : 0;
        return {data: new Uint8ClampedArray([value, value, value, 255])};
      },
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const video = makeVideoStub({
      videoWidth: 1920,
      videoHeight: 1080,
      readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
    });

    const frame = await captureVideoFrame(video);
    expect(frame).toBe('data:image/jpeg;base64,live-frame');
    expect(attempts).toBeGreaterThanOrEqual(2);
  });
});
