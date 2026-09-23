import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  isUsingDemoFeed: true,
  onToggleDemoMode: vi.fn(),
  isTorchOn: false,
  onToggleTorch: vi.fn(),
  videoRef: { current: null },
  ghostOpacity: 45,
  onGhostOpacityChange: vi.fn(),
};

describe('CameraView ghost visibility (CAM-02)', () => {
  it('demo feed + hasPersistedBaseline true hides ghost overlay and slider', () => {
    render(
      <CameraView
        {...baseProps}
        baseline={persistedBaseline}
        isUsingDemoFeed={true}
        hasPersistedBaseline={true}
      />,
    );

    expect(screen.queryByTestId('ghost-overlay')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('幽灵图透光率')).not.toBeInTheDocument();
  });

  it('live feed + hasPersistedBaseline false hides ghost overlay and slider', () => {
    render(
      <CameraView
        {...baseProps}
        isUsingDemoFeed={false}
        hasPersistedBaseline={false}
      />,
    );

    expect(screen.queryByTestId('ghost-overlay')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('幽灵图透光率')).not.toBeInTheDocument();
  });

  it('live feed + hasPersistedBaseline true shows ghost overlay and slider', () => {
    render(
      <CameraView
        {...baseProps}
        baseline={persistedBaseline}
        isUsingDemoFeed={false}
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
        isUsingDemoFeed={true}
        hasPersistedBaseline={false}
      />,
    );

    expect(screen.queryByAltText(I18N.cn.baselineGhostAlt)).not.toBeInTheDocument();
  });
});
