import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCameraStream } from './useCameraStream';

function makeStream(deviceId: string) {
  const track = {
    getCapabilities: () => ({}),
    getSettings: () => ({ deviceId }),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  };
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
    track,
  };
}

function stubNavigator(deviceIds: string[], videoDeviceIds = deviceIds) {
  const streamsByDevice = Object.fromEntries(
    deviceIds.map((id) => [id, makeStream(id)]),
  );

  const getUserMedia = vi.fn(
    async (constraints: { video?: { deviceId?: { exact?: string } } }) => {
      const requestedId = constraints?.video?.deviceId?.exact;
      const stream = streamsByDevice[requestedId ?? deviceIds[0]];
      return stream as unknown as MediaStream;
    },
  );

  const enumerateDevices = vi.fn().mockResolvedValue(
    videoDeviceIds.map((id) => ({
      deviceId: id,
      kind: 'videoinput',
      label: '',
      groupId: '',
    })),
  );

  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia, enumerateDevices },
  });

  return { getUserMedia, streamsByDevice };
}

describe('useCameraStream switchCamera (quick-260925 wide-angle lens switching)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('hasMultipleCameras is true when more than one video input device is enumerated', async () => {
    stubNavigator(['cam-1', 'cam-2', 'cam-3']);

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasMultipleCameras).toBe(true);
  });

  it('hasMultipleCameras is false when only one camera device exists', async () => {
    stubNavigator(['cam-1']);

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasMultipleCameras).toBe(false);
  });

  it('ignores non-video devices when deciding hasMultipleCameras', async () => {
    const { streamsByDevice: _s } = stubNavigator(['cam-1'], ['cam-1']);
    void _s;
    // add a non-video device to the enumerateDevices result
    const nav = navigator as unknown as {
      mediaDevices: { enumerateDevices: ReturnType<typeof vi.fn> };
    };
    nav.mediaDevices.enumerateDevices.mockResolvedValue([
      { deviceId: 'cam-1', kind: 'videoinput', label: '', groupId: '' },
      { deviceId: 'mic-1', kind: 'audioinput', label: '', groupId: '' },
    ]);

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.hasMultipleCameras).toBe(false);
  });

  it('switchCamera requests the next enumerated device by exact deviceId', async () => {
    const { getUserMedia } = stubNavigator(['cam-1', 'cam-2', 'cam-3']);

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    await act(async () => {
      await result.current.switchCamera();
    });

    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: {
        deviceId: { exact: 'cam-2' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  });

  it('switchCamera wraps around to the first device after the last one', async () => {
    const { getUserMedia } = stubNavigator(['cam-1', 'cam-2', 'cam-3']);

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    await act(async () => {
      await result.current.switchCamera();
    });
    await act(async () => {
      await result.current.switchCamera();
    });
    await act(async () => {
      await result.current.switchCamera();
    });

    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: {
        deviceId: { exact: 'cam-1' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  });

  it('switchCamera is a no-op when only one camera device is available', async () => {
    const { getUserMedia } = stubNavigator(['cam-1']);

    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.startCamera();
    });

    const callsBeforeSwitch = getUserMedia.mock.calls.length;

    await act(async () => {
      await result.current.switchCamera();
    });

    expect(getUserMedia.mock.calls.length).toBe(callsBeforeSwitch);
  });
});
