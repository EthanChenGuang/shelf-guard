import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCameraStream } from './useCameraStream';

function makeStream(deviceId: string) {
  const track = {
    getCapabilities: () => ({}),
    getSettings: () => ({ deviceId, facingMode: 'environment' }),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  };
  return { getVideoTracks: () => [track], getTracks: () => [track] };
}

function stubDevices(labels: Array<[string, string]>) {
  const getUserMedia = vi.fn(async (constraints: { video?: { deviceId?: { exact?: string } } }) => {
    const id = constraints?.video?.deviceId?.exact ?? labels[0][0];
    return makeStream(id) as unknown as MediaStream;
  });
  const enumerateDevices = vi
    .fn()
    .mockResolvedValue(labels.map(([deviceId, label]) => ({ deviceId, label, kind: 'videoinput', groupId: 'g' })));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, enumerateDevices } });
  return { getUserMedia };
}

const requestedDevice = (getUserMedia: ReturnType<typeof vi.fn>) =>
  (getUserMedia.mock.calls.at(-1)?.[0] as { video: { deviceId?: { exact: string } } }).video.deviceId?.exact;

describe('useCameraStream cycleLens (back lenses)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('cycles through every back lens and skips the front camera', async () => {
    const { getUserMedia } = stubDevices([
      ['main', 'Back Camera'],
      ['front', 'Front Camera'],
      ['ultra', 'Back Ultra Wide Camera'],
      ['tele', 'Back Telephoto Camera'],
    ]);
    const { result } = renderHook(() => useCameraStream());
    await act(async () => {
      await result.current.startCamera();
    });
    expect(result.current.hasMultipleLenses).toBe(true);

    const start = result.current.lens?.index;
    const visited = new Set<string>();
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await result.current.cycleLens();
      });
      visited.add(requestedDevice(getUserMedia)!);
    }
    expect(visited).toEqual(new Set(['main', 'ultra', 'tele']));
    expect(result.current.lens?.index).toBe(start);
    expect(result.current.lens?.count).toBe(3);
  });

  it('offers no lens switch when only one back lens is exposed', async () => {
    stubDevices([
      ['main', 'camera2 0, facing back'],
      ['front', 'camera2 1, facing front'],
    ]);
    const { result } = renderHook(() => useCameraStream());
    await act(async () => {
      await result.current.startCamera();
    });
    expect(result.current.hasMultipleLenses).toBe(false);
  });
});
