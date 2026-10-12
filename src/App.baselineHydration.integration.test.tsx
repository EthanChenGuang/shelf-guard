import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {I18N} from './lib/constants';
import {saveBaseline} from './lib/shelfStorage';
import {normalizeNativePhoto} from './lib/nativeCapture';

vi.mock('./lib/nativeCapture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/nativeCapture')>();
  return {
    ...actual,
    normalizeNativePhoto: vi.fn(async () => ({
      dataUrl: 'data:image/jpeg;base64,wrong-baseline',
      width: 1080,
      height: 1920,
      focalLength: null,
    })),
  };
});

const persistedBaseline = {
  id: 'baseline-shelf-0',
  createdAt: Date.now(),
  imageBlob: new Blob(['baseline'], {type: 'image/jpeg'}),
  imageDimensions: {width: 1080, height: 1920},
};

let releaseBaselineLoad: (() => void) | undefined;

const {analyzeShelfCapture, captureFrame} = vi.hoisted(() => ({
  analyzeShelfCapture: vi.fn(async () => ({
    anomalies: [],
    complianceRate: 95,
    standardCount: 24,
    actualCount: 24,
    displacedCount: 0,
    missingCount: 0,
  })),
  captureFrame: vi.fn(async () => 'data:image/jpeg;base64,capture-frame'),
}));

vi.mock('./lib/vision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/vision')>();
  return {...actual, analyzeShelfCapture, prewarmVisionWorker: vi.fn(async () => undefined)};
});

vi.mock('./hooks/useCameraStream', () => ({
  useCameraStream: () => ({
    videoRef: {current: null},
    stream: {} as MediaStream,
    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame,
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    toggleTorch: vi.fn(),
    toggleCameraFacing: vi.fn(),
    clearCameraError: vi.fn(),
  }),
}));

vi.mock('./hooks/useDeviceOrientation', () => ({
  useDeviceOrientation: () => ({
    tilt: 0,
    isLevel: true,
    setSimulatedTilt: vi.fn(),
    requestOrientationPermission: vi.fn(),
  }),
}));

vi.mock('./hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({isInstallable: false, install: vi.fn()}),
}));

vi.mock('./lib/storage', () => ({
  loadSavedLanguage: vi.fn(async () => 'it'),
  saveLanguage: vi.fn(),
  loadSavedTolerance: vi.fn(async () => 50),
  saveTolerance: vi.fn(),
  loadSavedMinConfidence: vi.fn(async () => 85),
  saveMinConfidence: vi.fn(),
}));

vi.mock('./lib/shelfStorage', () => ({
  runSchemaMigrationIfNeeded: vi.fn(async () => ({ok: true})),
  loadActiveShelfId: vi.fn(async () => 0),
  loadBaselineRaw: vi.fn(
    () =>
      new Promise<typeof persistedBaseline | null>((resolve) => {
        releaseBaselineLoad = () => resolve(persistedBaseline);
      }),
  ),
  loadAuditHistory: vi.fn(async () => []),
  saveActiveShelfId: vi.fn(async () => ({ok: true})),
  saveBaseline: vi.fn(async () => ({ok: true})),
  clearBaseline: vi.fn(async () => ({ok: true})),
  appendAuditRecord: vi.fn(async () => ({ok: true})),
  toViewBaseline: vi.fn((p, url) => ({
    id: p.id,
    createdAt: p.createdAt,
    imageDataUrl: url,
    imageDimensions: p.imageDimensions,
  })),
}));

describe('App baseline hydration before compare (STAB-05)', () => {
  beforeEach(() => {
    analyzeShelfCapture.mockClear();
    captureFrame.mockClear();
    vi.mocked(saveBaseline).mockClear();
    releaseBaselineLoad = undefined;
    vi.useFakeTimers({shouldAdvanceTime: true});
    vi.stubGlobal('URL', Object.assign(URL, {createObjectURL: vi.fn(() => 'blob:baseline'), revokeObjectURL: vi.fn()}));
  });

  it('does not overwrite persisted baseline while shelf data is still loading', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTimeAsync});
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    // Shelf data still loading — must not offer the first-baseline picker.
    expect(screen.queryByTestId('baseline-photo-input')).not.toBeInTheDocument();
    expect(screen.queryByText(I18N.it.baselineNotSet)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(I18N.it.shutterLocked));

    expect(vi.mocked(normalizeNativePhoto)).not.toHaveBeenCalled();
    expect(saveBaseline).not.toHaveBeenCalled();
    expect(analyzeShelfCapture).not.toHaveBeenCalled();
    expect(captureFrame).not.toHaveBeenCalled();

    await act(async () => {
      releaseBaselineLoad?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(I18N.it.baselineEstablished)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(I18N.it.captureScan));
    await waitFor(() => {
      expect(analyzeShelfCapture).toHaveBeenCalledTimes(1);
    });
    expect(saveBaseline).not.toHaveBeenCalled();
  });
});
