import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraView } from './CameraView';
import { DEFAULT_CALIBRATION, I18N } from '../lib/constants';

const baseProps = {
  baseline: DEFAULT_CALIBRATION,
  lang: 'cn' as const,
  onLanguageToggle: vi.fn(),
  onShutterClick: vi.fn(),
  onOpenRoiConfig: vi.fn(),
  onOpenHistory: vi.fn(),
  onResetBaselinePrompt: vi.fn(),
  tilt: 0,
  isLevel: true,
  isTorchOn: false,
  onToggleTorch: vi.fn(),
  videoRef: { current: null },
  ghostOpacity: 45,
  onGhostOpacityChange: vi.fn(),
};

describe('CameraView ROI guides default (quick-260925 hide-roi-guides-by-default)', () => {
  it('does not render the ROI grid overlay by default', () => {
    render(<CameraView {...baseProps} />);

    expect(screen.queryByText(I18N.cn.roiZone)).not.toBeInTheDocument();
  });

  it('shows the ROI grid overlay after toggling the grid button on', () => {
    render(<CameraView {...baseProps} />);

    fireEvent.click(screen.getByTitle(I18N.cn.toggleRoiGrid));

    expect(screen.getByText(I18N.cn.roiZone)).toBeInTheDocument();
  });
});
