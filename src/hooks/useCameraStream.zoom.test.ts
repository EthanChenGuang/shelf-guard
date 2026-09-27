import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCameraStream } from './useCameraStream';

function mockStream(zoom?: { min: number; max: number; step?: number }) {
  let currentZoom = zoom?.min ?? 1;
  const track = {
    getCapabilities: () => (zoom ? { zoom } : {}),
    getSettings: () => ({ deviceId: 'cam-main', facingMode: 'environment', zoom: currentZoom }),
    applyConstraints: vi.fn(async (c: MediaTrackConstraints) => {
      const advanced = c.advanced?.[0] as { zoom?: number } | undefined;
      const raw = c as { zoom?: number };
      const next = typeof raw.zoom === 'number' ? raw.zoom : advanced?.zoom;
      if (typeof next === 'number') currentZoom = next;
    }),
    stop: vi.fn(),
  };
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
    track,
  };
}

describe('useCameraStream rear wide lens (auto zoom min)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'HTMLVideoElement',
      class {
        play = vi.fn().mockResolvedValue(undefined);
        requestVideoFrameCallback = undefined;
        videoWidth = 1920;
        readyState = 4;
      },
    );
  });

  it('applies minimum zoom on rear camera when the track supports zoom', async () => {
    const stream = mockStream({ min: 0.5, max: 5, step: 0.1 });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
        enumerateDevices: vi.fn().mockResolvedValue([
          { deviceId: 'cam-main', kind: 'videoinput', label: 'Back camera', groupId: 'g1' },
        ]),
      },
    });

    const { result } = renderHook(() => useCameraStream());
    await act(async () => {
      await result.current.startCamera();
    });

    expect(stream.track.applyConstraints).toHaveBeenCalled();
    const zoomCalls = stream.track.applyConstraints.mock.calls.flat();
    expect(zoomCalls.some((c) => (c as { zoom?: number }).zoom === 0.5)).toBe(true);
  });

  it('does not expose zoom preset UI state from the hook', () => {
    const { result } = renderHook(() => useCameraStream());
    expect('hasZoom' in result.current).toBe(false);
    expect('zoomLevels' in result.current).toBe(false);
    expect('setZoomLevel' in result.current).toBe(false);
  });
});
