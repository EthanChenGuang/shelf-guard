import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {I18N} from './lib/constants';

const {analyzeShelfCapture} = vi.hoisted(() => ({
  analyzeShelfCapture: vi.fn(),
}));

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
    captureFrame: vi.fn(async () => 'data:image/jpeg;base64,first-baseline-frame'),
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
  loadSavedLanguage: vi.fn(async () => 'cn'),
  saveLanguage: vi.fn(),
  loadSavedTolerance: vi.fn(async () => 50),
  saveTolerance: vi.fn(),
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
    splitYPercentages: p.splitYPercentages,
    tierLabels: p.tierLabels,
  })),
}));

describe('App first-baseline integration (D-01, ROI-01)', () => {
  beforeEach(() => {
    analyzeShelfCapture.mockClear();
    vi.stubGlobal('Image', MockImage);
    vi.useFakeTimers({shouldAdvanceTime: true});
  });

  it('routes empty shelf shutter to ROI setup without calling vision', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTimeAsync});
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    await user.click(screen.getByLabelText(I18N.cn.captureScan));

    expect(screen.getByText('基准横梁标定')).toBeInTheDocument();
    expect(screen.getByAltText('Calibration Still Shelf Frame')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,first-baseline-frame',
    );
    expect(analyzeShelfCapture).not.toHaveBeenCalled();
    expect(
      screen.queryByText('正在进行透视配准与差分分析...'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('正在分析展架差异，请稍候...')).not.toBeInTheDocument();
  });
});
