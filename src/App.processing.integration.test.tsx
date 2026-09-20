import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {DEFAULT_CALIBRATION} from './lib/constants';

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
    isUsingDemoFeed: true,
    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame: vi.fn(async () => 'data:image/jpeg;base64,test'),
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    toggleTorch: vi.fn(),
    toggleDemoMode: vi.fn(),
    retryCamera: vi.fn(),
    dismissCameraError: vi.fn(),
  }),
}));

vi.mock('./hooks/useDeviceOrientation', () => ({
  useDeviceOrientation: () => ({tilt: 0, isLevel: true}),
}));

vi.mock('./hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({canInstall: false, promptInstall: vi.fn()}),
}));

vi.mock('./lib/storage', () => ({
  loadBaseline: vi.fn(async () => DEFAULT_CALIBRATION),
  saveBaseline: vi.fn(),
  clearBaseline: vi.fn(),
  loadAuditHistory: vi.fn(async () => []),
  saveAuditRecord: vi.fn(),
  loadSavedLanguage: vi.fn(async () => 'cn'),
  saveLanguage: vi.fn(),
  loadSavedTolerance: vi.fn(async () => 'normal'),
  saveTolerance: vi.fn(),
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

    await user.click(screen.getByLabelText('Capture & Scan Planogram'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(screen.getByText('正在分析展架差异，请稍候...')).toBeInTheDocument();
  });
});
