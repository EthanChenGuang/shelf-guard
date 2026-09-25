import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {clear} from 'idb-keyval';
import App from './App';
import type {ShelfCalibration} from './types';
import {saveBaseline} from './lib/shelfStorage';

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

vi.mock('./hooks/useCameraStream', () => ({
  useCameraStream: () => ({
    videoRef: {current: null},
    stream: {} as MediaStream,
    isTorchOn: false,
    hasTorch: false,
    cameraError: null,
    captureFrame: vi.fn(async () => TEST_DATA_URL),
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
    setSimulatedTilt: vi.fn(),
    orientationPermission: 'granted' as const,
    requestOrientationPermission: vi.fn(),
  }),
}));

vi.mock('./hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({isInstallable: false, install: vi.fn()}),
}));

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

function getShelfDot(shelfIndex: number): HTMLElement {
  const carousel = screen.getByTestId('shelf-carousel');
  const dot = carousel.querySelector(`[data-shelf-index="${shelfIndex}"]`);
  if (!dot) {
    throw new Error(`Missing carousel dot for shelf index ${shelfIndex}`);
  }
  return dot as HTMLElement;
}

function makePointerEvent(type: string, clientX: number, clientY: number) {
  const event = new Event(type, {bubbles: true}) as PointerEvent;
  Object.defineProperties(event, {
    clientX: {value: clientX},
    clientY: {value: clientY},
  });
  return event;
}

function swipeHorizontal(el: HTMLElement, dx: number) {
  el.dispatchEvent(makePointerEvent('pointerdown', 100, 200));
  el.dispatchEvent(makePointerEvent('pointerup', 100 + dx, 200));
}

async function waitForBaselineId(expectedId: string) {
  await waitFor(() => {
    expect(screen.getByTestId('camera-view')).toHaveAttribute(
      'data-baseline-id',
      expectedId,
    );
  });
}

describe('App INITIAL_GUIDE integration (D-33, SHLF-05)', () => {
  beforeEach(async () => {
    stubCompressionGlobals();
    await clear();
    await saveBaseline(0, makeCalibration('shelf0-baseline'));
  });

  it('shows initial-guide on empty shelf 1 and hides on shelf 0 with baseline', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitForBaselineId('shelf0-baseline');
    expect(screen.queryByTestId('initial-guide')).not.toBeInTheDocument();

    await user.click(getShelfDot(1));

    await waitFor(() => {
      expect(screen.getByTestId('initial-guide')).toBeInTheDocument();
      expect(document.querySelector('video')).toBeInTheDocument();
    });

    await user.click(getShelfDot(0));

    await waitFor(() => {
      expect(screen.queryByTestId('initial-guide')).not.toBeInTheDocument();
    });
  });

  it('keeps carousel swipe working while INITIAL_GUIDE is active', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitForBaselineId('shelf0-baseline');
    await user.click(getShelfDot(1));

    await waitFor(() => {
      expect(screen.getByTestId('initial-guide')).toBeInTheDocument();
    });

    const swipeLayer = screen.getByTestId('shelf-swipe-layer');
    await act(async () => {
      swipeHorizontal(swipeLayer, -60);
    });

    await waitFor(() => {
      expect(getShelfDot(2)).toHaveAttribute('aria-current', 'true');
      expect(screen.getByTestId('initial-guide')).toBeInTheDocument();
    });
  });

  it('re-shows initial-guide after baseline reset on shelf 0', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitForBaselineId('shelf0-baseline');
    expect(screen.queryByTestId('initial-guide')).not.toBeInTheDocument();

    await user.click(screen.getByText('基准图 (已建立)'));

    await user.click(screen.getByText('清除基准图并重新拍摄'));

    await waitFor(() => {
      expect(screen.getByTestId('initial-guide')).toBeInTheDocument();
    });
  });
});
