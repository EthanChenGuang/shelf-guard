import { describe, expect, it, vi } from 'vitest';
import { attachShelfSwipe, SWIPE_THRESHOLD_PX } from './shelfSwipe';

function makePointerEvent(type: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}

function swipeHorizontal(
  el: HTMLElement,
  dx: number,
  dy = 0,
  startX = 100,
  startY = 200,
) {
  el.dispatchEvent(makePointerEvent('pointerdown', startX, startY));
  el.dispatchEvent(makePointerEvent('pointerup', startX + dx, startY + dy));
}

describe('attachShelfSwipe (D-01, D-32)', () => {
  it('exports 50px swipe threshold constant', () => {
    expect(SWIPE_THRESHOLD_PX).toBe(50);
  });

  it('triggers onSwipeLeft when finger moves left beyond threshold (dx=-60)', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const el = document.createElement('div');

    attachShelfSwipe(el, {
      enabled: true,
      onSwipeLeft,
      onSwipeRight,
    });

    swipeHorizontal(el, -60);
    expect(onSwipeLeft).toHaveBeenCalledOnce();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('triggers onSwipeRight when finger moves right beyond threshold (dx=60)', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const el = document.createElement('div');

    attachShelfSwipe(el, {
      enabled: true,
      onSwipeLeft,
      onSwipeRight,
    });

    swipeHorizontal(el, 60);
    expect(onSwipeRight).toHaveBeenCalledOnce();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores vertical-dominant gestures', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const el = document.createElement('div');

    attachShelfSwipe(el, {
      enabled: true,
      onSwipeLeft,
      onSwipeRight,
    });

    swipeHorizontal(el, 10, 80);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('ignores pointer events when enabled=false', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const el = document.createElement('div');

    attachShelfSwipe(el, {
      enabled: false,
      onSwipeLeft,
      onSwipeRight,
    });

    swipeHorizontal(el, 60);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });
});
