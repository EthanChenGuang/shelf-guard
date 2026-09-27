import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CameraView } from './CameraView';
import { DEFAULT_CALIBRATION, I18N } from '../lib/constants';

const persistedBaseline = {
  ...DEFAULT_CALIBRATION,
  id: 'baseline-shelf-0',
  imageDataUrl: 'blob:https://example.com/persisted-baseline',
};

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

describe('CameraView ghost visibility (CAM-02)', () => {
  it('hasPersistedBaseline false hides ghost overlay and slider', () => {
    render(
      <CameraView
        {...baseProps}
        hasPersistedBaseline={false}
      />,
    );

    expect(screen.queryByTestId('ghost-overlay')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('幽灵图透光率')).not.toBeInTheDocument();
  });

  it('hasPersistedBaseline true shows ghost overlay and slider', () => {
    render(
      <CameraView
        {...baseProps}
        baseline={persistedBaseline}
        hasPersistedBaseline={true}
      />,
    );

    expect(screen.getByTestId('ghost-overlay')).toBeInTheDocument();
    expect(screen.getByLabelText('幽灵图透光率')).toBeInTheDocument();
    const ghostImg = screen.getByAltText(I18N.cn.baselineGhostAlt);
    expect(ghostImg).toHaveAttribute('src', persistedBaseline.imageDataUrl);
  });

  it('does not render ghost alt text when ghost is hidden', () => {
    render(
      <CameraView
        {...baseProps}
        hasPersistedBaseline={false}
      />,
    );

    expect(screen.queryByAltText(I18N.cn.baselineGhostAlt)).not.toBeInTheDocument();
  });

  it('vertical pointer drag on the wide track updates opacity', () => {
    const onGhostOpacityChange = vi.fn();
    render(
      <CameraView
        {...baseProps}
        baseline={persistedBaseline}
        hasPersistedBaseline={true}
        onGhostOpacityChange={onGhostOpacityChange}
      />,
    );

    const slider = screen.getByRole('slider', { name: '幽灵图透光率' });
    const box = slider.getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(0);
    slider.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 100,
        top: 100,
        left: 0,
        bottom: 300,
        right: 48,
        width: 48,
        height: 200,
        toJSON() {
          return {};
        },
      }) as DOMRect;

    fireEvent.pointerDown(slider, { clientY: 120, pointerId: 1 });
    expect(onGhostOpacityChange).toHaveBeenCalledWith(90);

    fireEvent.pointerMove(slider, { clientY: 280, pointerId: 1 });
    expect(onGhostOpacityChange).toHaveBeenLastCalledWith(10);
  });
});
