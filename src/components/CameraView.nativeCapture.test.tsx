import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CameraView} from './CameraView';
import {DEFAULT_CALIBRATION, I18N} from '../lib/constants';

const baseProps = {
  baseline: DEFAULT_CALIBRATION,
  lang: 'it' as const,
  onLanguageToggle: vi.fn(),
  onOpenHistory: vi.fn(),
  onResetBaselinePrompt: vi.fn(),
  tilt: 0,
  isLevel: true,
  isTorchOn: false,
  onToggleTorch: vi.fn(),
  videoRef: {current: null},
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
    expect(screen.getByText(I18N.it.tapShutterToScan)).toBeInTheDocument();
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

  it('offers a photo-library picker for the inspection shot once a baseline exists', () => {
    const onPickPhoto = vi.fn();
    render(<CameraView {...baseProps} onShutterClick={vi.fn()} hasPersistedBaseline onPickPhoto={onPickPhoto} />);
    const input = screen.getByTestId('gallery-input');
    expect(input).not.toHaveAttribute('capture');
    expect(screen.getByRole('button', {name: I18N.it.pickFromGallery})).toBeInTheDocument();
    const file = new File(['x'], 'library.jpg', {type: 'image/jpeg'});
    fireEvent.change(input, {target: {files: [file]}});
    expect(onPickPhoto).toHaveBeenCalledWith(file);
  });

  it('hides the photo-library picker before a baseline exists', () => {
    render(<CameraView {...baseProps} onShutterClick={vi.fn()} onPickPhoto={vi.fn()} />);
    expect(screen.queryByTestId('gallery-input')).toBeNull();
  });

  it('shows a lens switch only when the browser exposes several back lenses', () => {
    const onCycleLens = vi.fn();
    const {rerender} = render(
      <CameraView {...baseProps} onShutterClick={vi.fn()} lens={{index: 1, count: 3}} onCycleLens={onCycleLens} />,
    );
    fireEvent.click(screen.getByRole('button', {name: I18N.it.switchLens}));
    expect(onCycleLens).toHaveBeenCalledOnce();
    expect(screen.getByTestId('cycle-lens-button')).toHaveTextContent('1/3');
    rerender(<CameraView {...baseProps} onShutterClick={vi.fn()} lens={{index: 1, count: 1}} onCycleLens={onCycleLens} />);
    expect(screen.queryByTestId('cycle-lens-button')).toBeNull();
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
        analysisErrorMessage={I18N.it.framingMismatch}
      />,
    );
    expect(screen.getByText(I18N.it.framingMismatch)).toBeInTheDocument();
  });
});
