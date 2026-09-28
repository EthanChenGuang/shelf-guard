import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import React from 'react';
import { useCameraStream } from './useCameraStream';

/**
 * Regression test for second-shot-orientation-diff.
 *
 * Root cause: App.tsx conditionally renders <CameraView> (which owns the sole <video>
 * element) only while appMode === 'CAMERA_IDLE'. CameraView fully unmounts/remounts on every
 * transition through SCANNING_ANIM / PROCESSING / RESULT_INSPECT and back — which
 * happens after the very first baseline capture, and after every capture thereafter. The
 * effect that attaches the live MediaStream to the <video> element previously depended only on
 * `[stream]`; since the MediaStream object's identity never changes across these remounts, a
 * freshly-mounted <video> element was left permanently detached (no srcObject, videoWidth=0)
 * from the 2nd shutter press onward.
 *
 * This harness mirrors App.tsx's real render pattern exactly: `ref={videoRef}` on a real JSX
 * <video> element, conditionally mounted/unmounted — not a direct call to `videoRef` as a
 * function — so it validates the hook's actual public contract regardless of whether videoRef
 * is implemented as a RefObject or a callback ref.
 */

function makeStreamAndTrack() {
  const track = {
    getCapabilities: () => ({}),
    getSettings: () => ({}),
    stop: vi.fn(),
  };
  const mediaStream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  };
  return { mediaStream, track };
}

function Harness({ mountVideo }: { mountVideo: boolean }) {
  const { videoRef } = useCameraStream();
  return mountVideo ? React.createElement('video', { 'data-testid': 'video', ref: videoRef }) : null;
}

describe('useCameraStream video reattachment across CameraView remount', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  it('reattaches the live stream to a freshly-mounted <video> element after CameraView unmounts and remounts (2nd shutter press scenario)', async () => {
    const { mediaStream } = makeStreamAndTrack();
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => mediaStream),
      },
    });

    const { rerender } = render(React.createElement(Harness, { mountVideo: true }));

    // Shot 1 (baseline): initial mount, stream becomes available and attaches normally.
    const video1 = await screen.findByTestId('video');
    await waitFor(() => {
      expect((video1 as unknown as { srcObject: unknown }).srcObject).toBe(mediaStream);
    });

    // Simulate App.tsx conditionally unmounting CameraView (appMode -> SCANNING_ANIM /
    // RESULT_INSPECT after every inspection capture).
    rerender(React.createElement(Harness, { mountVideo: false }));
    expect(screen.queryByTestId('video')).toBeNull();

    // Simulate returning to CAMERA_IDLE: CameraView remounts a brand-new <video> DOM node
    // (this is what happens right before the 2nd shutter press).
    rerender(React.createElement(Harness, { mountVideo: true }));
    const video2 = await screen.findByTestId('video');
    expect(video2).not.toBe(video1);

    // The freshly-mounted element must get the live stream reattached — before the fix this
    // never happens because the attach-effect only depended on `stream`, whose identity is
    // unchanged across the remount, so it never re-fires for the new node.
    await waitFor(() => {
      expect((video2 as unknown as { srcObject: unknown }).srcObject).toBe(mediaStream);
    });
  });
});
