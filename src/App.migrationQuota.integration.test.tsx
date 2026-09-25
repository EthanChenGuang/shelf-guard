import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import {clear} from 'idb-keyval';
import App from './App';
import {DEFAULT_CALIBRATION} from './lib/constants';

vi.mock('./lib/shelfStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/shelfStorage')>();
  return {
    ...actual,
    runSchemaMigrationIfNeeded: vi.fn(async () => ({
      ok: false as const,
      error: 'QUOTA_EXCEEDED' as const,
    })),
  };
});

vi.mock('./hooks/useCameraStream', () => ({
  useCameraStream: () => ({
    videoRef: {current: null},
    stream: {} as MediaStream,
    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame: vi.fn(async () => ''),
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

describe('App migration quota banner (D-20)', () => {
  beforeEach(async () => {
    await clear();
  });

  it('shows quota banner and skips shelf hydration when migration fails', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('本地存储空间已满')).toBeInTheDocument();
      expect(
        screen.getByText('请先在其它货架完成巡检，或清除部分历史记录后再试。'),
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId('camera-view')).toHaveAttribute(
      'data-baseline-id',
      DEFAULT_CALIBRATION.id,
    );
  });
});
