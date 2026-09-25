import { useCallback, useEffect, useRef, useState } from 'react';

export type CaptureFrameOptions = {
  /** When true, never fall back to the demo baseline URL. */
  requireLive?: boolean;
};

/** Wait until the video element has frame dimensions (handles late mount after getUserMedia). */
export async function waitForVideoReady(
  video: HTMLVideoElement,
  timeoutMs = 5000,
): Promise<boolean> {
  if (video.videoWidth > 0) return true;

  return new Promise((resolve) => {
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('loadedmetadata', onReady);
      resolve(ready);
    };

    const onReady = () => {
      if (video.videoWidth > 0) finish(true);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('loadedmetadata', onReady);
  });
}

/** Capture the current video frame to a JPEG data URL, or null if the stream is not ready. */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  width = 1080,
  height = 1920,
): Promise<string | null> {
  const ready = await waitForVideoReady(video);
  if (!ready || video.videoWidth === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Draw baseline image URL to canvas — exported for CAM-09 unit tests. */
export async function captureDemoFrameFromUrl(
  baselineImageUrl: string,
  width = 1080,
  height = 1920,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return baselineImageUrl;

  return new Promise((resolve) => {
    const img = new Image();
    if (/^https?:\/\//i.test(baselineImageUrl)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(baselineImageUrl);
    img.src = baselineImageUrl;
  });
}

export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isUsingDemoFeed, setIsUsingDemoFeed] = useState<boolean>(true); // default to high-res demo shelf feed so user sees instant live planogram!

  const startCamera = useCallback(async (): Promise<boolean> => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setCameraError(null);
      setIsUsingDemoFeed(false);

      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown>;
        setHasTorch('torch' in capabilities);
      } else {
        setHasTorch(false);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
      return true;
    } catch (err) {
      console.warn('Camera access could not be initialized:', err);
      setCameraError((err as Error).message);
      setIsUsingDemoFeed(true);
      return false;
    }
  }, [facingMode, stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setHasTorch(false);
      setIsTorchOn(false);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const toggleTorch = useCallback(async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown>;
      if (!('torch' in capabilities)) return;
      const nextState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Torch constraint failed:', e);
    }
  }, [isTorchOn, stream]);

  const toggleCameraFacing = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  const clearCameraError = useCallback(() => {
    setCameraError(null);
  }, []);

  const toggleDemoMode = useCallback(() => {
    if (isUsingDemoFeed) {
      startCamera();
    } else {
      stopCamera();
      setIsUsingDemoFeed(true);
    }
  }, [isUsingDemoFeed, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // The guided first-baseline flow renders a placeholder (no <video>) until the live
  // feed replaces the demo feed. Attach the stream once the video element exists.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || isUsingDemoFeed) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
  }, [stream, isUsingDemoFeed]);

  // Capture current visible image (either from video or from demo baseline)
  const captureFrame = useCallback(
    async (baselineImageUrl: string, options?: CaptureFrameOptions): Promise<string> => {
      const video = videoRef.current;
      const hasLiveFeed = !isUsingDemoFeed && !!stream;

      if (hasLiveFeed || options?.requireLive) {
        if (video) {
          const liveFrame = await captureVideoFrame(video);
          if (liveFrame) return liveFrame;
        }
        if (options?.requireLive) {
          throw new Error('Live camera frame unavailable');
        }
      }

      return captureDemoFrameFromUrl(baselineImageUrl);
    },
    [isUsingDemoFeed, stream],
  );

  return {
    videoRef,
    isUsingDemoFeed,
    cameraError,
    isTorchOn,
    hasTorch,
    facingMode,
    startCamera,
    stopCamera,
    toggleTorch,
    toggleCameraFacing,
    toggleDemoMode,
    clearCameraError,
    captureFrame,
  };
}
