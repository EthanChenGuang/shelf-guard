import { useCallback, useEffect, useRef, useState } from 'react';
import { drawImageCover } from '../lib/canvasCover';

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

function readTrackZoom(track: MediaStreamTrack): number | null {
  const settings = track.getSettings?.() as { zoom?: number };
  return typeof settings?.zoom === 'number' && Number.isFinite(settings.zoom) ? settings.zoom : null;
}

/** Apply zoom and return the track's reported zoom (may differ if hardware clamps). */
async function applyZoomToTrack(track: MediaStreamTrack, zoom: number): Promise<number> {
  const attempts: MediaTrackConstraints[] = [
    { zoom } as MediaTrackConstraints,
    { advanced: [{ zoom } as MediaTrackConstraintSet] },
  ];
  for (const constraints of attempts) {
    try {
      await track.applyConstraints(constraints);
      const actual = readTrackZoom(track);
      if (actual !== null) return actual;
    } catch (err) {
      console.warn('Zoom constraint failed:', err);
    }
  }
  return readTrackZoom(track) ?? zoom;
}

function isLikelyFrontCamera(device: MediaDeviceInfo): boolean {
  const label = device.label.toLowerCase();
  return /front|user|自拍|前置|face/.test(label);
}

/** Prefer ultra-wide / wide back camera when zoom API is unavailable (multi-lens Android). */
export function pickWideAngleDeviceId(devices: MediaDeviceInfo[]): string | null {
  const inputs = devices.filter((d) => d.kind === 'videoinput' && !isLikelyFrontCamera(d));
  if (inputs.length === 0) return null;
  if (inputs.length === 1) return inputs[0].deviceId;

  const score = (device: MediaDeviceInfo): number => {
    const label = device.label.toLowerCase();
    if (/tele|长焦|narrow|zoom/.test(label)) return -2;
    if (/ultra|超广|0\.5x|0,5x/.test(label)) return 4;
    if (/wide|广角|wide-angle|wide angle/.test(label)) return 3;
    if (/back|rear|environment|后/.test(label)) return 1;
    const cameraIndex = label.match(/camera2\s*(\d+)/i);
    if (cameraIndex) {
      // Many Android devices expose ultra-wide as the lowest-index back camera.
      return 2 - Number(cameraIndex[1]) / 10;
    }
    return 0;
  };

  const ranked = [...inputs].sort((a, b) => score(b) - score(a));
  return ranked[0]?.deviceId ?? null;
}

function buildDefaultVideoConstraints(facing: 'environment' | 'user'): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    facingMode: { ideal: facing },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };
  if (facing === 'environment') {
    return { ...base, zoom: { ideal: 0.5 } } as unknown as MediaTrackConstraints;
  }
  return base;
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
  // Dim retail lighting can sit below 12; reject only near-empty frames.
  return avg < 3;
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
    drawImageCover(ctx, bitmap, bitmap.width, bitmap.height, OUTPUT_WIDTH, OUTPUT_HEIGHT);
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
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;
  drawImageCover(ctx, video, video.videoWidth, video.videoHeight, width, height);
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
  // CameraView (and its sole <video> element) unmounts/remounts on every appMode transition
  // away from and back to CAMERA_IDLE (SCANNING_ANIM, PROCESSING, RESULT_INSPECT).
  // Track the live node in state so effects can react to a freshly-mounted element, not just
  // to `stream` changing identity (a plain useRef mutation is invisible to effect deps).
  const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null);
  const setVideoNodeRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoNode(node);
  }, []);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [focusPoint, setFocusPointState] = useState<{ x: number; y: number } | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const facingModeRef = useRef(facingMode);
  facingModeRef.current = facingMode;

  const acquireStream = useCallback(
    async (
      videoConstraints?: MediaTrackConstraints,
      options?: { skipWideDeviceRetry?: boolean; preferWideLens?: boolean },
    ): Promise<boolean> => {
      const preferWideLens = options?.preferWideLens ?? facingModeRef.current === 'environment';
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API not available');
        }

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints ?? buildDefaultVideoConstraints(facingModeRef.current),
            audio: false,
          });
        } catch (firstErr) {
          if (!videoConstraints && facingModeRef.current === 'environment') {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
              audio: false,
            });
          } else {
            throw firstErr;
          }
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);
        setCameraError(null);

        const track = mediaStream.getVideoTracks()[0];
        let widestZoomTarget: number | null = null;
        if (track) {
        const capabilities = (track.getCapabilities?.() || {}) as Record<string, unknown> & {
          zoom?: { min?: number; max?: number; step?: number };
          focusMode?: string[];
          focusDistance?: { min?: number; max?: number; step?: number };
        };
        setHasTorch('torch' in capabilities);
        if (
          preferWideLens &&
          capabilities.zoom &&
          typeof capabilities.zoom.min === 'number' &&
          typeof capabilities.zoom.max === 'number'
        ) {
          widestZoomTarget = capabilities.zoom.min;
          await applyZoomToTrack(track, widestZoomTarget);
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

        const settings = track.getSettings?.() as {
          deviceId?: string;
          facingMode?: string;
        } | undefined;
        setActiveDeviceId(typeof settings?.deviceId === 'string' ? settings.deviceId : null);
        const requestedFacing = videoConstraints?.facingMode;
        const hasExplicitFacing =
          typeof requestedFacing === 'string' ||
          (typeof requestedFacing === 'object' &&
            requestedFacing !== null &&
            ('exact' in requestedFacing || 'ideal' in requestedFacing));
        if (
          !hasExplicitFacing &&
          (settings?.facingMode === 'user' || settings?.facingMode === 'environment')
        ) {
          setFacingMode(settings.facingMode);
        }
      } else {
        setHasTorch(false);
        setHasFocus(false);
        setFocusPointState(null);
        setActiveDeviceId(null);
      }

      let videoInputs: MediaDeviceInfo[] = [];
      if (navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setCameraDevices(videoInputs);
        } catch {
          // Device labels/enumeration can be unavailable in some browsers — leave list as-is.
        }
      }

      const activeId = track?.getSettings?.()?.deviceId;
      const actualZoom = track ? readTrackZoom(track) : null;
      const zoomStuckOnMain =
        widestZoomTarget !== null &&
        actualZoom !== null &&
        actualZoom > widestZoomTarget + 0.15;

      if (
        !options?.skipWideDeviceRetry &&
        preferWideLens &&
        videoInputs.length > 1 &&
        typeof activeId === 'string'
      ) {
        const wideDeviceId = pickWideAngleDeviceId(videoInputs);
        if (wideDeviceId && wideDeviceId !== activeId) {
          return acquireStream(
            {
              deviceId: { exact: wideDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              zoom: { ideal: 0.5 },
            } as unknown as MediaTrackConstraints,
            { skipWideDeviceRetry: true },
          );
        }

        if (zoomStuckOnMain && !options?.skipWideDeviceRetry) {
          const alternateBack = videoInputs.find(
            (d) => !isLikelyFrontCamera(d) && d.deviceId !== activeId,
          );
          if (alternateBack) {
            return acquireStream(
              {
                deviceId: { exact: alternateBack.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                zoom: { ideal: 0.5 },
              } as unknown as MediaTrackConstraints,
              { skipWideDeviceRetry: true },
            );
          }
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
        if (track && preferWideLens && widestZoomTarget !== null && videoRef.current) {
          await waitForVideoReady(videoRef.current, 2500);
          await applyZoomToTrack(track, widestZoomTarget);
        }
      }
      return true;
    } catch (err) {
      console.warn('Camera access could not be initialized:', err);
      setCameraError((err as Error).message);
      return false;
    }
    },
    [],
  );

  const startCamera = useCallback(() => acquireStream(), [acquireStream]);

  /** Flip front/rear camera. Do not cycle lens deviceIds — that changes zoom on multi-lens phones. */
  const switchCamera = useCallback(async () => {
    const previousFacing = facingModeRef.current;
    const nextFacing: 'environment' | 'user' =
      previousFacing === 'environment' ? 'user' : 'environment';
    facingModeRef.current = nextFacing;
    const ok = await acquireStream(
      {
        facingMode: { exact: nextFacing },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      {
        skipWideDeviceRetry: nextFacing === 'user',
        preferWideLens: nextFacing === 'environment',
      },
    );
    if (ok) {
      setFacingMode(nextFacing);
    } else {
      facingModeRef.current = previousFacing;
    }
  }, [acquireStream]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setHasTorch(false);
      setIsTorchOn(false);
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

  // Depend on `videoNode` (not just `stream`) so this re-attaches whenever CameraView
  // remounts a fresh <video> element — otherwise a remounted element is left permanently
  // detached (videoWidth=0) whenever `stream` itself hasn't changed identity.
  useEffect(() => {
    if (!videoNode || !stream) return;
    videoNode.srcObject = stream;
    void videoNode.play().catch(() => {});
  }, [stream, videoNode]);

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
    videoRef: setVideoNodeRef,
    stream,
    cameraError,
    isTorchOn,
    hasTorch,
    hasFocus,
    focusPoint,
    setFocusPoint,
    facingMode,
    startCamera,
    stopCamera,
    toggleTorch,
    toggleCameraFacing,
    /** Show flip control whenever the camera is live (flip uses facingMode, not lens cycling). */
    hasMultipleCameras: cameraDevices.length > 0 && !cameraError,
    switchCamera,
    clearCameraError,
    captureFrame,
  };
}
