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
});
