import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraView } from './CameraView';
import { DEFAULT_CALIBRATION } from '../lib/constants';

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
  isUsingDemoFeed: true,
  hasPersistedBaseline: false,
  onToggleDemoMode: vi.fn(),
  isTorchOn: false,
  onToggleTorch: vi.fn(),
  videoRef: { current: null },
  ghostOpacity: 45,
  onGhostOpacityChange: vi.fn(),
};

describe('CameraView orientation banner (CAM-07)', () => {
  it('shows orientationPermissionDenied title and iOS guide when orientationDenied', () => {
    render(
      <CameraView
        {...baseProps}
        orientationDenied
      />,
    );
    expect(screen.getByText('无法访问设备方向传感器')).toBeInTheDocument();
    expect(screen.getByText(/Safari/)).toBeInTheDocument();
    expect(screen.getByText(/运动与方向访问/)).toBeInTheDocument();
  });

  it('fires onRetryOrientation when retry clicked', () => {
    const onRetry = vi.fn();
    render(
      <CameraView
        {...baseProps}
        orientationDenied
        onRetryOrientation={onRetry}
      />,
    );
    fireEvent.click(screen.getByText('重试方向权限'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('fires onDismissOrientationError when dismiss clicked', () => {
    const onDismiss = vi.fn();
    render(
      <CameraView
        {...baseProps}
        orientationDenied
        onDismissOrientationError={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('hides simulate toggle when orientationDenied even if onSimulateTiltToggle provided', () => {
    render(
      <CameraView
        {...baseProps}
        orientationDenied
        hasSensor={false}
        onSimulateTiltToggle={vi.fn()}
      />,
    );
    expect(screen.queryByTitle('Click to toggle level / tilt')).not.toBeInTheDocument();
  });
});
