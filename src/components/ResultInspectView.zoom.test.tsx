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

  it('shows a non-blocking Italian pinch overlay before the hold hint', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    const pinch = screen.getByTestId('inspect-pinch-hint');
    expect(pinch.className).toContain('pointer-events-none');
    expect(pinch).toHaveTextContent('Pizzica con due dita per ingrandire');
    expect(screen.queryByTestId('inspect-hold-hint')).not.toBeInTheDocument();
  });

  it('sequences pinch then an animated hold hint', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    expect(screen.getByTestId('inspect-pinch-hint')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(8401);
    });
    expect(screen.queryByTestId('inspect-pinch-hint')).not.toBeInTheDocument();
    const hold = screen.getByTestId('inspect-hold-hint');
    expect(hold.className).toContain('pointer-events-none');
    expect(hold).toHaveTextContent('Tieni premuto per vedere il riferimento');
    expect(screen.getByTestId('inspect-hold-graphic')).toBeInTheDocument();
    expect(hold.querySelector('.inspect-hint-pill')?.className).toMatch(/rounded-full/);
    expect(hold.querySelector('.inspect-hint-pill')?.className).toMatch(/bg-black/);
  });

  it('keeps the animated hold hint while zoomed', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    act(() => {
      vi.advanceTimersByTime(8401);
    });
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
    expect(Number(viewport.getAttribute('data-zoom-scale'))).toBeGreaterThan(1);
    const hold = screen.getByTestId('inspect-hold-hint');
    expect(hold).toBeInTheDocument();
    expect(hold.className).toContain('z-[70]');
    expect(hold.className).toContain('pointer-events-none');
    expect(screen.getByTestId('inspect-hold-graphic')).toBeInTheDocument();
  });

  it('dismisses the pinch hint on first interaction without blocking later pinch zoom', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    fireEvent.touchStart(viewport, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 100 },
        { identifier: 1, clientX: 100, clientY: 160 },
      ],
    });
    expect(screen.getByTestId('inspect-pinch-hint').getAttribute('data-hint-fading')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByTestId('inspect-pinch-hint')).not.toBeInTheDocument();
    expect(screen.getByTestId('inspect-hold-hint')).toBeInTheDocument();

    fireEvent.touchMove(viewport, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 40 },
        { identifier: 1, clientX: 100, clientY: 220 },
      ],
    });
    expect(Number(viewport.getAttribute('data-zoom-scale'))).toBeGreaterThan(1);
  });

  it('skips pinch and hold motion when prefers-reduced-motion is set', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: String(query).includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;
    render(<ResultInspectView {...baseProps} lang="it" />);
    expect(screen.getByTestId('inspect-pinch-hint').getAttribute('data-reduced-motion')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(screen.getByTestId('inspect-hold-hint').getAttribute('data-reduced-motion')).toBe('true');
    window.matchMedia = original;
  });
});
