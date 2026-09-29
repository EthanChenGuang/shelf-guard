import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  isTorchOn: false,
  onToggleTorch: vi.fn(),
  videoRef: { current: null },
};

function makePointerEvent(type: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}

function tapAt(el: HTMLElement, startX: number, startY: number, endX: number, endY: number) {
  el.dispatchEvent(makePointerEvent('pointerdown', startX, startY));
  el.dispatchEvent(makePointerEvent('pointerup', endX, endY));
}

describe('CameraView tap-to-focus (quick-260925-r3s)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders no reticle when hasFocus is false', () => {
    render(
      <CameraView {...baseProps} hasFocus={false} focusPoint={{ x: 0.5, y: 0.5 }} />,
    );

    expect(screen.queryByTestId('focus-reticle')).toBeNull();
  });

  it('renders a reticle positioned at focusPoint percentage when hasFocus is true', () => {
    render(
      <CameraView
        {...baseProps}
        hasFocus={true}
        focusPoint={{ x: 0.25, y: 0.75 }}
      />,
    );

    const reticle = screen.getByTestId('focus-reticle');
    expect(reticle.style.left).toBe('25%');
    expect(reticle.style.top).toBe('75%');
  });

  it('a still tap forwards normalized coordinates via onFocusPointChange', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 800,
      right: 400,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const onFocusPointChange = vi.fn();
    render(
      <CameraView {...baseProps} hasFocus={true} onFocusPointChange={onFocusPointChange} />,
    );

    const layer = screen.getByTestId('shelf-swipe-layer');
    tapAt(layer, 100, 200, 100, 200);

    expect(onFocusPointChange).toHaveBeenCalledWith(0.25, 0.25);
  });

  it('a large drag does not forward a focus point', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 800,
      right: 400,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const onFocusPointChange = vi.fn();
    render(
      <CameraView {...baseProps} hasFocus={true} onFocusPointChange={onFocusPointChange} />,
    );

    const layer = screen.getByTestId('shelf-swipe-layer');
    tapAt(layer, 100, 200, 250, 200);

    expect(onFocusPointChange).not.toHaveBeenCalled();
  });

  it('a tap does nothing when hasFocus is false', () => {
    const onFocusPointChange = vi.fn();
    render(
      <CameraView {...baseProps} hasFocus={false} onFocusPointChange={onFocusPointChange} />,
    );

    const layer = screen.getByTestId('shelf-swipe-layer');
    tapAt(layer, 100, 200, 100, 200);

    expect(onFocusPointChange).not.toHaveBeenCalled();
  });
});
