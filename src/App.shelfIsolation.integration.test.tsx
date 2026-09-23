import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {clear, set} from 'idb-keyval';
import App from './App';
import {DEFAULT_CALIBRATION} from './lib/constants';
import type {AuditRecord, ShelfCalibration} from './types';
import {
  appendAuditRecord,
  saveActiveShelfId,
  saveBaseline,
} from './lib/shelfStorage';

const TEST_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';

class MockImage {
  naturalWidth = 640;
  naturalHeight = 480;
  width = 640;
  height = 480;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

function makeCalibration(id: string): ShelfCalibration {
  return {
    id,
    createdAt: Date.now(),
    imageDataUrl: TEST_DATA_URL,
    imageDimensions: {width: 1080, height: 1920},
    splitYPercentages: [0.295, 0.455, 0.618, 0.782],
    tierLabels: ['T1', 'T2', 'T3', 'T4'],
  };
}

function makeAuditRecord(id: string, timeStr: string): AuditRecord {
  return {
    id,
    timestamp: Date.now(),
    dateStr: '9/21',
    timeStr,
    complianceRate: 88,
    standardCount: 24,
    actualCount: 22,
    missingCount: 2,
    displacedCount: 0,
    thumbnailUrl: TEST_DATA_URL,
    anomalies: [],
    tolerance: 'normal',
  };
}

vi.mock('./lib/vision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/vision')>();
  return {
    ...actual,
    analyzeShelfCapture: vi.fn(async () => ({
      anomalies: [],
      complianceRate: 95,
      standardCount: 24,
      actualCount: 24,
      displacedCount: 0,
      missingCount: 0,
    })),
  };
});

let mockIsUsingDemoFeed = true;

vi.mock('./hooks/useCameraStream', () => ({
  useCameraStream: () => ({
    videoRef: {current: null},
    isUsingDemoFeed: mockIsUsingDemoFeed,
    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame: vi.fn(async () => TEST_DATA_URL),
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
    hasSensor: true,
    setSimulatedTilt: vi.fn(),
    orientationPermission: 'granted' as const,
    requestOrientationPermission: vi.fn(),
  }),
}));

vi.mock('./hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({isInstallable: false, install: vi.fn()}),
}));

async function waitForBaselineId(expectedId: string) {
  await waitFor(() => {
    expect(screen.getByTestId('camera-view')).toHaveAttribute(
      'data-baseline-id',
      expectedId,
    );
  });
}

function stubCompressionGlobals() {
  vi.stubGlobal('Image', MockImage);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (source: {width?: number; height?: number}) => ({
      width: source.width ?? 640,
      height: source.height ?? 480,
      close: vi.fn(),
    })),
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    callback(new Blob(['jpeg-bytes'], {type: type ?? 'image/jpeg'}));
  });
}

function getGhostOverlayImg(): HTMLImageElement {
  return screen.getByAltText('Baseline Ghost Overlay') as HTMLImageElement;
}

function getGhostImgSrc(img: HTMLImageElement): string {
  return img.getAttribute('src') ?? img.src;
}

function getShelfDot(shelfIndex: number): HTMLElement {
  const carousel = screen.getByTestId('shelf-carousel');
  const dot = carousel.querySelector(`[data-shelf-index="${shelfIndex}"]`);
  if (!dot) {
    throw new Error(`Missing carousel dot for shelf index ${shelfIndex}`);
  }
  return dot as HTMLElement;
}

function makePointerEvent(type: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}

function swipeHorizontal(el: HTMLElement, dx: number) {
  el.dispatchEvent(makePointerEvent('pointerdown', 100, 200));
  el.dispatchEvent(makePointerEvent('pointerup', 100 + dx, 200));
}

describe('App shelf isolation integration (D-16, SHLF-02, SHLF-04)', () => {
  beforeEach(async () => {
    mockIsUsingDemoFeed = true;
    stubCompressionGlobals();
    await clear();
    await saveBaseline(0, makeCalibration('shelf0-test'));
    await saveBaseline(1, makeCalibration('shelf1-test'));
  });

  it('renders shelf carousel with 5 dots', async () => {
    render(<App />);
    await waitForBaselineId('shelf0-test');

    const carousel = screen.getByTestId('shelf-carousel');
    expect(carousel).toBeInTheDocument();
    expect(carousel.querySelectorAll('[data-shelf-index]')).toHaveLength(5);
  });

  it('loads shelf 0 baseline on init and switches to shelf 1 via carousel dot', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitForBaselineId('shelf0-test');

    await user.click(getShelfDot(1));

    await waitForBaselineId('shelf1-test');
    expect(screen.getByTestId('camera-view')).not.toHaveAttribute(
      'data-baseline-id',
      'shelf0-test',
    );
  });

  it('updates ghost overlay src on shelf switch without stale blob URLs (D-03, D-19, CAM-02)', async () => {
    mockIsUsingDemoFeed = false;
    const user = userEvent.setup();
    render(<App />);

    await waitForBaselineId('shelf0-test');

    await waitFor(() => {
      expect(screen.getByTestId('ghost-overlay')).toBeInTheDocument();
    });

    const shelf0Src = getGhostImgSrc(getGhostOverlayImg());
    expect(shelf0Src).toMatch(/^blob:/);

    await user.click(getShelfDot(1));
    await waitForBaselineId('shelf1-test');

    await waitFor(() => {
      const shelf1Src = getGhostImgSrc(getGhostOverlayImg());
      expect(shelf1Src).toMatch(/^blob:/);
      expect(shelf1Src).not.toBe(shelf0Src);
    });

    const shelf1Src = getGhostImgSrc(getGhostOverlayImg());

    await user.click(getShelfDot(0));
    await waitForBaselineId('shelf0-test');

    await waitFor(() => {
      const restoredSrc = getGhostImgSrc(getGhostOverlayImg());
      expect(restoredSrc).toMatch(/^blob:/);
      expect(restoredSrc).not.toBe(shelf1Src);
    });
  });

  it('switches shelf via swipe gesture on viewport layer', async () => {
    render(<App />);
    await waitForBaselineId('shelf0-test');

    const swipeLayer = screen.getByTestId('shelf-swipe-layer');
    await act(async () => {
      swipeHorizontal(swipeLayer, -60);
    });

    await waitForBaselineId('shelf1-test');
  });

  it('does not show shelf 0 history when switched to shelf 1', async () => {
    const user = userEvent.setup();
    await appendAuditRecord(0, makeAuditRecord('shelf0-audit', 'shelf0-only'));

    render(<App />);
    await waitForBaselineId('shelf0-test');

    await user.click(getShelfDot(1));
    await waitForBaselineId('shelf1-test');

    await user.click(screen.getByLabelText('View Previous Shelf Audit'));

    expect(screen.getByText('暂无历史巡检记录')).toBeInTheDocument();
    expect(screen.queryByText('shelf0-only')).not.toBeInTheDocument();
  });

  it('restores activeShelfId from IndexedDB on remount (SHLF-04)', async () => {
    await saveActiveShelfId(2);

    const {unmount} = render(<App />);
    await waitFor(() => {
      expect(getShelfDot(2)).toHaveAttribute('aria-current', 'true');
    });

    unmount();
    render(<App />);

    await waitFor(() => {
      expect(getShelfDot(2)).toHaveAttribute('aria-current', 'true');
    });
  });

  it('migrates legacy keys, saves baseline on shelf 1, and preserves shelf 0 after switch back', async () => {
    await clear();
    await set('shelfguard_baseline', makeCalibration('legacy-migrated'));
    await set('shelfguard_audit_history', []);

    const user = userEvent.setup();
    render(<App />);

    await waitForBaselineId('legacy-migrated');

    await user.click(getShelfDot(1));
    await waitForBaselineId(DEFAULT_CALIBRATION.id);

    await saveBaseline(1, makeCalibration('shelf1-saved'));

    await user.click(getShelfDot(0));
    await waitForBaselineId('legacy-migrated');

    await user.click(getShelfDot(1));
    await waitForBaselineId('shelf1-saved');
  });
});
