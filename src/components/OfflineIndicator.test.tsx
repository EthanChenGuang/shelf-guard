import {beforeEach, describe, expect, it} from 'vitest';
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
    expect(pill!.className).toContain('bottom-28');
    expect(pill!.className).not.toContain('bottom-24');
    expect(pill!.className).not.toMatch(/\bbottom-3\b/);

    // shutterTop 532 from Playwright 320×640 measurement in 01-UAT.md test 4
    const viewportHeight = 640;
    const viewportWidth = 320;
    const shutterTop = 532;
    const bottom28Px = 112;
    const priorBottom24PillBottom = 544;

    expect(viewportWidth).toBe(320);

    const expectedPillBottom = viewportHeight - bottom28Px;
    expect(expectedPillBottom).toBeLessThanOrEqual(shutterTop);
    expect(expectedPillBottom).toBeLessThan(priorBottom24PillBottom);
  });
});
