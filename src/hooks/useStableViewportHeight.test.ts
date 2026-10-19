import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStableViewportHeight } from './useStableViewportHeight';

const vh = () => document.documentElement.style.getPropertyValue('--inspect-vh');

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function resize(width: number, height: number) {
  setViewport(width, height);
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

describe('useStableViewportHeight', () => {
  let orientation: EventTarget;
  const initial = { width: window.innerWidth, height: window.innerHeight };

  beforeEach(() => {
    vi.useFakeTimers();
    orientation = new EventTarget();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => Object.assign(orientation, { matches: true, media: '(orientation: portrait)' })),
    });
    setViewport(390, 664);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setViewport(initial.width, initial.height);
    document.documentElement.style.removeProperty('--inspect-vh');
  });

  it('sets --inspect-vh to the viewport height at mount', () => {
    renderHook(() => useStableViewportHeight());
    expect(vh()).toBe('664px');
  });

  it('ignores height-only resizes (URL bar collapsing while scrolling)', () => {
    renderHook(() => useStableViewportHeight());
    resize(390, 734);
    expect(vh()).toBe('664px');
    resize(391, 700);
    expect(vh()).toBe('664px');
    resize(390, 664);
    expect(vh()).toBe('664px');
  });

  it('re-measures when the width really changes', () => {
    renderHook(() => useStableViewportHeight());
    resize(750, 340);
    expect(vh()).toBe('340px');
    resize(750, 410);
    expect(vh()).toBe('340px');
  });

  it('re-measures on orientationchange and takes the settling resize right after it', () => {
    renderHook(() => useStableViewportHeight());
    // iOS: innerHeight is still stale when orientationchange fires.
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    expect(vh()).toBe('664px');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    resize(390, 340);
    expect(vh()).toBe('340px');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    resize(390, 410);
    expect(vh()).toBe('340px');
  });

  it('re-measures on an orientation media query change', () => {
    renderHook(() => useStableViewportHeight());
    setViewport(750, 340);
    act(() => {
      orientation.dispatchEvent(new Event('change'));
    });
    expect(vh()).toBe('340px');
  });

  it('never scrolls and adds no touch listeners; resize listener is passive', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const winAdd = vi.spyOn(window, 'addEventListener');
    const docAdd = vi.spyOn(document, 'addEventListener');

    renderHook(() => useStableViewportHeight());
    resize(390, 734);
    resize(750, 340);
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });

    expect(scrollTo).not.toHaveBeenCalled();
    const types = [...winAdd.mock.calls, ...docAdd.mock.calls].map((c) => c[0]);
    expect(types).not.toContain('touchstart');
    expect(types).not.toContain('touchmove');
    expect(winAdd.mock.calls.find((c) => c[0] === 'resize')?.[2]).toEqual({ passive: true });
  });

  it('removes the variable and listeners on unmount', () => {
    const { unmount } = renderHook(() => useStableViewportHeight());
    unmount();
    expect(vh()).toBe('');
    resize(750, 340);
    expect(vh()).toBe('');
  });
});
