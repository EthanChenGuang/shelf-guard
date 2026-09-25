import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, waitFor} from '@testing-library/react';
import App from './App';

const {requestOrientationPermissionMock} = vi.hoisted(() => ({
  requestOrientationPermissionMock: vi.fn(async () => 'granted' as const),
}));

vi.mock('./hooks/useCameraStream', () => ({
  useCameraStream: () => ({
    videoRef: {current: null},
    stream: {} as MediaStream,
    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame: vi.fn(async () => 'data:image/jpeg;base64,auto-camera-activation-frame'),
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

describe('App orientation permission after camera stream (bugfix 260924-12a)', () => {
  beforeEach(() => {
    requestOrientationPermissionMock.mockClear();
  });

  it('requests orientation permission exactly once after the camera stream is active', async () => {
    render(<App />);

    await act(async () => {
      await Promise.resolve();
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
