import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraView } from './CameraView';
import { DEFAULT_CALIBRATION } from '../lib/constants';

const baseProps = {
  baseline: DEFAULT_CALIBRATION,
  lang: 'cn' as const,
  onLanguageToggle: vi.fn(),
  onShutterClick: vi.fn(),
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

describe('CameraView switch-camera control (quick-260925 wide-angle lens switching)', () => {
  it('renders no switch-camera button when hasMultipleCameras is false', () => {
    render(<CameraView {...baseProps} hasMultipleCameras={false} />);

    expect(screen.queryByTestId('switch-camera-button')).toBeNull();
  });

  it('renders no switch-camera button when the prop is omitted', () => {
    render(<CameraView {...baseProps} />);

    expect(screen.queryByTestId('switch-camera-button')).toBeNull();
  });

  it('renders the switch-camera button when hasMultipleCameras is true', () => {
    render(<CameraView {...baseProps} hasMultipleCameras={true} onSwitchCamera={vi.fn()} />);

    expect(screen.getByTestId('switch-camera-button')).toBeInTheDocument();
  });

  it('calls onSwitchCamera when clicked', () => {
    const onSwitchCamera = vi.fn();
    render(
      <CameraView {...baseProps} hasMultipleCameras={true} onSwitchCamera={onSwitchCamera} />,
    );

    fireEvent.click(screen.getByTestId('switch-camera-button'));

    expect(onSwitchCamera).toHaveBeenCalledTimes(1);
  });
});
