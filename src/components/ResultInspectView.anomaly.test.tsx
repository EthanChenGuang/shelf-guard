import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ResultInspectView } from './ResultInspectView';
import { DEFAULT_CALIBRATION } from '../lib/constants';

const baseProps = {
  currentCaptureUrl: 'data:image/jpeg;base64,capture',
  baseline: DEFAULT_CALIBRATION,
  complianceRate: 88,
  standardCount: 24,
  actualCount: 22,
  displacedCount: 1,
  missingCount: 1,
  tolerance: 50,
  onToleranceChange: vi.fn(),
  onDismissAnomaly: vi.fn(),
  onCompleteAudit: vi.fn(),
  onBackToCamera: vi.fn(),
  lang: 'en' as const,
};

describe('ResultInspectView anomaly colors (DSGN-02, D-16)', () => {
  const anomalyProps = {
    ...baseProps,
    anomalies: [
      {
        id: 'missing-1',
        rowIndex: 0 as const,
        type: 'MISSING' as const,
        title: 'Missing SKU',
        score: 0.92,
        boundingBox: { x: 0.1, y: 0.15, width: 0.2, height: 0.12 },
        dismissed: false,
      },
      {
        id: 'moved-1',
        rowIndex: 1 as const,
        type: 'MOVED' as const,
        title: 'Displaced item',
        score: 0.85,
        boundingBox: { x: 0.5, y: 0.45, width: 0.18, height: 0.1 },
        dismissed: false,
      },
    ],
  };

  it('renders MISSING anomaly box with sg-danger border and fill classes', () => {
    render(<ResultInspectView {...anomalyProps} />);

    const boxes = document.querySelectorAll('.ar-box');
    const missingBox = boxes[0];

    expect(missingBox.className).toContain('border-sg-danger');
    expect(missingBox.className).toContain('bg-sg-danger/15');
  });

  it('renders MOVED anomaly box with sg-warning border and fill classes', () => {
    render(<ResultInspectView {...anomalyProps} />);

    const boxes = document.querySelectorAll('.ar-box');
    const movedBox = boxes[1];

    expect(movedBox.className).toContain('border-sg-warning');
    expect(movedBox.className).toContain('bg-sg-warning/15');
  });

  it('uses sg-danger hue on missing stat capsule chip when count > 0', () => {
    render(<ResultInspectView {...anomalyProps} />);

    const missingChip = document.querySelector('.bg-sg-danger\\/10');
    expect(missingChip).toBeTruthy();

    const dot = missingChip?.querySelector('.bg-sg-danger');
    expect(dot).toBeTruthy();
  });
});
