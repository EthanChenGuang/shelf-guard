import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import {getShelfLabel, I18N} from './lib/constants';
import type {AuditRecord, DetectedAnomaly} from './types';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

const mockAnomalies: DetectedAnomaly[] = [
  {
    id: 'anomaly-dismiss-me',
    rowIndex: 0,
    type: 'MISSING',
    title: 'SKU-A Missing',
    confidence: 0.95,
    boundingBox: {x: 0.1, y: 0.15, width: 0.2, height: 0.08},
    score: 0.9,
    dismissed: false,
  },
  {
    id: 'anomaly-keep',
    rowIndex: 1,
    type: 'MOVED',
    title: 'SKU-B Moved',
    displacementNote: '12mm',
    boundingBox: {x: 0.3, y: 0.4, width: 0.15, height: 0.08},
    score: 0.85,
    dismissed: false,
  },
];

const {analyzeShelfCapture, appendAuditRecord} = vi.hoisted(() => ({
  analyzeShelfCapture: vi.fn(
    async () => ({
      anomalies: mockAnomalies.map((a) => ({...a})),
      complianceRate: 88,
      standardCount: 24,
      actualCount: 22,
      displacedCount: 1,
      missingCount: 1,
    }),
  ),
  appendAuditRecord: vi.fn(
    async (_shelfId: number, _record: AuditRecord) => ({ok: true}),
  ),
}));

vi.mock('./lib/vision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/vision')>();
  return {
    ...actual,
    analyzeShelfCapture,
    prewarmVisionWorker: vi.fn(async () => undefined),
  };
});

vi.mock('./hooks/useCameraStream', () => ({
  useCameraStream: () => ({
    videoRef: {current: null},
    isUsingDemoFeed: true,
    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame: vi.fn(async () => 'data:image/jpeg;base64,audit-capture'),
    startCamera: vi.fn(),
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
    hasSensor: false,
    orientationPermission: 'granted' as const,
    requestOrientationPermission: vi.fn(),
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

const persistedBaseline = {
  id: 'baseline-shelf-2',
  createdAt: Date.now(),
  imageBlob: new Blob(['baseline'], {type: 'image/jpeg'}),
  imageDimensions: {width: 1080, height: 1920},
  splitYPercentages: [0.25, 0.45, 0.65, 0.85] as [number, number, number, number],
  tierLabels: ['T1', 'T2', 'T3', 'T4'] as [string, string, string, string],
};

vi.mock('./lib/shelfStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/shelfStorage')>();
  return {
    ...actual,
    runSchemaMigrationIfNeeded: vi.fn(async () => ({ok: true})),
    loadActiveShelfId: vi.fn(async () => 2),
    loadBaselineRaw: vi.fn(async () => persistedBaseline),
    loadAuditHistory: vi.fn(async () => []),
    loadAuditHistoryRaw: vi.fn(async () => []),
    saveActiveShelfId: vi.fn(async () => ({ok: true})),
    saveBaseline: vi.fn(async () => ({ok: true})),
    clearBaseline: vi.fn(async () => ({ok: true})),
    appendAuditRecord,
    toViewBaseline: vi.fn((p, url) => ({
      id: p.id,
      createdAt: p.createdAt,
      imageDataUrl: url,
      imageDimensions: p.imageDimensions,
      splitYPercentages: p.splitYPercentages,
      tierLabels: p.tierLabels,
    })),
    toViewAuditRecord: vi.fn(),
  };
});

describe('App complete audit integration (RSLT-06, D-26)', () => {
  beforeEach(() => {
    analyzeShelfCapture.mockClear();
    appendAuditRecord.mockClear();
    vi.useFakeTimers({shouldAdvanceTime: true});
  });

  it('persists dismissed anomalies and returns to current shelf camera', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTimeAsync});
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('tab', {name: getShelfLabel('cn', 2)})).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(screen.getByLabelText(I18N.cn.captureScan));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
      await Promise.resolve();
    });

    expect(screen.getByText('确认并完成巡检')).toBeInTheDocument();

    const dismissTarget = screen
      .getByText('SKU-A Missing')
      .closest('.ar-box') as HTMLElement;
    fireEvent.click(dismissTarget);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(220);
    });

    await user.click(screen.getByText('确认并完成巡检'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(appendAuditRecord).toHaveBeenCalledTimes(1);
    const [shelfId, record] = appendAuditRecord.mock.calls[0]!;
    expect(shelfId).toBe(2);
    expect(record.tolerance).toBe(50);
    expect(record.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({id: 'anomaly-dismiss-me', dismissed: true}),
        expect.objectContaining({id: 'anomaly-keep', dismissed: false}),
      ]),
    );

    await waitFor(() => {
      expect(screen.getByTestId('camera-view')).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', {name: getShelfLabel('cn', 2)})).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('shows analysis-failed copy and returns to camera on worker error', async () => {
    analyzeShelfCapture.mockRejectedValueOnce(new Error('Vision worker analysis failed'));

    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTimeAsync});
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    await user.click(screen.getByLabelText(I18N.cn.captureScan));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('分析失败，请重试拍摄')).toBeInTheDocument();
    expect(screen.getByTestId('camera-view')).toBeInTheDocument();
    expect(screen.queryByText('正在分析展架差异，请稍候...')).not.toBeInTheDocument();
  });
});
