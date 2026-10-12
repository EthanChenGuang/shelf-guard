import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { TouchEvent as ReactTouchEvent } from 'react';
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
});
