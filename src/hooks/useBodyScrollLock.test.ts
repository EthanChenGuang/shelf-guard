import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { lockBodyScroll, useBodyScrollLock, ZOOM_MODE_ATTR } from './useBodyScrollLock';

describe('lockBodyScroll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
  });

  it('pins the body at the current offset and restores styles and scroll exactly', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(312);
    vi.spyOn(window, 'scrollX', 'get').mockReturnValue(0);
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.touchAction = 'pan-y';
    const htmlBefore = document.documentElement.style.cssText;
    const bodyBefore = document.body.style.cssText;

    const restore = lockBodyScroll();

    expect(document.documentElement.getAttribute(ZOOM_MODE_ATTR)).toBe('true');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-312px');

    restore();

    expect(document.documentElement.style.cssText).toBe(htmlBefore);
    expect(document.body.style.cssText).toBe(bodyBefore);
    expect(document.body.style.position).toBe('');
    expect(document.body.style.touchAction).toBe('pan-y');
    expect(document.documentElement.style.overflowX).toBe('hidden');
    expect(document.documentElement.hasAttribute(ZOOM_MODE_ATTR)).toBe(false);
    expect(scrollTo).toHaveBeenCalledWith(0, 312);
  });

  it('locks only while active and unlocks on unmount', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { rerender, unmount } = renderHook(({ on }) => useBodyScrollLock(on), {
      initialProps: { on: false },
    });
    expect(document.body.style.position).toBe('');
    rerender({ on: true });
    expect(document.body.style.position).toBe('fixed');
    rerender({ on: false });
    expect(document.body.style.position).toBe('');
    rerender({ on: true });
    unmount();
    expect(document.body.style.position).toBe('');
    expect(document.documentElement.hasAttribute(ZOOM_MODE_ATTR)).toBe(false);
  });
});
