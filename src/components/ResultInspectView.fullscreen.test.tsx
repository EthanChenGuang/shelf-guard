import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultInspectView } from './ResultInspectView';
import { DEFAULT_CALIBRATION } from '../lib/constants';

const baseProps = {
  currentCaptureUrl: 'data:image/jpeg;base64,capture',
  baseline: DEFAULT_CALIBRATION,
  anomalies: [],
  complianceRate: 88,
  standardCount: 24,
  actualCount: 22,
  displacedCount: 0,
  missingCount: 0,
  addedCount: 0,
  tolerance: 50,
  onToleranceChange: vi.fn(),
  minConfidence: 85,
  onMinConfidenceChange: vi.fn(),
  onDismissAnomaly: vi.fn(),
  onCompleteAudit: vi.fn(),
  onBackToCamera: vi.fn(),
  lang: 'en' as const,
};

function stubInner(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function stubCssSmallViewport(size: { width: number; height: number }) {
  const orig = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.getAttribute('data-css-small-viewport') === 'true') {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: size.width,
        bottom: size.height,
        width: size.width,
        height: size.height,
        toJSON() {
          return {};
        },
      } as DOMRect;
    }
    return orig.call(this);
  });
}

describe('ResultInspectView comparison fullscreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens fullscreen overlay from the expand control', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<ResultInspectView {...baseProps} />);

    expect(screen.queryByTestId('inspect-image-fullscreen')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('inspect-image-fullscreen-open'));

    expect(screen.getByTestId('inspect-image-fullscreen')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /comparison analysis/i })).toBeInTheDocument();
  });

  it('closes fullscreen with the close control', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<ResultInspectView {...baseProps} />);

    await user.click(screen.getByTestId('inspect-image-fullscreen-open'));
    await user.click(screen.getByTestId('inspect-image-fullscreen-close'));

    expect(screen.queryByTestId('inspect-image-fullscreen')).not.toBeInTheDocument();
  });

  it('opens fullscreen on a short tap on the viewport', () => {
    render(<ResultInspectView {...baseProps} />);

    fireEvent.mouseDown(screen.getByTestId('inspect-image-viewport'));
    fireEvent.mouseUp(screen.getByTestId('inspect-image-viewport'));

    expect(screen.getByTestId('inspect-image-fullscreen')).toBeInTheDocument();
  });

  it('shows baseline on hold without opening fullscreen', () => {
    render(<ResultInspectView {...baseProps} />);
    const viewport = screen.getByTestId('inspect-image-viewport');

    fireEvent.mouseDown(viewport);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText(/showing the baseline photo/i)).toBeInTheDocument();
    expect(screen.queryByTestId('inspect-image-fullscreen')).not.toBeInTheDocument();

    fireEvent.mouseUp(viewport);
    expect(screen.queryByTestId('inspect-image-fullscreen')).not.toBeInTheDocument();
  });

  it('keeps anomaly overlays in fullscreen when layers are visible', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const props = {
      ...baseProps,
      anomalies: [
        {
          id: 'missing-1',
          type: 'MISSING' as const,
          title: 'Missing SKU',
          score: 0.92,
          boundingBox: { x: 0.1, y: 0.15, width: 0.2, height: 0.12 },
          dismissed: false,
        },
      ],
      missingCount: 1,
    };
    render(<ResultInspectView {...props} />);

    await user.click(screen.getByTestId('inspect-image-fullscreen-open'));

    const boxes = screen.getByTestId('inspect-image-fullscreen').querySelectorAll('.ar-box');
    expect(boxes.length).toBe(1);
  });

  it('centers the comparison image with mx-auto on the sized frame', () => {
    render(<ResultInspectView {...baseProps} />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    expect(viewport.className).toContain('mx-auto');
    expect(viewport.style.width).toContain('min(');
    expect(viewport.className).not.toContain('w-fit');
    expect(viewport.className).not.toContain('w-full');
  });

  it('portals an opaque overlay sized to the visual viewport, not 100dvh', async () => {
    vi.useRealTimers();
    const listeners: Record<string, () => void> = {};
    const vv = {
      offsetTop: 40,
      offsetLeft: 0,
      width: 844,
      height: 300,
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };
    stubInner(844, 340);
    vi.stubGlobal('visualViewport', vv);

    const user = userEvent.setup();
    render(<ResultInspectView {...baseProps} />);
    await user.click(screen.getByTestId('inspect-image-fullscreen-open'));

    const overlay = screen.getByTestId('inspect-image-fullscreen');
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.top).toBe('40px');
    expect(overlay.style.width).toBe('844px');
    expect(overlay.style.height).toBe('300px');
    expect(overlay.style.width).not.toContain('vw');
    expect(overlay.style.height).not.toContain('dvh');
    expect(overlay.className).toContain('bg-black');

    const canvas = overlay.querySelector('[data-testid="inspect-shelf-canvas"]') as HTMLElement;
    expect(canvas.dataset.layout).toBe('contain');
    expect(canvas.style.width).toMatch(/px$/);
    expect(canvas.style.height).toMatch(/px$/);
    expect(canvas.style.width).not.toContain('vw');
    expect(canvas.style.height).not.toContain('dvh');

    vv.offsetTop = 0;
    vv.width = 390;
    vv.height = 844;
    stubInner(390, 844);
    act(() => {
      listeners.resize?.();
    });
    expect(screen.getByTestId('inspect-image-fullscreen').style.width).toBe('390px');
    expect(screen.getByTestId('inspect-image-fullscreen').style.height).toBe('844px');
    expect(screen.getByTestId('inspect-image-fullscreen').style.top).toBe('0px');

    vi.unstubAllGlobals();
  });

  it('shows the baseline at the same zoom after a hold in fullscreen', () => {
    const props = {
      ...baseProps,
      baseline: { ...baseProps.baseline, imageDataUrl: 'blob:https://example.com/persisted-baseline' },
    };
    render(<ResultInspectView {...props} />);
    fireEvent.click(screen.getByTestId('inspect-image-fullscreen-open'));

    const stage = screen.getByTestId('inspect-image-fullscreen-stage');
    fireEvent.touchStart(stage, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 100 },
        { identifier: 1, clientX: 100, clientY: 160 },
      ],
    });
    fireEvent.touchMove(stage, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 40 },
        { identifier: 1, clientX: 100, clientY: 220 },
      ],
    });
    fireEvent.touchEnd(stage, { touches: [] });

    expect(Number(stage.getAttribute('data-zoom-scale'))).toBeGreaterThan(1);
    const scaleAfterZoom = stage.getAttribute('data-zoom-scale');

    fireEvent.mouseDown(stage, { clientX: 120, clientY: 180 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const overlay = screen.getByTestId('inspect-image-fullscreen');
    const img = overlay.querySelector('[data-testid="inspect-comparison-image"]') as HTMLImageElement;
    expect(img.src).toContain('persisted-baseline');
    expect(overlay.querySelector('[data-showing-baseline="true"]')).toBeTruthy();
    expect(stage.getAttribute('data-zoom-scale')).toBe(scaleAfterZoom);
  });

  it('sizes the WebKit-lie overlay to the measured small viewport and contain-fits the photo', async () => {
    vi.useRealTimers();
    const listeners: Record<string, () => void> = {};
    const vv = {
      offsetTop: 0,
      offsetLeft: 0,
      width: 844,
      height: 390,
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };
    stubInner(844, 390);
    stubCssSmallViewport({ width: 844, height: 334 });
    vi.stubGlobal('visualViewport', vv);

    const user = userEvent.setup();
    render(<ResultInspectView {...baseProps} />);
    await user.click(screen.getByTestId('inspect-image-fullscreen-open'));

    const overlay = screen.getByTestId('inspect-image-fullscreen');
    expect(overlay.style.top).toBe('56px');
    expect(overlay.style.height).toBe('334px');
    expect(overlay.style.width).toBe('844px');

    const canvas = overlay.querySelector('[data-testid="inspect-shelf-canvas"]') as HTMLElement;
    expect(canvas.dataset.layout).toBe('contain');
    expect(canvas.style.width).toMatch(/px$/);
    expect(canvas.style.height).toMatch(/px$/);
    const canvasW = parseFloat(canvas.style.width);
    const canvasH = parseFloat(canvas.style.height);
    expect(canvasW).toBeLessThanOrEqual(334 - 96);
    expect(canvasH).toBeLessThanOrEqual(334 - 96);
    expect(screen.getByTestId('inspect-image-fullscreen-hint')).toBeInTheDocument();
  });

  it('opens the overlay when documentElement.requestFullscreen rejects', async () => {
    vi.useRealTimers();
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => Promise.reject(new Error('fullscreen denied'))),
    });
    const user = userEvent.setup();
    render(<ResultInspectView {...baseProps} />);
    await user.click(screen.getByTestId('inspect-image-fullscreen-open'));
    expect(screen.getByTestId('inspect-image-fullscreen')).toBeInTheDocument();
  });
});
