import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('ResultInspectView anomaly colors (DSGN-02, D-16)', () => {
  const anomalyProps = {
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
      {
        id: 'moved-1',
        type: 'MOVED' as const,
        title: 'Displaced item',
        score: 0.85,
        boundingBox: { x: 0.5, y: 0.45, width: 0.18, height: 0.1 },
        dismissed: false,
      },
    ],
  };

  it('renders MISSING anomaly box as an sg-danger outline with no fill', () => {
    render(<ResultInspectView {...anomalyProps} />);

    const boxes = document.querySelectorAll('.ar-box');
    const missingBox = boxes[0];

    expect(missingBox.className).toContain('border-sg-danger');
    expect(missingBox.className).not.toMatch(/\bbg-/);
  });

  it('renders MOVED anomaly box as an sg-warning outline with no fill', () => {
    render(<ResultInspectView {...anomalyProps} />);

    const boxes = document.querySelectorAll('.ar-box');
    const movedBox = boxes[1];

    expect(movedBox.className).toContain('border-sg-warning');
    expect(movedBox.className).not.toMatch(/\bbg-/);
  });

  it('uses sg-danger hue on missing stat capsule chip when count > 0', () => {
    render(<ResultInspectView {...anomalyProps} />);

    const missingChip = document.querySelector('.bg-sg-danger\\/10');
    expect(missingChip).toBeTruthy();

    const dot = missingChip?.querySelector('.bg-sg-danger');
    expect(dot).toBeTruthy();
  });
});

describe('ResultInspectView added items and confidence badges', () => {
  const addedProps = {
    ...baseProps,
    missingCount: 0,
    displacedCount: 1,
    addedCount: 1,
    anomalies: [
      {
        id: 'added-1',
        type: 'ADDED' as const,
        title: 'New item',
        score: 0.92,
        boundingBox: { x: 0.1, y: 0.15, width: 0.2, height: 0.12 },
        dismissed: false,
      },
      {
        id: 'moved-1',
        type: 'MOVED' as const,
        title: 'Displaced item',
        score: 0.85,
        displacementNote: 'detected shift',
        boundingBox: { x: 0.5, y: 0.45, width: 0.18, height: 0.1 },
        dismissed: false,
      },
    ],
  };

  it('renders an ADDED box as an sg-scan outline with no fill, plus a confidence label', () => {
    render(<ResultInspectView {...addedProps} />);

    const addedBox = document.querySelectorAll('.ar-box')[0];
    expect(addedBox.className).toContain('border-sg-scan');
    expect(addedBox.className).not.toMatch(/\bbg-/);
    expect(screen.getByText('Added · 92%')).toBeInTheDocument();
  });

  it('shows a localized label and confidence on the MOVED badge instead of the shift note', () => {
    render(<ResultInspectView {...addedProps} />);

    expect(screen.getByText('Moved · 85%')).toBeInTheDocument();
    expect(screen.queryByText(/detected shift/)).not.toBeInTheDocument();
  });

  it('localizes ADDED and MOVED badges in Chinese', () => {
    render(<ResultInspectView {...addedProps} lang="cn" />);

    expect(screen.getByText('新增 · 92%')).toBeInTheDocument();
    expect(screen.getByText('移位 · 85%')).toBeInTheDocument();
    expect(screen.getByText('1 处新增')).toBeInTheDocument();
  });

  it('filters to ADDED boxes with the added chip and back to all on a second click', () => {
    render(<ResultInspectView {...addedProps} />);

    const chip = screen.getByText('1 Added').closest('button')!;
    fireEvent.click(chip);
    const boxes = document.querySelectorAll('.ar-box');
    expect(boxes).toHaveLength(1);
    expect(boxes[0].className).toContain('border-sg-scan');

    fireEvent.click(chip);
    expect(document.querySelectorAll('.ar-box')).toHaveLength(2);
  });

  it('reads Zero Added when nothing was added', () => {
    render(<ResultInspectView {...addedProps} addedCount={0} />);
    expect(screen.getByText('Zero Added')).toBeInTheDocument();
  });

  it('reads 无新增 in Chinese when nothing was added', () => {
    render(<ResultInspectView {...addedProps} addedCount={0} lang="cn" />);
    expect(screen.getByText('无新增')).toBeInTheDocument();
  });
});
