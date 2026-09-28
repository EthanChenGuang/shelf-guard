import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CameraView} from './CameraView';
import {DEFAULT_CALIBRATION, I18N} from '../lib/constants';

const baseProps = {
  baseline: DEFAULT_CALIBRATION,
  lang: 'cn' as const,
  onLanguageToggle: vi.fn(),
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

describe('CameraView native capture mode', () => {
  it('shutter opens the OS camera input instead of grabbing a live frame', () => {
    const onShutterClick = vi.fn();
    render(
      <CameraView {...baseProps} onShutterClick={onShutterClick} nativeCaptureMode onNativePhoto={vi.fn()} />,
    );
    const input = screen.getByTestId('native-capture-input') as HTMLInputElement;
    expect(input.getAttribute('capture')).toBe('environment');
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.click(document.getElementById('shutter-trigger')!);

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(onShutterClick).not.toHaveBeenCalled();
    expect(screen.getByText(I18N.cn.nativeCaptureHint)).toBeInTheDocument();
  });

  it('forwards the chosen photo to onNativePhoto', () => {
    const onNativePhoto = vi.fn();
    render(
      <CameraView {...baseProps} onShutterClick={vi.fn()} nativeCaptureMode onNativePhoto={onNativePhoto} />,
    );
    const file = new File(['x'], 'shot.jpg', {type: 'image/jpeg'});
    fireEvent.change(screen.getByTestId('native-capture-input'), {target: {files: [file]}});
    expect(onNativePhoto).toHaveBeenCalledWith(file);
  });

  it('keeps the live shutter when not in native mode', () => {
    const onShutterClick = vi.fn();
    render(<CameraView {...baseProps} onShutterClick={onShutterClick} />);
    expect(screen.queryByTestId('native-capture-input')).toBeNull();
    fireEvent.click(document.getElementById('shutter-trigger')!);
    expect(onShutterClick).toHaveBeenCalledOnce();
  });

  it('shows the framing-mismatch message when provided', () => {
    render(
      <CameraView
        {...baseProps}
        onShutterClick={vi.fn()}
        analysisError
        analysisErrorMessage={I18N.cn.framingMismatch}
      />,
    );
    expect(screen.getByText(I18N.cn.framingMismatch)).toBeInTheDocument();
  });
});
