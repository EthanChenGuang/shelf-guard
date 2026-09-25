import { useCallback, useEffect, useRef, useState } from 'react';

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

export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  const startCamera = useCallback(async (): Promise<boolean> => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
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

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraError(null);

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
      return false;
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setHasTorch(false);
      setIsTorchOn(false);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

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

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
  }, [stream]);

  const captureFrame = useCallback(async (): Promise<string> => {
    const video = videoRef.current;
    if (!video || !stream) {
      throw new Error('Live camera frame unavailable');
    }

    const liveFrame = await captureVideoFrame(video);
    if (!liveFrame) {
      throw new Error('Live camera frame unavailable');
    }
    return liveFrame;
  }, [stream]);

  return {
    videoRef,
    stream,
    cameraError,
    isTorchOn,
    hasTorch,
    facingMode,
    startCamera,
    stopCamera,
    toggleTorch,
    toggleCameraFacing,
    clearCameraError,
    captureFrame,
  };
}
