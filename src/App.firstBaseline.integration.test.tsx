import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {I18N} from './lib/constants';
import {saveBaseline} from './lib/shelfStorage';

const {analyzeShelfCapture, captureFrame, normalizeNativePhoto, FIRST_FRAME} = vi.hoisted(() => ({
  analyzeShelfCapture: vi.fn(),
  captureFrame: vi.fn(),
  normalizeNativePhoto: vi.fn(),
  FIRST_FRAME: 'data:image/jpeg;base64,Zmlyc3QtYmFzZWxpbmU=',
}));

vi.mock('./lib/nativeCapture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/nativeCapture')>();
  return {...actual, normalizeNativePhoto};
});

vi.mock('./lib/vision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/vision')>();
  return {
    ...actual,
    analyzeShelfCapture,
  };
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

class MockImage {
  naturalWidth = 1080;
  naturalHeight = 1920;
  onload: (() => void) | null = null;
  private _src = '';

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

vi.mock('./lib/shelfStorage', () => ({
  runSchemaMigrationIfNeeded: vi.fn(async () => ({ok: true})),
  loadActiveShelfId: vi.fn(async () => 0),
  loadBaselineRaw: vi.fn(async () => null),
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

describe('App first-baseline integration (D-01)', () => {
  beforeEach(() => {
    analyzeShelfCapture.mockClear();
    captureFrame.mockReset();
    normalizeNativePhoto.mockReset();
    normalizeNativePhoto.mockResolvedValue({dataUrl: FIRST_FRAME, width: 1080, height: 1920, focalLength: 2.2});
    vi.mocked(saveBaseline).mockClear();
    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('URL', Object.assign(URL, {createObjectURL: vi.fn(() => 'blob:baseline'), revokeObjectURL: vi.fn()}));
    vi.useFakeTimers({shouldAdvanceTime: true});
  });

  it('lets the first shutter take the baseline with the OS camera or pick it from the library', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTimeAsync});
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(I18N.it.baselineNotSet)).toBeInTheDocument();
    expect(screen.getByText(I18N.it.firstBaselineHint)).toBeInTheDocument();

    // The shutter opens the phone's camera-or-library chooser instead of grabbing a live frame.
    const picker = screen.getByTestId('baseline-photo-input') as HTMLInputElement;
    expect(picker).not.toHaveAttribute('capture');
    const openPicker = vi.spyOn(picker, 'click');
    await user.click(screen.getByLabelText(I18N.it.captureScan));
    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(captureFrame).not.toHaveBeenCalled();

    const photo = new File(['jpeg'], 'baseline.jpg', {type: 'image/jpeg'});
    await user.upload(picker, photo);

    await waitFor(() => {
      expect(screen.getByText(I18N.it.baselineEstablished)).toBeInTheDocument();
    });
    expect(normalizeNativePhoto).toHaveBeenCalledWith(photo);
    expect(saveBaseline).toHaveBeenCalledTimes(1);
    const [shelfId, saved] = vi.mocked(saveBaseline).mock.calls[0];
    expect(shelfId).toBe(0);
    expect(saved).toMatchObject({
      imageDataUrl: FIRST_FRAME,
      imageDimensions: {width: 1080, height: 1920},
      lensFocalLength: 2.2,
    });
    expect(saved).not.toHaveProperty('splitYPercentages');
    expect(screen.getByLabelText(I18N.it.captureScan)).toBeInTheDocument();
    expect(analyzeShelfCapture).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Allineamento e analisi delle differenze in corso...'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Analisi delle differenze in corso, attendere...')).not.toBeInTheDocument();
  });
});
