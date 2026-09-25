import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { I18N } from './lib/constants';

const { analyzeShelfCapture } = vi.hoisted(() => ({
  analyzeShelfCapture: vi.fn(
    async (_frame: string, _baseline: unknown, _tolerance: number) => ({
      anomalies: [],
      complianceRate: 95,
      standardCount: 24,
      actualCount: 24,
      displacedCount: 0,
      missingCount: 0,
    }),
  ),
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
    videoRef: { current: null },    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame: vi.fn(async () => 'data:image/jpeg;base64,test-capture'),
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
    hasSensor: false,
    orientationPermission: 'granted' as const,
    requestOrientationPermission: vi.fn(),
    setSimulatedTilt: vi.fn(),
  }),
}));

vi.mock('./hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({ isInstallable: false, install: vi.fn() }),
}));

vi.mock('./lib/storage', () => ({
  loadSavedLanguage: vi.fn(async () => 'en'),
  saveLanguage: vi.fn(),
  loadSavedTolerance: vi.fn(async () => 50),
  saveTolerance: vi.fn(),
}));

const persistedBaseline = {
  id: 'baseline-shelf-0',
  createdAt: Date.now(),
  imageBlob: new Blob(['baseline'], { type: 'image/jpeg' }),
  imageDimensions: { width: 1080, height: 1920 },
  splitYPercentages: [0.25, 0.45, 0.65, 0.85] as [number, number, number, number],
  tierLabels: ['T1', 'T2', 'T3', 'T4'] as [string, string, string, string],
};

vi.mock('./lib/shelfStorage', () => ({
  runSchemaMigrationIfNeeded: vi.fn(async () => ({ ok: true })),
  loadActiveShelfId: vi.fn(async () => 0),
  loadBaselineRaw: vi.fn(async () => persistedBaseline),
  loadAuditHistory: vi.fn(async () => []),
  loadAuditHistoryRaw: vi.fn(async () => []),
  saveActiveShelfId: vi.fn(async () => ({ ok: true })),
  saveBaseline: vi.fn(async () => ({ ok: true })),
  clearBaseline: vi.fn(async () => ({ ok: true })),
  appendAuditRecord: vi.fn(async () => ({ ok: true })),
  toViewBaseline: vi.fn((p, url) => ({
    id: p.id,
    createdAt: p.createdAt,
    imageDataUrl: url,
    imageDimensions: p.imageDimensions,
    splitYPercentages: p.splitYPercentages,
    tierLabels: p.tierLabels,
  })),
  toViewAuditRecord: vi.fn(),
}));

describe('App tolerance re-diff integration (VIS-03, D-13)', () => {
  beforeEach(() => {
    analyzeShelfCapture.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('debounced slider change re-invokes analyzeShelfCapture with updated tolerance', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    await user.click(screen.getByLabelText(I18N.en.captureScan));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await Promise.resolve();
    });

    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(analyzeShelfCapture).toHaveBeenCalledTimes(1);
    expect(analyzeShelfCapture.mock.calls[0][2]).toBe(50);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '75' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
      await Promise.resolve();
    });

    expect(analyzeShelfCapture).toHaveBeenCalledTimes(2);
    expect(analyzeShelfCapture.mock.calls[1][2]).toBe(75);
  });
});
