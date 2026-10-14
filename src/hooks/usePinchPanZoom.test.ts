import { describe, expect, it, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import { usePinchPanZoom } from './usePinchPanZoom';

afterEach(() => {
  document.documentElement.removeAttribute('data-inspect-zoomed');
});

function twoFingerStart(y0 = 0, y1 = 100) {
  return {
    touches: [
      { clientX: 0, clientY: y0 },
      { clientX: 0, clientY: y1 },
    ],
    preventDefault: () => undefined,
  } as unknown as ReactTouchEvent;
}

describe('usePinchPanZoom', () => {
  it('starts at scale 1 and resets', () => {
    const { result } = renderHook(() => usePinchPanZoom());
    expect(result.current.transform.scale).toBe(1);

    act(() => {
      result.current.touchHandlers.onTouchStart({
        touches: [
          { clientX: 0, clientY: 0 },
          { clientX: 0, clientY: 100 },
        ],
        preventDefault: () => undefined,
      } as unknown as ReactTouchEvent);
      result.current.touchHandlers.onTouchMove({
        touches: [
          { clientX: 0, clientY: 0 },
          { clientX: 0, clientY: 200 },
        ],
        preventDefault: () => undefined,
      } as unknown as ReactTouchEvent);
    });

    expect(result.current.transform.scale).toBeGreaterThan(1);

    act(() => {
      result.current.reset();
    });
    expect(result.current.transform.scale).toBe(1);
  });

  it('keeps scale when one of two pinch fingers lifts', () => {
    const { result } = renderHook(() => usePinchPanZoom());

    act(() => {
      result.current.touchHandlers.onTouchStart({
        touches: [
          { clientX: 0, clientY: 0 },
          { clientX: 0, clientY: 100 },
        ],
        preventDefault: () => undefined,
      } as unknown as ReactTouchEvent);
      result.current.touchHandlers.onTouchMove({
        touches: [
          { clientX: 0, clientY: 0 },
          { clientX: 0, clientY: 200 },
        ],
        preventDefault: () => undefined,
      } as unknown as ReactTouchEvent);
    });

    const scaleAfterPinch = result.current.transform.scale;
    expect(scaleAfterPinch).toBeGreaterThan(1);

    act(() => {
      result.current.touchHandlers.onTouchEnd({
        touches: [{ clientX: 0, clientY: 200 }],
        preventDefault: () => undefined,
      } as unknown as ReactTouchEvent);
    });

    expect(result.current.transform.scale).toBe(scaleAfterPinch);
  });

  it('pinches via pointer events when TouchEvent is not the source', () => {
    const { result } = renderHook(() => usePinchPanZoom());
    const preventDefault = () => undefined;

    act(() => {
      result.current.pointerHandlers.onPointerDown({
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 80,
        preventDefault,
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
      result.current.pointerHandlers.onPointerDown({
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 160,
        preventDefault,
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
      result.current.pointerHandlers.onPointerMove({
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 240,
        preventDefault,
      } as unknown as ReactPointerEvent);
    });

    expect(result.current.transform.scale).toBeGreaterThan(1);
  });

  it('does not double-scale when pointerType touch follows a TouchEvent pinch', () => {
    const { result } = renderHook(() => usePinchPanZoom());
    const preventDefault = () => undefined;

    act(() => {
      result.current.touchHandlers.onTouchStart({
        touches: [
          { clientX: 100, clientY: 80 },
          { clientX: 100, clientY: 160 },
        ],
        preventDefault,
      } as unknown as ReactTouchEvent);
      result.current.touchHandlers.onTouchMove({
        touches: [
          { clientX: 100, clientY: 40 },
          { clientX: 100, clientY: 200 },
        ],
        preventDefault,
      } as unknown as ReactTouchEvent);
    });

    const afterTouch = result.current.transform.scale;
    expect(afterTouch).toBeGreaterThan(1);

    act(() => {
      result.current.pointerHandlers.onPointerDown({
        pointerId: 11,
        pointerType: 'touch',
        clientX: 100,
        clientY: 40,
        preventDefault,
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
      result.current.pointerHandlers.onPointerDown({
        pointerId: 12,
        pointerType: 'touch',
        clientX: 100,
        clientY: 200,
        preventDefault,
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
      result.current.pointerHandlers.onPointerMove({
        pointerId: 12,
        pointerType: 'touch',
        clientX: 100,
        clientY: 320,
        preventDefault,
      } as unknown as ReactPointerEvent);
    });

    expect(result.current.transform.scale).toBe(afterTouch);
  });

  it('sets data-inspect-zoomed on two-finger touchstart while scale is still 1', () => {
    const { result } = renderHook(() => usePinchPanZoom());

    act(() => {
      result.current.touchHandlers.onTouchStart(twoFingerStart());
    });

    expect(result.current.transform.scale).toBe(1);
    expect(result.current.isPinching).toBe(true);
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBe('true');
  });

  it('sets data-inspect-zoomed when a second mouse pointer starts a pinch', () => {
    const { result } = renderHook(() => usePinchPanZoom());
    const preventDefault = () => undefined;

    act(() => {
      result.current.pointerHandlers.onPointerDown({
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 80,
        preventDefault,
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
      result.current.pointerHandlers.onPointerDown({
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 160,
        preventDefault,
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
    });

    expect(result.current.transform.scale).toBe(1);
    expect(result.current.isPinching).toBe(true);
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBe('true');
  });

  it('clears data-inspect-zoomed when the gesture ends or resets at scale 1', () => {
    const { result } = renderHook(() => usePinchPanZoom());

    act(() => {
      result.current.touchHandlers.onTouchStart(twoFingerStart());
    });
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBe('true');

    act(() => {
      result.current.touchHandlers.onTouchEnd({
        touches: [],
        preventDefault: () => undefined,
      } as unknown as ReactTouchEvent);
    });
    expect(result.current.transform.scale).toBe(1);
    expect(result.current.isPinching).toBe(false);
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBeNull();

    act(() => {
      result.current.pointerHandlers.onPointerDown({
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
        preventDefault: () => undefined,
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
      result.current.pointerHandlers.onPointerDown({
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 80,
        preventDefault: () => undefined,
        currentTarget: document.createElement('div'),
      } as unknown as ReactPointerEvent);
    });
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBe('true');
    act(() => {
      result.current.reset();
    });
    expect(result.current.transform.scale).toBe(1);
    expect(result.current.isPinching).toBe(false);
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBeNull();
  });

  it('keeps data-inspect-zoomed after fingers lift when scale stays above 1.01', () => {
    const { result } = renderHook(() => usePinchPanZoom());

    act(() => {
      result.current.touchHandlers.onTouchStart(twoFingerStart(0, 100));
      result.current.touchHandlers.onTouchMove(twoFingerStart(0, 220));
      result.current.touchHandlers.onTouchEnd({
        touches: [],
        preventDefault: () => undefined,
      } as unknown as ReactTouchEvent);
    });

    expect(result.current.transform.scale).toBeGreaterThan(1.01);
    expect(result.current.isPinching).toBe(false);
    expect(document.documentElement.getAttribute('data-inspect-zoomed')).toBe('true');
  });
});
