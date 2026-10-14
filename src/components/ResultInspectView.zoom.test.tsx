import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

const IT_HINT = 'Tocca 🔍 per ingrandire · Tieni premuto per il riferimento';

const withBaselineUrl = {
  ...baseProps,
  baseline: { ...baseProps.baseline, imageDataUrl: 'blob:https://example.com/persisted-baseline' },
};

function pinchOut(el: Element) {
  fireEvent.touchStart(el, {
    touches: [
      { identifier: 0, clientX: 100, clientY: 100 },
      { identifier: 1, clientX: 100, clientY: 160 },
    ],
  });
  fireEvent.touchMove(el, {
    touches: [
      { identifier: 0, clientX: 100, clientY: 40 },
      { identifier: 1, clientX: 100, clientY: 220 },
    ],
  });
  fireEvent.touchEnd(el, { touches: [] });
}

describe('ResultInspectView zoom mode', () => {
  let historyBack: ReturnType<typeof vi.spyOn>;
  let scrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    document.documentElement.style.cssText = 'overflow-x: hidden;';
    document.body.style.cssText = 'overflow-x: hidden;';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
  });

  it('idle photo lets vertical swipes scroll: pan-y, no overlay, no inline pinch', () => {
    render(<ResultInspectView {...baseProps} />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    expect(viewport.style.touchAction).toBe('pan-y');
    expect(viewport.className).not.toContain('touch-none');
    expect(screen.queryByTestId('inspect-zoom-overlay')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    pinchOut(viewport);
    expect(viewport.hasAttribute('data-zoom-scale')).toBe(false);
    expect(viewport.querySelector('[style*="scale("]')).toBeNull();
    expect(screen.queryByTestId('inspect-zoom-overlay')).not.toBeInTheDocument();
    expect(document.body.style.position).toBe('');
  });

  it('a vertical touch swipe on the idle photo is not cancelled', () => {
    render(<ResultInspectView {...baseProps} />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    const start = fireEvent.touchStart(viewport, { touches: [{ identifier: 0, clientX: 100, clientY: 300 }] });
    const move = fireEvent.touchMove(viewport, { touches: [{ identifier: 0, clientX: 100, clientY: 120 }] });
    expect(start).toBe(true);
    expect(move).toBe(true);
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


  it('shows an Italian magnifier on the photo corner', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    const enter = screen.getByTestId('inspect-zoom-enter');
    expect(enter).toHaveAttribute('aria-label', 'Ingrandisci immagine');
    expect(screen.getByTestId('inspect-image-viewport').contains(enter)).toBe(true);
    expect(enter.className).toMatch(/absolute/);
  });

  it('enters a full-screen portal overlay and locks page scroll', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(240);
    const { container } = render(<ResultInspectView {...baseProps} lang="it" />);
    fireEvent.click(screen.getByTestId('inspect-zoom-enter'));

    const overlay = screen.getByTestId('inspect-zoom-overlay');
    expect(container.contains(overlay)).toBe(false);
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay).toHaveAttribute('role', 'dialog');
    expect(overlay).toHaveAttribute('aria-modal', 'true');
    expect(overlay.className).toMatch(/fixed/);
    expect(overlay.className).toMatch(/inset-0/);
    expect(screen.getByTestId('inspect-zoom-stage').style.touchAction).toBe('none');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-240px');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.documentElement.getAttribute('data-inspect-zoom-mode')).toBe('true');
    expect(window.history.state?.sgInspectZoom).toBe(true);
    const exit = screen.getByTestId('inspect-zoom-exit');
    expect(exit).toHaveAttribute('aria-label', 'Chiudi ingrandimento');
    expect(document.activeElement).toBe(exit);
  });

  it('pinch and pan inside the overlay change the transform', () => {
    render(<ResultInspectView {...baseProps} />);
    fireEvent.click(screen.getByTestId('inspect-zoom-enter'));
    const stage = screen.getByTestId('inspect-zoom-stage');
    const layer = screen.getByTestId('inspect-zoom-layer');
    pinchOut(stage);
    const scale = Number(stage.getAttribute('data-zoom-scale'));
    expect(scale).toBeGreaterThan(1);
    expect(layer.style.transform).toContain(`scale(${scale}`.slice(0, 8));

    fireEvent.touchStart(stage, { touches: [{ identifier: 0, clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(stage, { touches: [{ identifier: 0, clientX: 160, clientY: 140 }] });
    fireEvent.touchEnd(stage, { touches: [] });
    expect(layer.style.transform).toContain('translate(60px, 40px)');
  });

  it('X exits, restores html/body styles, scroll position, history and focus', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(180);
    const htmlBefore = document.documentElement.style.cssText;
    const bodyBefore = document.body.style.cssText;
    render(<ResultInspectView {...baseProps} lang="it" />);
    const enter = screen.getByTestId('inspect-zoom-enter');
    fireEvent.click(enter);
    pinchOut(screen.getByTestId('inspect-zoom-stage'));

    fireEvent.click(screen.getByTestId('inspect-zoom-exit'));

    expect(screen.queryByTestId('inspect-zoom-overlay')).not.toBeInTheDocument();
    expect(document.documentElement.style.cssText).toBe(htmlBefore);
    expect(document.body.style.cssText).toBe(bodyBefore);
    expect(document.documentElement.hasAttribute('data-inspect-zoom-mode')).toBe(false);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 180);
    expect(historyBack).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(enter);
    expect(screen.getByTestId('inspect-image-viewport').style.touchAction).toBe('pan-y');
  });

  it('Escape exits zoom mode', () => {
    render(<ResultInspectView {...baseProps} />);
    fireEvent.click(screen.getByTestId('inspect-zoom-enter'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('inspect-zoom-overlay')).not.toBeInTheDocument();
    expect(document.body.style.position).toBe('');
    expect(historyBack).toHaveBeenCalledTimes(1);
  });

  it('browser back (popstate) exits without a second history.back', () => {
    render(<ResultInspectView {...baseProps} />);
    fireEvent.click(screen.getByTestId('inspect-zoom-enter'));
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(screen.queryByTestId('inspect-zoom-overlay')).not.toBeInTheDocument();
    expect(document.body.style.position).toBe('');
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('unmounting while zoomed releases the scroll lock', () => {
    const { unmount } = render(<ResultInspectView {...baseProps} />);
    fireEvent.click(screen.getByTestId('inspect-zoom-enter'));
    expect(document.body.style.position).toBe('fixed');
    unmount();
    expect(document.body.style.position).toBe('');
    expect(document.documentElement.hasAttribute('data-inspect-zoom-mode')).toBe(false);
  });

  it('holding the idle photo shows the reference and its status below the image', () => {
    render(<ResultInspectView {...withBaselineUrl} lang="it" />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    fireEvent.touchStart(viewport, { touches: [{ identifier: 0, clientX: 120, clientY: 180 }] });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const img = viewport.querySelector('[data-testid="inspect-comparison-image"]') as HTMLImageElement;
    expect(img.src).toContain('persisted-baseline');
    const hold = screen.getByTestId('inspect-hold-hint');
    expect(hold).toHaveTextContent('Stai vedendo la foto di riferimento');
    expect(viewport.contains(hold)).toBe(false);
    expect(screen.queryByTestId('inspect-hold-graphic')).not.toBeInTheDocument();
    fireEvent.touchEnd(viewport, { touches: [] });
    expect(hold).toHaveTextContent(IT_HINT);
  });

  it('holding inside zoom mode shows the reference at the same zoom', () => {
    render(<ResultInspectView {...withBaselineUrl} lang="it" />);
    fireEvent.click(screen.getByTestId('inspect-zoom-enter'));
    const stage = screen.getByTestId('inspect-zoom-stage');
    pinchOut(stage);
    const scale = stage.getAttribute('data-zoom-scale');
    fireEvent.mouseDown(stage, { clientX: 120, clientY: 180 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const overlay = screen.getByTestId('inspect-zoom-overlay');
    expect(overlay.querySelector('[data-showing-baseline="true"]')).toBeTruthy();
    expect(within(overlay).getByTestId('inspect-zoom-hint')).toHaveTextContent('Stai vedendo la foto di riferimento');
    expect(stage.getAttribute('data-zoom-scale')).toBe(scale);
    fireEvent.mouseUp(stage);
    expect(within(overlay).getByTestId('inspect-zoom-hint')).toHaveTextContent(
      'Pizzica per ingrandire · Tieni premuto per il riferimento',
    );
  });

  it('pressing the magnifier or X never starts a hold', () => {
    render(<ResultInspectView {...withBaselineUrl} lang="it" />);
    const enter = screen.getByTestId('inspect-zoom-enter');
    fireEvent.mouseDown(enter, { clientX: 10, clientY: 10 });
    fireEvent.touchStart(enter, { touches: [{ identifier: 0, clientX: 10, clientY: 10 }] });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(document.querySelector('[data-showing-baseline="true"]')).toBeNull();
    fireEvent.mouseUp(enter);
    fireEvent.click(enter);

    const exit = screen.getByTestId('inspect-zoom-exit');
    fireEvent.mouseDown(exit);
    fireEvent.touchStart(exit, { touches: [{ identifier: 0, clientX: 10, clientY: 10 }] });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(document.querySelector('[data-showing-baseline="true"]')).toBeNull();
  });

  it('does not blink-compare while a pinch finger is still down in zoom mode', () => {
    render(<ResultInspectView {...withBaselineUrl} />);
    fireEvent.click(screen.getByTestId('inspect-zoom-enter'));
    const stage = screen.getByTestId('inspect-zoom-stage');
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
    fireEvent.touchEnd(stage, { touches: [{ identifier: 0, clientX: 100, clientY: 40 }] });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(document.querySelector('[data-showing-baseline="true"]')).toBeNull();
    expect(Number(stage.getAttribute('data-zoom-scale'))).toBeGreaterThan(1);
  });

  it('shows the one-line Italian hint below the photo, not on it', () => {
    render(<ResultInspectView {...baseProps} lang="it" />);
    const viewport = screen.getByTestId('inspect-image-viewport');
    const hold = screen.getByTestId('inspect-hold-hint');
    expect(viewport.contains(hold)).toBe(false);
    expect(hold.getAttribute('data-hold-placement')).toBe('below');
    expect(hold.className).toContain('pointer-events-none');
    expect(hold.querySelector('.inspect-hint-caption')).toHaveTextContent(IT_HINT);
    expect(screen.getByTestId('inspect-hold-graphic')).toBeInTheDocument();
    expect(screen.queryByTestId('inspect-pinch-hint')).not.toBeInTheDocument();
  });

  it('uses one-line zoom+hold copy in English and Chinese', () => {
    const { rerender } = render(<ResultInspectView {...baseProps} lang="en" />);
    expect(screen.getByTestId('inspect-hold-hint')).toHaveTextContent('Tap 🔍 to zoom · Hold to see reference');
    expect(screen.getByTestId('inspect-zoom-enter')).toHaveAttribute('aria-label', 'Zoom image');
    rerender(<ResultInspectView {...baseProps} lang="cn" />);
    expect(screen.getByTestId('inspect-hold-hint')).toHaveTextContent('点 🔍 放大 · 按住显示参考图');
    expect(screen.getByTestId('inspect-zoom-enter')).toHaveAttribute('aria-label', '放大图片');
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
