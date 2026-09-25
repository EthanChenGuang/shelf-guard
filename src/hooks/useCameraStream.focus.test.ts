import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCameraStream } from './useCameraStream';

function mockStream(focusMode?: string[]) {
  const track = {
    getCapabilities: () => (focusMode ? { focusMode } : {}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  };
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
    track,
  };
}

describe('useCameraStream focus (quick-260925-r3s)', () => {
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

  it('hasFocus is true when focusMode includes single-shot', async () => {
    const fakeStream = mockStream(['continuous', 'single-shot']);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      fakeStream as unknown as MediaStream,
    );

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasFocus).toBe(true);
  });

  it('hasFocus is false when focusMode only reports continuous', async () => {
    const fakeStream = mockStream(['continuous']);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      fakeStream as unknown as MediaStream,
    );

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasFocus).toBe(false);
  });

  it('hasFocus is false and focusPoint is null when no focusMode key is present', async () => {
    const fakeStream = mockStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      fakeStream as unknown as MediaStream,
    );

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasFocus).toBe(false);
    expect(result.current.focusPoint).toBeNull();
  });

  it('setFocusPoint prefers single-shot and applies the pointsOfInterest constraint', async () => {
    const fakeStream = mockStream(['manual', 'single-shot']);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      fakeStream as unknown as MediaStream,
    );

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    await act(async () => {
      await result.current.setFocusPoint(0.3, 0.6);
    });

    expect(fakeStream.track.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ focusMode: 'single-shot', pointsOfInterest: [{ x: 0.3, y: 0.6 }] }],
    });
    expect(result.current.focusPoint).toEqual({ x: 0.3, y: 0.6 });
  });

  it('setFocusPoint is a no-op when focus capability is absent', async () => {
    const fakeStream = mockStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      fakeStream as unknown as MediaStream,
    );

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    await act(async () => {
      await result.current.setFocusPoint(0.5, 0.5);
    });

    expect(fakeStream.track.applyConstraints).not.toHaveBeenCalled();
    expect(result.current.focusPoint).toBeNull();
  });
});
