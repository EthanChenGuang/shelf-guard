import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useCameraStream} from './useCameraStream';

function mockStream(zoom?: {min: number; max: number; step?: number}) {
  const track = {
    getCapabilities: () => (zoom ? {zoom} : {}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  };
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
    track,
  };
}

describe('useCameraStream zoom (GDB-260925-4)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'navigator',
      {
        mediaDevices: {
          getUserMedia: vi.fn(),
        },
      },
    );
  });

  it('computes 4 evenly-spaced, step-snapped zoom presets and sets currentZoom to the widest', async () => {
    const fakeStream = mockStream({min: 1, max: 4, step: 1});
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      fakeStream as unknown as MediaStream,
    );

    const {result} = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasZoom).toBe(true);
    expect(result.current.zoomLevels).toEqual([1, 2, 3, 4]);
    expect(result.current.currentZoom).toBe(1);
  });

  it('hasZoom is false and zoomLevels is empty when getCapabilities lacks zoom key', async () => {
    const fakeStream = mockStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      fakeStream as unknown as MediaStream,
    );

    const {result} = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasZoom).toBe(false);
    expect(result.current.zoomLevels).toEqual([]);
  });

  it('setZoomLevel applies the constraint and updates currentZoom on success', async () => {
    const fakeStream = mockStream({min: 1, max: 4, step: 1});
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      fakeStream as unknown as MediaStream,
    );

    const {result} = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    await act(async () => {
      await result.current.setZoomLevel(3);
    });

    expect(fakeStream.track.applyConstraints).toHaveBeenCalledWith({
      advanced: [{zoom: 3}],
    });
    expect(result.current.currentZoom).toBe(3);
  });
});
