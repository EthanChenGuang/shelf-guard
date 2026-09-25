import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CameraView } from './CameraView';
import { DEFAULT_CALIBRATION, I18N } from '../lib/constants';

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

describe('CameraView PRD top bar (CAM-04)', () => {
  it('shows baseline established copy when hasPersistedBaseline is true', () => {
    render(
      <CameraView {...baseProps} hasPersistedBaseline={true} lang="cn" />,
    );

    expect(screen.getByTestId('baseline-status-pill')).toHaveTextContent(
      I18N.cn.baselineEstablished,
    );
  });

  it('shows baseline not-set copy when hasPersistedBaseline is false', () => {
    render(
      <CameraView {...baseProps} hasPersistedBaseline={false} lang="cn" />,
    );

    expect(screen.getByTestId('baseline-status-pill')).toHaveTextContent(
      I18N.cn.baselineNotSet,
    );
  });

  it('renders 中 on language toggle when lang is cn', () => {
    render(<CameraView {...baseProps} lang="cn" />);

    expect(screen.getByTestId('language-toggle')).toHaveTextContent('中');
  });

  it('renders EN on language toggle when lang is en', () => {
    render(<CameraView {...baseProps} lang="en" />);

    expect(screen.getByTestId('language-toggle')).toHaveTextContent('EN');
  });
});
