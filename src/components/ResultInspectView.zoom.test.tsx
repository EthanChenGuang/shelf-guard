import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

describe('ResultInspectView inline pinch-zoom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has no comparison fullscreen overlay or expand control', () => {
    render(<ResultInspectView {...baseProps} />);
    expect(screen.queryByTestId('inspect-image-fullscreen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inspect-image-fullscreen-open')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('centers the comparison image with mx-auto on the sized frame', () => {
    render(<ResultInspectView {...baseProps} />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    expect(viewport.className).toContain('mx-auto');
    expect(viewport.style.width).toContain('min(');
    expect(viewport.className).not.toContain('w-fit');
    expect(viewport.className).not.toContain('w-full');
  });

  it('does not open an overlay on a short tap', () => {
    render(<ResultInspectView {...baseProps} />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    fireEvent.mouseDown(viewport);
    fireEvent.mouseUp(viewport);
    expect(screen.queryByTestId('inspect-image-fullscreen')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps anomaly overlays on the inline image when layers are visible', () => {
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
    const viewport = screen.getByTestId('inspect-image-viewport');
    expect(viewport.querySelectorAll('.ar-box').length).toBe(1);
  });

  it('shows the baseline at the same zoom after a hold', () => {
    const props = {
      ...baseProps,
      baseline: { ...baseProps.baseline, imageDataUrl: 'blob:https://example.com/persisted-baseline' },
    };
    render(<ResultInspectView {...props} />);

    const viewport = screen.getByTestId('inspect-image-viewport');
    fireEvent.touchStart(viewport, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 100 },
        { identifier: 1, clientX: 100, clientY: 160 },
      ],
    });
    fireEvent.touchMove(viewport, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 40 },
        { identifier: 1, clientX: 100, clientY: 220 },
      ],
    });
    fireEvent.touchEnd(viewport, { touches: [] });

    expect(Number(viewport.getAttribute('data-zoom-scale'))).toBeGreaterThan(1);
    const scaleAfterZoom = viewport.getAttribute('data-zoom-scale');

    fireEvent.mouseDown(viewport, { clientX: 120, clientY: 180 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const img = viewport.querySelector('[data-testid="inspect-comparison-image"]') as HTMLImageElement;
    expect(img.src).toContain('persisted-baseline');
    expect(viewport.querySelector('[data-showing-baseline="true"]')).toBeTruthy();
    expect(viewport.getAttribute('data-zoom-scale')).toBe(scaleAfterZoom);
  });

  it('does not blink-compare while a pinch finger is still down', () => {
    const props = {
      ...baseProps,
      baseline: { ...baseProps.baseline, imageDataUrl: 'blob:https://example.com/persisted-baseline' },
    };
    render(<ResultInspectView {...props} />);
    const viewport = screen.getByTestId('inspect-image-viewport');

    fireEvent.touchStart(viewport, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 100 },
        { identifier: 1, clientX: 100, clientY: 160 },
      ],
    });
    fireEvent.touchMove(viewport, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 40 },
        { identifier: 1, clientX: 100, clientY: 220 },
      ],
    });
    fireEvent.touchEnd(viewport, {
      touches: [{ identifier: 0, clientX: 100, clientY: 40 }],
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(viewport.querySelector('[data-showing-baseline="true"]')).toBeFalsy();
    expect(Number(viewport.getAttribute('data-zoom-scale'))).toBeGreaterThan(1);
  });

  it('clips the photo to the frame at rest and lets it overflow while zoomed', () => {
    render(<ResultInspectView {...baseProps} />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    expect(viewport.className).toContain('overflow-hidden');
    expect(viewport.className).not.toContain('overflow-visible');
    expect(viewport.getAttribute('data-inspect-zoomed')).toBe('false');

    fireEvent.touchStart(viewport, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 100 },
        { identifier: 1, clientX: 100, clientY: 160 },
      ],
    });
    fireEvent.touchMove(viewport, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 40 },
        { identifier: 1, clientX: 100, clientY: 220 },
      ],
    });

    expect(Number(viewport.getAttribute('data-zoom-scale'))).toBeGreaterThan(1);
    expect(viewport.getAttribute('data-inspect-zoomed')).toBe('true');
    expect(viewport.className).toContain('overflow-visible');
    expect(viewport.className).toContain('z-[60]');
    expect(viewport.className).toContain('touch-none');
    expect(viewport.style.touchAction).toBe('none');
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBe('true');
    expect(screen.getByTestId('inspect-image-zoom-layer')).toBeInTheDocument();
  });
});
