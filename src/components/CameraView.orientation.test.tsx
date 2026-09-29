import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraView } from './CameraView';
import { DEFAULT_CALIBRATION } from '../lib/constants';

const baseProps = {
  baseline: DEFAULT_CALIBRATION,
  lang: 'it' as const,
  onLanguageToggle: vi.fn(),
  onShutterClick: vi.fn(),
  onOpenHistory: vi.fn(),
  onResetBaselinePrompt: vi.fn(),
  tilt: 0,
  isLevel: true,
  hasPersistedBaseline: false,
  isTorchOn: false,
  onToggleTorch: vi.fn(),
  videoRef: { current: null },
};

describe('CameraView orientation banner (CAM-07)', () => {
  it('shows orientationPermissionDenied title and iOS guide when orientationDenied', () => {
    render(
      <CameraView
        {...baseProps}
        orientationDenied
      />,
    );
    expect(screen.getByText('Accesso al sensore di orientamento negato')).toBeInTheDocument();
    expect(screen.getByText(/Safari/)).toBeInTheDocument();
    expect(screen.getByText(/movimento e orientamento/)).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Riprova sensore'));
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
    fireEvent.click(screen.getByLabelText('Chiudi'));
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
