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
    readyState: HTMLMediaElement.HAVE_NOTHING,
    srcObject: {} as MediaStream,
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

describe('useCameraStream live capture helpers', () => {
  beforeEach(() => {
    const drawImage = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({drawImage})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => 'data:image/jpeg;base64,live-frame',
    );
  });

  it('waitForVideoReady resolves immediately when dimensions exist', async () => {
    const video = makeVideoStub({videoWidth: 1280});
    await expect(waitForVideoReady(video, 100)).resolves.toBe(true);
  });

  it('waitForVideoReady resolves after loadedmetadata when video mounts late', async () => {
    const video = makeVideoStub();
    const readyPromise = waitForVideoReady(video, 1000);

    queueMicrotask(() => {
      Object.defineProperty(video, 'videoWidth', {value: 1920, configurable: true});
      video.emit('loadedmetadata');
    });

    await expect(readyPromise).resolves.toBe(true);
  });

  it('captureVideoFrame returns JPEG data URL from the live video element', async () => {
    const video = makeVideoStub({videoWidth: 1920, videoHeight: 1080});
    const frame = await captureVideoFrame(video);
    expect(frame).toBe('data:image/jpeg;base64,live-frame');
    expect(frame).toMatch(/^data:image\/jpeg/);
  });
});
