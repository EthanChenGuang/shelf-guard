import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CameraView } from './CameraView';
import { DEFAULT_CALIBRATION, I18N } from '../lib/constants';

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

describe('CameraView PRD top bar (CAM-04)', () => {
  it('shows baseline established copy when hasPersistedBaseline is true', () => {
    render(
      <CameraView {...baseProps} hasPersistedBaseline={true} lang="it" />,
    );

    expect(screen.getByTestId('baseline-status-pill')).toHaveTextContent(
      I18N.it.baselineEstablished,
    );
  });

  it('shows baseline not-set copy when hasPersistedBaseline is false', () => {
    render(
      <CameraView {...baseProps} hasPersistedBaseline={false} lang="it" />,
    );

    expect(screen.getByTestId('baseline-status-pill')).toHaveTextContent(
      I18N.it.baselineNotSet,
    );
  });

  it('renders IT on language toggle when lang is it', () => {
    render(<CameraView {...baseProps} lang="it" />);

    expect(screen.getByTestId('language-toggle')).toHaveTextContent('IT');
  });

  it('renders EN on language toggle when lang is en', () => {
    render(<CameraView {...baseProps} lang="en" />);

    expect(screen.getByTestId('language-toggle')).toHaveTextContent('EN');
  });
});

describe('CameraView last-audit thumbnail', () => {
  it('shows an icon instead of a broken image and no time before any audit or baseline', () => {
    render(<CameraView {...baseProps} />);

    const thumb = screen.getByTestId('last-inspection-thumbnail');
    expect(thumb.querySelector('img')).toBeNull();
    expect(thumb.parentElement).not.toHaveTextContent(/\d{1,2}:\d{2}/);
  });

  it('shows the baseline photo when there is a baseline but no audit yet', () => {
    render(<CameraView {...baseProps} baseline={{ ...DEFAULT_CALIBRATION, imageDataUrl: 'blob:baseline' }} />);

    expect(screen.getByAltText(I18N.it.auditThumbnailAlt)).toHaveAttribute('src', 'blob:baseline');
  });
});

describe('CameraView full screen toggle', () => {
  afterEach(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: undefined });
  });

  it('is hidden where the page cannot go full screen', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
    render(<CameraView {...baseProps} />);

    expect(screen.queryByTestId('fullscreen-toggle')).not.toBeInTheDocument();
  });

  it('requests full screen for the whole page', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    const request = vi.fn(async () => {});
    document.documentElement.requestFullscreen = request;
    render(<CameraView {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: I18N.it.enterFullscreen }));
    expect(request).toHaveBeenCalledTimes(1);
  });
});
