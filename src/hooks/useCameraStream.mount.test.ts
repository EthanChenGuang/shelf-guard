import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import {useCameraStream} from './useCameraStream';

describe('useCameraStream mount', () => {
  beforeEach(() => {
    const track = {
      getCapabilities: () => ({}),
      stop: vi.fn(),
    };
    const mediaStream = {
      getVideoTracks: () => [track],
      getTracks: () => [track],
    };

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => mediaStream),
      },
    });
  });

  it('requests camera access once when the hook mounts', async () => {
    const {unmount} = renderHook(() => useCameraStream());

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });

    unmount();
  });
});
