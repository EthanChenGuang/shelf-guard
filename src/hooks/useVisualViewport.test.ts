import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { readVisibleViewport, useVisualViewport } from './useVisualViewport';

function stubInner(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

describe('readVisibleViewport', () => {
  it('parks below a WebKit-lie address bar using measured 100svh', () => {
    const rect = readVisibleViewport(
      {
        innerWidth: 844,
        innerHeight: 390,
        visualViewport: { offsetTop: 0, offsetLeft: 0, width: 844, height: 390 },
      },
      { width: 844, height: 334 },
    );
    expect(rect).toEqual({ offsetTop: 56, offsetLeft: 0, width: 844, height: 334 });
  });

  it('uses truthful visualViewport chrome when small-viewport is the full inner height', () => {
    const rect = readVisibleViewport(
      {
        innerWidth: 844,
        innerHeight: 390,
        visualViewport: { offsetTop: 56, offsetLeft: 0, width: 844, height: 334 },
      },
      { width: 844, height: 390 },
    );
    expect(rect).toEqual({ offsetTop: 56, offsetLeft: 0, width: 844, height: 334 });
  });

  it('falls back to inner size when visualViewport is missing and small measure is non-positive', () => {
    const rect = readVisibleViewport(
      { innerWidth: 844, innerHeight: 390 },
      { width: 0, height: 0 },
    );
    expect(rect).toEqual({ offsetTop: 0, offsetLeft: 0, width: 844, height: 390 });
  });
});

describe('useVisualViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to innerWidth/innerHeight when visualViewport is missing', () => {
    vi.stubGlobal('visualViewport', undefined);
    stubInner(844, 390);

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
    stubInner(800, 368);
    vi.stubGlobal('visualViewport', vv);

    const { result } = renderHook(() => useVisualViewport());
    expect(result.current).toEqual({ offsetTop: 48, offsetLeft: 0, width: 800, height: 320 });

    vv.width = 844;
    vv.height = 390;
    vv.offsetTop = 0;
    stubInner(844, 390);
    act(() => {
      listeners.resize?.();
    });
    expect(result.current).toEqual({ offsetTop: 0, offsetLeft: 0, width: 844, height: 390 });
  });
});
