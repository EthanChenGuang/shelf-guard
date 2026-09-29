import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CameraView} from './CameraView';
import {DEFAULT_CALIBRATION} from '../lib/constants';

const baseProps = {
  baseline: DEFAULT_CALIBRATION,
  lang: 'it' as const,
  onLanguageToggle: vi.fn(),
  onShutterClick: vi.fn(),
  onOpenHistory: vi.fn(),
  onResetBaselinePrompt: vi.fn(),
  tilt: 0,
  isLevel: true,
  isTorchOn: false,
  onToggleTorch: vi.fn(),
  videoRef: {current: null},
};

describe('CameraView error banner (CAM-08)', () => {
  it('renders cameraPermissionDenied and cameraErrorIosGuide when cameraError set', () => {
    render(
      <CameraView
        {...baseProps}
        cameraError="Permission denied by user"
      />,
    );
    expect(screen.getByText('Accesso alla fotocamera negato')).toBeInTheDocument();
    expect(screen.getByText(/Safari/)).toBeInTheDocument();
    expect(screen.getByText('Permission denied by user')).toBeInTheDocument();
  });

  it('fires onDismissCameraError when dismiss clicked', () => {
    const onDismiss = vi.fn();
    render(
      <CameraView
        {...baseProps}
        cameraError="Error"
        onDismissCameraError={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText('Chiudi'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('fires onRetryCamera when retry clicked', () => {
    const onRetry = vi.fn();
    render(
      <CameraView
        {...baseProps}
        cameraError="Error"
        onRetryCamera={onRetry}
      />,
    );
    fireEvent.click(screen.getByText('Riprova fotocamera'));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
