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

  it('marks the frame zoomed on two-finger start before the scale changes', () => {
    render(<ResultInspectView {...baseProps} />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    fireEvent.touchStart(viewport, {
      touches: [
        { identifier: 0, clientX: 100, clientY: 100 },
        { identifier: 1, clientX: 100, clientY: 160 },
      ],
    });

    expect(Number(viewport.getAttribute('data-zoom-scale'))).toBe(1);
    expect(viewport.getAttribute('data-inspect-zoomed')).toBe('true');
    expect(viewport.className).toContain('z-[60]');
    expect(viewport.className).toContain('overflow-visible');
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBe('true');

    fireEvent.touchEnd(viewport, { touches: [] });
    expect(Number(viewport.getAttribute('data-zoom-scale'))).toBe(1);
    expect(viewport.getAttribute('data-inspect-zoomed')).toBe('false');
    expect(viewport.className).not.toContain('z-[60]');
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBeNull();
  });

  it('never clips the inspect transform ancestor, at rest or while zoomed', () => {
    render(<ResultInspectView {...baseProps} />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    const layer = screen.getByTestId('inspect-image-zoom-layer');
    expect(viewport.className).toContain('overflow-visible');
    expect(viewport.className).toContain('mx-auto');
    expect(viewport.className).not.toContain('overflow-hidden');
    expect(viewport.className).not.toContain('overflow-auto');
    expect(viewport.className).not.toContain('overflow-scroll');
    expect(viewport.className).not.toContain('z-[60]');
    expect(layer.className).not.toContain('will-change-transform');
    expect(screen.getByTestId('inspect-shelf-canvas').className).toContain('overflow-hidden');
    expect(screen.queryByTestId('inspect-image-fullscreen')).not.toBeInTheDocument();
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
    expect(viewport.className).not.toContain('overflow-hidden');
    expect(viewport.className).toContain('z-[60]');
    expect(viewport.className).toContain('touch-none');
    expect(viewport.style.touchAction).toBe('none');
    expect(layer.className).not.toContain('will-change-transform');
    expect(screen.getByTestId('inspect-shelf-canvas').className).toContain('overflow-hidden');
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBe('true');
    expect(screen.queryByTestId('inspect-image-fullscreen')).not.toBeInTheDocument();
  });


  it('does not show a pinch overlay on the comparison image', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    expect(screen.queryByTestId('inspect-pinch-hint')).not.toBeInTheDocument();
    expect(screen.getByTestId('inspect-hold-hint')).toBeInTheDocument();
  });

  it('shows the animated hold hint immediately with Italian copy', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    const hold = screen.getByTestId('inspect-hold-hint');
    expect(hold.className).toContain('pointer-events-none');
    expect(hold).toHaveTextContent('Puoi ingrandire · Tieni premuto per vedere il riferimento');
    expect(screen.getByTestId('inspect-hold-graphic')).toBeInTheDocument();
    expect(hold.querySelector('.inspect-hint-pill')?.className).toMatch(/rounded-full/);
    expect(hold.querySelector('.inspect-hint-pill')?.className).toMatch(/bg-black/);
    expect(hold.querySelector('.inspect-hint-caption')?.className).toMatch(/inspect-hint-caption/);
  });

  it('keeps the animated hold hint while zoomed', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
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
    expect(viewport.contains(hold)).toBe(false);
    expect(screen.getByTestId('inspect-hold-strip').className).toContain('z-[70]');
    expect(hold.className).toContain('pointer-events-none');
    expect(screen.getByTestId('inspect-hold-graphic')).toBeInTheDocument();
  });

  it('places the hold hint below the comparison image, not on it', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    const hold = screen.getByTestId('inspect-hold-hint');
    expect(viewport.contains(hold)).toBe(false);
    expect(hold.getAttribute('data-hold-placement')).toBe('below');
    expect(hold).toHaveTextContent('Puoi ingrandire · Tieni premuto per vedere il riferimento');
    expect(hold.querySelector('.inspect-hint-caption')).toHaveTextContent(
      'Puoi ingrandire · Tieni premuto per vedere il riferimento',
    );
  });

  it('uses one-line zoom+hold copy in English and Chinese', () => {
    const { rerender } = render(<ResultInspectView {...baseProps} lang="en" />);
    expect(screen.getByTestId('inspect-hold-hint')).toHaveTextContent(
      'Pinch to zoom · Hold to see reference',
    );
    rerender(<ResultInspectView {...baseProps} lang="cn" />);
    expect(screen.getByTestId('inspect-hold-hint')).toHaveTextContent(
      '可以放大显示 · 按住显示参考图',
    );
  });

  it('shows the viewing-reference status below the image while holding', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    fireEvent.mouseDown(viewport, { clientX: 120, clientY: 180 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const hold = screen.getByTestId('inspect-hold-hint');
    expect(hold).toHaveTextContent('Stai vedendo la foto di riferimento');
    expect(viewport.contains(hold)).toBe(false);
    expect(screen.queryByTestId('inspect-hold-graphic')).not.toBeInTheDocument();
  });

  it('pinch zoom works without a pinch overlay on first interaction', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    expect(screen.queryByTestId('inspect-pinch-hint')).not.toBeInTheDocument();
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
    expect(screen.getByTestId('inspect-hold-hint')).toBeInTheDocument();
  });

  it('marks hold hint reduced-motion when prefers-reduced-motion is set', () => {
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
    expect(screen.getByTestId('inspect-hold-hint').getAttribute('data-reduced-motion')).toBe('true');
    window.matchMedia = original;
  });
});
