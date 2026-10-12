import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { COMPARE_HOLD_MS, useBlinkCompareHold } from './useBlinkCompareHold';

describe('useBlinkCompareHold', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('blinks after hold, not on short tap', () => {
    const onShortRelease = vi.fn();
    const { result } = renderHook(() => useBlinkCompareHold({ onShortRelease }));

    act(() => {
      result.current.begin(10, 10);
    });
    expect(result.current.isBlinking).toBe(false);

    act(() => {
      result.current.end();
    });
    expect(onShortRelease).toHaveBeenCalledOnce();
    expect(result.current.isBlinking).toBe(false);

    onShortRelease.mockClear();
    act(() => {
      result.current.begin(10, 10);
    });
    act(() => {
      vi.advanceTimersByTime(COMPARE_HOLD_MS + 20);
    });
    expect(result.current.isBlinking).toBe(true);
    expect(onShortRelease).not.toHaveBeenCalled();

    act(() => {
      result.current.end();
    });
    expect(result.current.isBlinking).toBe(false);
    expect(onShortRelease).not.toHaveBeenCalled();
  });

  it('cancels blink when the pointer moves', () => {
    const onShortRelease = vi.fn();
    const { result } = renderHook(() => useBlinkCompareHold({ onShortRelease }));

    act(() => {
      result.current.begin(10, 10);
      result.current.move(40, 40);
    });
    act(() => {
      vi.advanceTimersByTime(COMPARE_HOLD_MS + 20);
    });
    expect(result.current.isBlinking).toBe(false);

    act(() => {
      result.current.end();
    });
    expect(onShortRelease).not.toHaveBeenCalled();
  });
});
