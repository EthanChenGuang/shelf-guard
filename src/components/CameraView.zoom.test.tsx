import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { CameraView } from './CameraView';
import { DEFAULT_CALIBRATION } from '../lib/constants';

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

describe('CameraView zoom row (GDB-260925-4)', () => {
  it('renders no zoom row when hasZoom is false', () => {
    render(<CameraView {...baseProps} hasZoom={false} />);

    expect(screen.queryByTestId('zoom-level-row')).toBeNull();
  });

  it('renders no zoom row when hasZoom prop is omitted', () => {
    render(<CameraView {...baseProps} />);

    expect(screen.queryByTestId('zoom-level-row')).toBeNull();
  });

  it('renders exactly 4 buttons with correct labels and highlights the active preset', () => {
    render(
      <CameraView
        {...baseProps}
        hasZoom={true}
        zoomLevels={[1, 2, 3, 4]}
        currentZoom={1}
      />,
    );

    const row = screen.getByTestId('zoom-level-row');
    const buttons = within(row).getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(buttons.map((b) => b.textContent)).toEqual(['1.0×', '2.0×', '3.0×', '4.0×']);

    const active = buttons.find((b) => b.textContent === '1.0×');
    const inactive = buttons.filter((b) => b.textContent !== '1.0×');
    expect(active?.className).toContain('bg-sg-success');
    inactive.forEach((b) => {
      expect(b.className).not.toContain('bg-sg-success');
    });
  });

  it('calls onZoomLevelChange with the clicked value', () => {
    const onZoomLevelChange = vi.fn();
    render(
      <CameraView
        {...baseProps}
        hasZoom={true}
        zoomLevels={[1, 2, 3, 4]}
        currentZoom={1}
        onZoomLevelChange={onZoomLevelChange}
      />,
    );

    const row = screen.getByTestId('zoom-level-row');
    const target = within(row).getAllByRole('button').find((b) => b.textContent === '3.0×');
    fireEvent.click(target!);

    expect(onZoomLevelChange).toHaveBeenCalledWith(3);
  });
});
