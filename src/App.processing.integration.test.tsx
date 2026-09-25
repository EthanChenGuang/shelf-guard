import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {I18N} from './lib/constants';

vi.mock('./lib/vision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/vision')>();
  return {
    ...actual,
    analyzeShelfCapture: vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                anomalies: [],
                complianceRate: 95,
                standardCount: 24,
                actualCount: 24,
                displacedCount: 0,
                missingCount: 0,
              }),
            1200,
          );
        }),
    ),
  };
});

vi.mock('./hooks/useCameraStream', () => ({
  useCameraStream: () => ({
    videoRef: {current: null},
    stream: {} as MediaStream,
    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame: vi.fn(async () => 'data:image/jpeg;base64,test'),
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

const persistedBaseline = {
  id: 'baseline-shelf-0',
  createdAt: Date.now(),
  imageBlob: new Blob(['baseline'], {type: 'image/jpeg'}),
  imageDimensions: {width: 1080, height: 1920},
  splitYPercentages: [0.25, 0.45, 0.65, 0.85] as [number, number, number, number],
  tierLabels: ['T1', 'T2', 'T3', 'T4'] as [string, string, string, string],
};

vi.mock('./lib/shelfStorage', () => ({
  runSchemaMigrationIfNeeded: vi.fn(async () => ({ok: true})),
  loadActiveShelfId: vi.fn(async () => 0),
  loadBaselineRaw: vi.fn(async () => persistedBaseline),
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

describe('App PROCESSING integration (STAB-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers({shouldAdvanceTime: true});
  });

  it('shows processing overlay when analysis exceeds 800ms on shutter click', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTimeAsync});
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    await user.click(screen.getByLabelText(I18N.cn.captureScan));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(screen.getByText('正在分析展架差异，请稍候...')).toBeInTheDocument();
  });
});
