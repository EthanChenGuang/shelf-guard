import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCameraStream } from './useCameraStream';

function makeStream(facingMode: 'user' | 'environment' = 'environment', deviceId = 'cam-1') {
  const track = {
    getCapabilities: () => ({ zoom: { min: 1, max: 4, step: 1 } }),
    getSettings: () => ({ deviceId, facingMode, zoom: 1 }),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  };
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
    track,
  };
}

function stubNavigator(initialFacing: 'user' | 'environment' = 'environment') {
  let currentFacing = initialFacing;
  const getUserMedia = vi.fn(
    async (constraints: { video?: { facingMode?: { exact?: string } } }) => {
      const requested = constraints?.video?.facingMode?.exact;
      if (requested === 'user' || requested === 'environment') {
        currentFacing = requested;
      }
      return makeStream(currentFacing) as unknown as MediaStream;
    },
  );

  const enumerateDevices = vi.fn().mockResolvedValue([
    { deviceId: 'cam-1', kind: 'videoinput', label: 'Back camera', groupId: 'g1' },
  ]);

  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia, enumerateDevices },
  });

  return { getUserMedia };
}

describe('useCameraStream switchCamera (front/rear facingMode)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('hasMultipleCameras is true when at least one video device is enumerated', async () => {
    stubNavigator();
    const { result } = renderHook(() => useCameraStream());
    await act(async () => {
      await result.current.startCamera();
    });
    expect(result.current.hasMultipleCameras).toBe(true);
  });

  it('switchCamera toggles facingMode exact user/environment instead of cycling deviceId', async () => {
    const { getUserMedia } = stubNavigator('environment');
    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    await act(async () => {
      await result.current.switchCamera();
    });

    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: {
        facingMode: { exact: 'user' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    await act(async () => {
      await result.current.switchCamera();
    });

    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: {
        facingMode: { exact: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  });

  it('syncs facingMode state from track settings after switch', async () => {
    stubNavigator('environment');
    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });
    expect(result.current.facingMode).toBe('environment');

    await act(async () => {
      await result.current.switchCamera();
    });
    expect(result.current.facingMode).toBe('user');
  });

  it('does not wide-lens retry when switching to front with multiple back lenses enumerated', async () => {
    vi.unstubAllGlobals();
    const getUserMedia = vi.fn(async (constraints: { video?: Record<string, unknown> }) => {
      const facing =
        (constraints?.video?.facingMode as { exact?: string } | undefined)?.exact ?? 'environment';
      const mode = facing === 'user' ? 'user' : 'environment';
      return makeStream(mode, mode === 'user' ? 'front-1' : 'back-wide') as unknown as MediaStream;
    });

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([
          { deviceId: 'back-wide', kind: 'videoinput', label: 'Ultra wide back', groupId: 'b' },
          { deviceId: 'back-main', kind: 'videoinput', label: 'Back camera', groupId: 'b' },
          { deviceId: 'front-1', kind: 'videoinput', label: 'Front camera', groupId: 'f' },
        ]),
      },
    });

    vi.stubGlobal(
      'HTMLVideoElement',
      class {
        play = vi.fn().mockResolvedValue(undefined);
        requestVideoFrameCallback = undefined;
        videoWidth = 1920;
        readyState = 4;
      },
    );

    const { result } = renderHook(() => useCameraStream());
    await act(async () => {
      await result.current.startCamera();
    });

    await act(async () => {
      await result.current.switchCamera();
    });

    const lastVideo = getUserMedia.mock.calls.at(-1)?.[0]?.video as Record<string, unknown>;
    expect(lastVideo.facingMode).toEqual({ exact: 'user' });
    expect(lastVideo.deviceId).toBeUndefined();
    expect(result.current.facingMode).toBe('user');
  });

  it('retries while the other camera is still being released (NotReadableError)', async () => {
    const { getUserMedia } = stubNavigator('environment');
    const { result } = renderHook(() => useCameraStream());
    await act(async () => {
      await result.current.startCamera();
    });

    const busy = Object.assign(new Error('Could not start video source'), { name: 'NotReadableError' });
    getUserMedia.mockRejectedValueOnce(busy);
    vi.useFakeTimers();
    try {
      await act(async () => {
        const switching = result.current.switchCamera();
        await vi.advanceTimersByTimeAsync(300);
        await switching;
      });
    } finally {
      vi.useRealTimers();
    }

    expect(result.current.cameraError).toBeNull();
    expect(result.current.facingMode).toBe('user');
  });

  it('brings the previous camera back when the other one never opens', async () => {
    const { getUserMedia } = stubNavigator('environment');
    const { result } = renderHook(() => useCameraStream());
    await act(async () => {
      await result.current.startCamera();
    });

    getUserMedia.mockImplementation(async (constraints: { video?: { facingMode?: unknown } }) => {
      const facing = constraints?.video?.facingMode as { exact?: string } | undefined;
      if (facing?.exact === 'user') throw Object.assign(new Error('Overconstrained'), { name: 'OverconstrainedError' });
      return makeStream('environment') as unknown as MediaStream;
    });
    await act(async () => {
      await result.current.switchCamera();
    });

    expect(result.current.facingMode).toBe('environment');
    expect(result.current.stream).not.toBeNull();
    expect(result.current.cameraError).toBeNull();
  });
});
