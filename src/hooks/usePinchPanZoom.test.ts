import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import { usePinchPanZoom } from './usePinchPanZoom';

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
});
