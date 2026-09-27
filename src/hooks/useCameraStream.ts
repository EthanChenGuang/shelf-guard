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

/** Standard camera-app zoom multipliers: 0.5x (ultra-wide), 1x, 2x, 5x. */
const CANONICAL_ZOOM_PRESETS = [0.5, 1, 2, 5];

/**
 * Filter the canonical 0.5x/1x/2x/5x presets down to those the device's reported
 * zoom range [min, max] can actually reach, snapped to the nearest multiple of
 * `step` (if given). A preset the device can't reach (e.g. 0.5x on a phone whose
 * "environment" camera track has no ultra-wide lens exposed via the web zoom API)
 * is simply omitted rather than faked — clicking a fake preset would silently clamp
 * to the nearest real value and look broken. Falls back to [min] if none apply.
 */
function computeZoomPresets(min: number, max: number, step?: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [min];
  }

  const presets = CANONICAL_ZOOM_PRESETS.filter((v) => v >= min && v <= max).map((v) => {
    if (typeof step === 'number' && step > 0) {
      const snapped = min + Math.round((v - min) / step) * step;
      return Math.min(max, Math.max(min, snapped));
    }
    return v;
  });

  return presets.length > 0 ? presets : [min];
}

function isCanvasMostlyBlack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const sampleWidth = Math.min(width, 96);
  const sampleHeight = Math.min(height, 96);
  const sx = Math.max(0, Math.floor((width - sampleWidth) / 2));
  const sy = Math.max(0, Math.floor((height - sampleHeight) / 2));
  const { data } = ctx.getImageData(sx, sy, sampleWidth, sampleHeight);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i] + data[i + 1] + data[i + 2];
  }
  const avg = sum / (data.length / 4) / 3;
  return avg < 12;
}

/** Resize any still capture to the canonical analysis size (matches canvas fallback). */
async function normalizeCaptureDataUrl(
  source: Blob | string,
): Promise<string | null> {
  try {
    const bitmap =
      source instanceof Blob ? await createImageBitmap(source) : await loadBitmapFromDataUrl(source);
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    bitmap.close();
    if (isCanvasMostlyBlack(ctx, OUTPUT_WIDTH, OUTPUT_HEIGHT)) return null;
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
}

function loadBitmapFromDataUrl(dataUrl: string): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      createImageBitmap(img).then(resolve).catch(reject);
    };
    img.onerror = () => reject(new Error('Failed to load capture for normalization'));
    img.src = dataUrl;
  });
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
    return normalizeCaptureDataUrl(blob);
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
  const [hasZoom, setHasZoom] = useState<boolean>(false);
  const [zoomLevels, setZoomLevels] = useState<number[]>([]);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [focusPoint, setFocusPointState] = useState<{ x: number; y: number } | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const acquireStream = useCallback(
    async (videoConstraints?: MediaTrackConstraints): Promise<boolean> => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API not available');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints ?? {
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
        const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown> & {
          zoom?: { min?: number; max?: number; step?: number };
          focusMode?: string[];
          focusDistance?: { min?: number; max?: number; step?: number };
        };
        setHasTorch('torch' in capabilities);

        if (
          capabilities.zoom &&
          typeof capabilities.zoom.min === 'number' &&
          typeof capabilities.zoom.max === 'number'
        ) {
          const presets = computeZoomPresets(
            capabilities.zoom.min,
            capabilities.zoom.max,
            capabilities.zoom.step,
          );
          setZoomLevels(presets);
          setHasZoom(true);
          setCurrentZoom(presets[0]);
        } else {
          setHasZoom(false);
          setZoomLevels([]);
          setCurrentZoom(null);
        }

        const focusModes = Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
        const hasFocusDistance =
          typeof capabilities.focusDistance === 'object' && capabilities.focusDistance !== null;
        const nextHasFocus =
          focusModes.includes('single-shot') || focusModes.includes('manual') || hasFocusDistance;
        setHasFocus(nextHasFocus);
        if (!nextHasFocus) {
          setFocusPointState(null);
        }

        const settings = track.getSettings?.() as { deviceId?: string } | undefined;
        setActiveDeviceId(typeof settings?.deviceId === 'string' ? settings.deviceId : null);
      } else {
        setHasTorch(false);
        setHasZoom(false);
        setZoomLevels([]);
        setCurrentZoom(null);
        setHasFocus(false);
        setFocusPointState(null);
        setActiveDeviceId(null);
      }

      if (navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCameraDevices(devices.filter((d) => d.kind === 'videoinput'));
        } catch {
          // Device labels/enumeration can be unavailable in some browsers — leave list as-is.
        }
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
    },
    [facingMode],
  );

  const startCamera = useCallback(() => acquireStream(), [acquireStream]);

  const switchCamera = useCallback(async () => {
    if (cameraDevices.length < 2) return;
    const currentIndex = cameraDevices.findIndex((d) => d.deviceId === activeDeviceId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % cameraDevices.length;
    const nextDevice = cameraDevices[nextIndex];
    await acquireStream({
      deviceId: { exact: nextDevice.deviceId },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    });
  }, [cameraDevices, activeDeviceId, acquireStream]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setHasTorch(false);
      setIsTorchOn(false);
      setHasZoom(false);
      setZoomLevels([]);
      setCurrentZoom(null);
      setHasFocus(false);
      setFocusPointState(null);
      setActiveDeviceId(null);
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

  const setZoomLevel = useCallback(
    async (value: number) => {
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      try {
        const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown>;
        if (!('zoom' in capabilities)) return;
        await track.applyConstraints({
          advanced: [{ zoom: value } as MediaTrackConstraintSet],
        });
        setCurrentZoom(value);
      } catch (e) {
        console.warn('Zoom constraint failed:', e);
      }
    },
    [stream],
  );

  const setFocusPoint = useCallback(
    async (x: number, y: number) => {
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      try {
        const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown> & {
          focusMode?: string[];
        };
        const focusModes = Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
        if (!focusModes.includes('single-shot') && !focusModes.includes('manual')) return;
        const mode = focusModes.includes('single-shot') ? 'single-shot' : 'manual';
        await track.applyConstraints({
          advanced: [
            { focusMode: mode, pointsOfInterest: [{ x, y }] } as MediaTrackConstraintSet,
          ],
        });
        setFocusPointState({ x, y });
      } catch (e) {
        console.warn('Focus constraint failed:', e);
      }
    },
    [stream],
  );

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
    hasZoom,
    zoomLevels,
    currentZoom,
    setZoomLevel,
    hasFocus,
    focusPoint,
    setFocusPoint,
    facingMode,
    startCamera,
    stopCamera,
    toggleTorch,
    toggleCameraFacing,
    hasMultipleCameras: cameraDevices.length > 1,
    switchCamera,
    clearCameraError,
    captureFrame,
  };
}
