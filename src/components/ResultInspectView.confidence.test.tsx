import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResultInspectView } from './ResultInspectView';
import { DEFAULT_CALIBRATION, I18N } from '../lib/constants';

const anomalies = [
  {
    id: 'weak',
    type: 'MISSING' as const,
    title: 'Faint shadow',
    score: 0.6,
    boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
    dismissed: false,
  },
  {
    id: 'strong',
    type: 'MISSING' as const,
    title: 'Removed product',
    score: 0.9,
    boundingBox: { x: 0.5, y: 0.5, width: 0.2, height: 0.1 },
    dismissed: false,
  },
];

const baseProps = {
  currentCaptureUrl: 'data:image/jpeg;base64,capture',
  baseline: DEFAULT_CALIBRATION,
  anomalies,
  complianceRate: 96,
  standardCount: 24,
  actualCount: 23,
  displacedCount: 0,
  missingCount: 1,
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

describe('ResultInspectView confidence threshold', () => {
  it('hides differences below the threshold and shows those above it', () => {
    render(<ResultInspectView {...baseProps} />);

    expect(document.querySelectorAll('.ar-box')).toHaveLength(1);
    expect(screen.queryByTitle('Faint shadow')).toBeNull();
    expect(screen.getByTitle('Removed product')).toBeInTheDocument();
  });

  it('shows the weaker difference once the threshold is lowered', () => {
    const { rerender } = render(<ResultInspectView {...baseProps} />);
    rerender(<ResultInspectView {...baseProps} minConfidence={50} />);

    expect(document.querySelectorAll('.ar-box')).toHaveLength(2);
    expect(screen.getByTitle('Faint shadow')).toBeInTheDocument();
  });

  it('renders a 50–99 slider with the current value', () => {
    render(<ResultInspectView {...baseProps} />);

    const slider = screen.getByRole('slider', { name: I18N.en.confidenceThreshold });
    expect(slider).toHaveAttribute('min', '50');
    expect(slider).toHaveAttribute('max', '99');
    expect(slider).toHaveAttribute('step', '1');
    expect(slider).toHaveValue('85');
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('reports a numeric threshold when the slider moves', () => {
    const onMinConfidenceChange = vi.fn();
    render(<ResultInspectView {...baseProps} onMinConfidenceChange={onMinConfidenceChange} />);

    fireEvent.change(screen.getByRole('slider', { name: I18N.en.confidenceThreshold }), {
      target: { value: '70' },
    });

    expect(onMinConfidenceChange).toHaveBeenCalledWith(70);
  });

  it('labels the slider in Chinese', () => {
    render(<ResultInspectView {...baseProps} lang="cn" />);

    expect(screen.getByRole('slider', { name: I18N.cn.confidenceThreshold })).toBeInTheDocument();
    expect(screen.getByText(I18N.cn.confidenceThresholdHint)).toBeInTheDocument();
  });
});
