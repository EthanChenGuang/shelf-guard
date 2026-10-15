import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ResultInspectView } from './ResultInspectView';
import { DEFAULT_CALIBRATION, I18N } from '../lib/constants';

const baselineWithImage = {
  ...DEFAULT_CALIBRATION,
  imageDataUrl: 'blob:https://example.com/persisted-baseline',
};

const baseProps = {
  currentCaptureUrl: 'data:image/jpeg;base64,capture',
  baseline: baselineWithImage,
  anomalies: [],
  complianceRate: 94,
  standardCount: 24,
  actualCount: 23,
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

describe('ResultInspectView tolerance slider (RSLT-05, D-11–D-14)', () => {
  it('renders continuous range slider instead of discrete tolerance buttons', () => {
    render(<ResultInspectView {...baseProps} />);

    expect(screen.getByRole('slider', { name: I18N.en.toleranceSensitivity })).toBeInTheDocument();
    expect(screen.queryByText('High (Strict)')).not.toBeInTheDocument();
    expect(screen.queryByText('Medium (Normal)')).not.toBeInTheDocument();
    expect(screen.queryByText('Low (Loose)')).not.toBeInTheDocument();
  });

  it('shows preset tick labels at 25, 50, and 75', () => {
    render(<ResultInspectView {...baseProps} />);

    expect(screen.getByText('Strict (25)')).toBeInTheDocument();
    expect(screen.getByText('Normal (50)')).toBeInTheDocument();
    expect(screen.getByText('Loose (75)')).toBeInTheDocument();
  });

  it('calls onToleranceChange with numeric value on slider change', () => {
    const onToleranceChange = vi.fn();
    render(<ResultInspectView {...baseProps} onToleranceChange={onToleranceChange} />);

    fireEvent.change(screen.getByRole('slider', { name: I18N.en.toleranceSensitivity }), { target: { value: '75' } });

    expect(onToleranceChange).toHaveBeenCalledWith(75);
  });
});

describe('ResultInspectView blink compare (RSLT-02, D-24)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const anomalyProps = {
    ...baseProps,
    anomalies: [
      {
        id: 'a1',
        type: 'MISSING' as const,
        title: 'Tier 1 missing',
        score: 0.9,
        boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
        dismissed: false,
      },
    ],
  };

  it('swaps to baseline image and hides AR boxes on press, restores on release', () => {
    render(<ResultInspectView {...anomalyProps} />);

    const viewport = screen.getByTestId('inspect-image-viewport');
    const canvas = screen.getByAltText('Shelf Inspection Display').closest('div')!;
    const img = screen.getByAltText('Shelf Inspection Display') as HTMLImageElement;

    expect(img.src).toContain('capture');
    expect(document.querySelector('.ar-box')).toBeTruthy();

    fireEvent.mouseDown(viewport);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(img.src).toContain('persisted-baseline');
    expect(document.querySelector('.ar-box')).toBeNull();
    expect(canvas.contains(screen.getByText('Showing the baseline photo'))).toBe(false);

    fireEvent.mouseUp(viewport);
    expect(img.src).toContain('capture');
    expect(document.querySelector('.ar-box')).toBeTruthy();
    expect(canvas.contains(screen.getByText('Tap 🔍 to zoom · Hold to see reference'))).toBe(false);
  });

  it('handles touch press and release for blink compare', () => {
    render(<ResultInspectView {...anomalyProps} />);

    const viewport = screen.getByTestId('inspect-image-viewport');
    const img = screen.getByAltText('Shelf Inspection Display') as HTMLImageElement;

    fireEvent.touchStart(viewport);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(img.src).toContain('persisted-baseline');

    fireEvent.touchEnd(viewport);
    expect(img.src).toContain('capture');
  });

  it('keeps the browser image menu from hijacking the long-press', () => {
    render(<ResultInspectView {...anomalyProps} />);

    const viewport = screen.getByTestId('inspect-image-viewport');
    const canvas = screen.getByAltText('Shelf Inspection Display').closest('div')!;
    const img = screen.getByAltText('Shelf Inspection Display') as HTMLImageElement;

    expect(fireEvent.contextMenu(img)).toBe(false);
    expect(fireEvent.contextMenu(canvas)).toBe(false);
    expect(img).toHaveClass('pointer-events-none');
    expect(img.draggable).toBe(false);
    expect(canvas).toHaveClass('[-webkit-touch-callout:none]');

    fireEvent.touchStart(viewport);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(fireEvent.contextMenu(canvas)).toBe(false);
    expect(img.src).toContain('persisted-baseline');
    fireEvent.touchEnd(viewport);
    expect(img.src).toContain('capture');
  });
});
