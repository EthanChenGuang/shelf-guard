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

describe('CameraView quota banner (DATA-04)', () => {
  it('renders quotaExceededTitle and quotaExceededGuide when quotaError is true', () => {
    render(<CameraView {...baseProps} quotaError />);
    expect(screen.getByText('Memoria locale piena')).toBeInTheDocument();
    expect(
      screen.getByText('Completa le ispezioni su altri scaffali o cancella parte dello storico, poi riprova.'),
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
    fireEvent.click(screen.getByLabelText('Chiudi'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
