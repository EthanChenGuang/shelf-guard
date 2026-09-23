import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, waitFor} from '@testing-library/react';
import App from './App';

const {startCameraMock, requestOrientationPermissionMock} = vi.hoisted(() => ({
  startCameraMock: vi.fn(async () => true),
  requestOrientationPermissionMock: vi.fn(async () => 'granted' as const),
}));

vi.mock('./hooks/useCameraStream', () => ({
  useCameraStream: () => ({
    videoRef: {current: null},
    isUsingDemoFeed: true,
    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame: vi.fn(async () => 'data:image/jpeg;base64,auto-camera-activation-frame'),
    startCamera: startCameraMock,
    stopCamera: vi.fn(),
    toggleTorch: vi.fn(),
    toggleDemoMode: vi.fn(),
    clearCameraError: vi.fn(),
  }),
}));

vi.mock('./hooks/useDeviceOrientation', () => ({
  useDeviceOrientation: () => ({
    tilt: 0,
    isLevel: true,
    hasSensor: true,
    orientationPermission: 'prompt' as const,
    requestOrientationPermission: requestOrientationPermissionMock,
    setSimulatedTilt: vi.fn(),
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

describe('App auto camera activation on first-baseline guide (bugfix 260924-12a)', () => {
  beforeEach(() => {
    startCameraMock.mockClear();
    requestOrientationPermissionMock.mockClear();
  });

  it('requests real camera access exactly once when the shelf has no persisted baseline', async () => {
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(startCameraMock).toHaveBeenCalledTimes(1);
    });

    // Give any further effect passes a chance to run — must still be exactly once.
    await act(async () => {
      await Promise.resolve();
    });
    expect(startCameraMock).toHaveBeenCalledTimes(1);
  });

  it('requests orientation permission exactly once after camera activation succeeds', async () => {
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(startCameraMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(requestOrientationPermissionMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(requestOrientationPermissionMock).toHaveBeenCalledTimes(1);
  });
});
