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

describe('ResultInspectView comparison fullscreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
