import { useCallback, useEffect, useRef, useState } from 'react';

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const CAPTURE_RETRY_MS = 120;
const MAX_CAPTURE_ATTEMPTS = 8;

/** Wait until the video element has decoded at least one frame. */
export async function waitForVideoReady(
  video: HTMLVideoElement,
  timeoutMs = 5000,
): Promise<boolean> {
  if (
    video.videoWidth > 0 &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return true;
  }

  return new Promise((resolve) => {
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      resolve(ready);
    };

    const onReady = () => {
      if (
        video.videoWidth > 0 &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        finish(true);
      }
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);

    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => onReady());
    }
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

function isCanvasMostlyBlack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const sampleWidth = Math.min(width, 96);
  const sampleHeight = Math.min(height, 96);
  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i] + data[i + 1] + data[i + 2];
  }
  const avg = sum / (data.length / 4) / 3;
  return avg < 12;
}

async function captureWithImageCapture(track: MediaStreamTrack): Promise<string | null> {
  const ImageCaptureCtor = (
    globalThis as typeof globalThis & {
      ImageCapture?: new (track: MediaStreamTrack) => {
        takePhoto: () => Promise<Blob>;
      };
    }
  ).ImageCapture;

  if (!ImageCaptureCtor) return null;

  try {
    const imageCapture = new ImageCaptureCtor(track);
    const blob = await imageCapture.takePhoto();
    if (!blob || blob.size === 0) return null;
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function drawVideoToCanvas(
  video: HTMLVideoElement,
  width = OUTPUT_WIDTH,
  height = OUTPUT_HEIGHT,
): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  if (isCanvasMostlyBlack(ctx, width, height)) return null;
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Capture the current video frame to a JPEG data URL, or null if the stream is not ready. */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  stream?: MediaStream | null,
): Promise<string | null> {
  const track = stream?.getVideoTracks()[0];
  if (track) {
    const photo = await captureWithImageCapture(track);
    if (photo) return photo;
  }

  if (video.paused) {
    await video.play().catch(() => {});
  }

  for (let attempt = 0; attempt < MAX_CAPTURE_ATTEMPTS; attempt += 1) {
    const ready = await waitForVideoReady(video, attempt === 0 ? 5000 : 1500);
    if (!ready || video.videoWidth === 0) {
      await new Promise((resolve) => setTimeout(resolve, CAPTURE_RETRY_MS));
      continue;
    }

    const frame = drawVideoToCanvas(video);
    if (frame) return frame;

    await new Promise((resolve) => setTimeout(resolve, CAPTURE_RETRY_MS));
  }

  return null;
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

    const liveFrame = await captureVideoFrame(video, stream);
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
