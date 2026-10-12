import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLayoutViewportLock } from './useLayoutViewportLock';

describe('useLayoutViewportLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.style.overflowX = '';
    document.body.style.overflowX = '';
    document.documentElement.scrollLeft = 24;
    document.body.scrollLeft = 24;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('snaps scroll to 0 and hides overflow-x on mount and orientationchange', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    renderHook(() => useLayoutViewportLock());

    expect(document.documentElement.style.overflowX).toBe('hidden');
    expect(document.body.style.overflowX).toBe('hidden');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    scrollTo.mockClear();
    document.documentElement.scrollLeft = 48;

    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(document.documentElement.style.overflowX).toBe('hidden');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.documentElement.scrollLeft).toBe(0);
    expect(document.body.scrollLeft).toBe(0);
  });
});
