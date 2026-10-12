import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVisualViewport } from './useVisualViewport';

describe('useVisualViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to innerWidth/innerHeight when visualViewport is missing', () => {
    vi.stubGlobal('visualViewport', undefined);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 844 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });

    const { result } = renderHook(() => useVisualViewport());
    expect(result.current).toEqual({ offsetTop: 0, offsetLeft: 0, width: 844, height: 390 });
  });

  it('tracks visualViewport size and offset, including resize', () => {
    const listeners: Record<string, () => void> = {};
    const vv = {
      offsetTop: 48,
      offsetLeft: 0,
      width: 800,
      height: 320,
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('visualViewport', vv);

    const { result } = renderHook(() => useVisualViewport());
    expect(result.current).toEqual({ offsetTop: 48, offsetLeft: 0, width: 800, height: 320 });

    vv.width = 844;
    vv.height = 390;
    vv.offsetTop = 0;
    act(() => {
      listeners.resize?.();
    });
    expect(result.current).toEqual({ offsetTop: 0, offsetLeft: 0, width: 844, height: 390 });
  });
});
