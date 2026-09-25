import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CameraView} from './CameraView';
import {DEFAULT_CALIBRATION} from '../lib/constants';

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
  videoRef: {current: null},
  ghostOpacity: 45,
  onGhostOpacityChange: vi.fn(),
};

describe('CameraView quota banner (DATA-04)', () => {
  it('renders quotaExceededTitle and quotaExceededGuide when quotaError is true', () => {
    render(<CameraView {...baseProps} quotaError />);
    expect(screen.getByText('本地存储空间已满')).toBeInTheDocument();
    expect(
      screen.getByText('请先在其它货架完成巡检，或清除部分历史记录后再试。'),
    ).toBeInTheDocument();
  });

  it('fires onDismissQuotaError when dismiss clicked', () => {
    const onDismiss = vi.fn();
    render(
      <CameraView
        {...baseProps}
        quotaError
        onDismissQuotaError={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
