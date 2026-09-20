import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, act} from '@testing-library/react';
import {OfflineIndicator} from './OfflineIndicator';

describe('OfflineIndicator (PWA-03)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  it('renders null when navigator.onLine is true', () => {
    const {container} = render(<OfflineIndicator lang="cn" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders offlineMode I18N text when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', {value: false, configurable: true});
    render(<OfflineIndicator lang="cn" />);
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('离线模式 · 本地缓存已就绪')).toBeInTheDocument();
  });

  it('positions pill above shutter band at 320px viewport (G-01-4)', async () => {
    Object.defineProperty(navigator, 'onLine', {value: false, configurable: true});
    Object.defineProperty(window, 'innerWidth', {value: 320, configurable: true});
    Object.defineProperty(window, 'innerHeight', {value: 640, configurable: true});

    render(<OfflineIndicator lang="cn" />);
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    const pill = screen.getByText('离线模式 · 本地缓存已就绪').closest('div');
    expect(pill).not.toBeNull();
    expect(pill!.className).toContain('bottom-24');
    expect(pill!.className).not.toMatch(/\bbottom-3\b/);

    const viewportHeight = 640;
    const bottom24Px = 96;
    const bottom3Px = 12;
    const shutterBandBottom = 608;
    const pillHeight = 28;

    const pillBottom = viewportHeight - bottom24Px;
    const pillTop = pillBottom - pillHeight;
    const preFixPillBottom = viewportHeight - bottom3Px;

    vi.spyOn(pill!, 'getBoundingClientRect').mockReturnValue({
      bottom: pillBottom,
      top: pillTop,
      left: 16,
      right: 200,
      width: 184,
      height: pillHeight,
      x: 16,
      y: pillTop,
      toJSON: () => ({}),
    } as DOMRect);

    const pillRect = pill!.getBoundingClientRect();
    expect(pillRect.bottom).toBeLessThanOrEqual(shutterBandBottom);
    expect(pillRect.bottom).toBeLessThan(preFixPillBottom);
    expect(pillRect.top).toBeLessThan(shutterBandBottom);
  });
});
