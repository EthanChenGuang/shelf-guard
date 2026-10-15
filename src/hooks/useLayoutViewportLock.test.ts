import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLayoutViewportLock } from './useLayoutViewportLock';

describe('useLayoutViewportLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('snaps a leftover horizontal offset on orientationchange without touching vertical scroll', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const scrollX = vi.spyOn(window, 'scrollX', 'get').mockReturnValue(0);

    renderHook(() => useLayoutViewportLock());
    expect(scrollTo).not.toHaveBeenCalled();

    scrollX.mockReturnValue(48);
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(scrollTo).toHaveBeenCalled();
    for (const call of scrollTo.mock.calls) {
      expect(call).toEqual([{ left: 0 }]);
    }
  });

  it('does nothing on orientationchange when there is no horizontal offset', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.spyOn(window, 'scrollX', 'get').mockReturnValue(0);

    renderHook(() => useLayoutViewportLock());
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('never scrolls on resize (mobile toolbars collapsing mid-scroll) even with a horizontal offset', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const scrollX = vi.spyOn(window, 'scrollX', 'get').mockReturnValue(0);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(420);

    renderHook(() => useLayoutViewportLock());
    scrollX.mockReturnValue(12);
    act(() => {
      window.dispatchEvent(new Event('resize'));
      window.visualViewport?.dispatchEvent(new Event('resize'));
      window.visualViewport?.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('registers no document touch listeners and leaves html/body overflow to CSS', () => {
    const add = vi.spyOn(document, 'addEventListener');

    renderHook(() => useLayoutViewportLock());

    const types = add.mock.calls.map((c) => c[0]);
    expect(types).not.toContain('touchstart');
    expect(types).not.toContain('touchmove');
    expect(types).toContain('gesturestart');
    expect(document.documentElement.style.overflowX).toBe('');
    expect(document.body.style.overflowX).toBe('');
  });
});
