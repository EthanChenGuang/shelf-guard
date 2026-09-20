import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useCameraStream} from './useCameraStream';

function mockStream(withTorch: boolean) {
  const track = {
    getCapabilities: () => (withTorch ? {torch: true} : {}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  };
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

describe('useCameraStream torch (STAB-02)', () => {
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

  it('hasTorch is false when getCapabilities lacks torch key', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      mockStream(false),
    );

    const {result} = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasTorch).toBe(false);
  });

  it('toggleTorch does not change isTorchOn when torch unsupported', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      mockStream(false),
    );

    const {result} = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    const before = result.current.isTorchOn;
    await act(async () => {
      await result.current.toggleTorch();
    });

    expect(result.current.isTorchOn).toBe(before);
  });
});
