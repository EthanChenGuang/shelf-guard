import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCameraStream } from './useCameraStream';

function makeStream(facingMode: 'user' | 'environment' = 'environment', deviceId = 'cam-1') {
  const track = {
    getCapabilities: () => ({ zoom: { min: 1, max: 4, step: 1 } }),
    getSettings: () => ({ deviceId, facingMode }),
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
    { deviceId: 'cam-back', kind: 'videoinput', label: 'back', groupId: 'g1' },
    { deviceId: 'cam-front', kind: 'videoinput', label: 'front', groupId: 'g2' },
    { deviceId: 'cam-tele', kind: 'videoinput', label: 'tele', groupId: 'g1' },
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
});
