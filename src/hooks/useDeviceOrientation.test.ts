import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeviceOrientation } from './useDeviceOrientation';
import {
  emitDeviceOrientation,
  installRequestPermission,
  removeRequestPermission,
} from '../test/deviceOrientationMocks';

describe('useDeviceOrientation (CAM-03, CAM-07)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { vibrate: vi.fn() });
  });

  afterEach(() => {
    removeRequestPermission();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('requestPermission granted → orientationPermission granted, events update tilt', async () => {
    installRequestPermission(async () => 'granted');

    const { result } = renderHook(() => useDeviceOrientation());

    expect(result.current.orientationPermission).toBe('prompt');

    await act(async () => {
      await result.current.requestOrientationPermission();
    });

    expect(result.current.orientationPermission).toBe('granted');

    act(() => {
      emitDeviceOrientation(5.2);
    });

    expect(result.current.tilt).toBe(5.2);
    expect(result.current.hasSensor).toBe(true);
  });

  it('requestPermission denied → orientationPermission denied, tilt stays 0', async () => {
    installRequestPermission(async () => 'denied');

    const { result } = renderHook(() => useDeviceOrientation());

    await act(async () => {
      await result.current.requestOrientationPermission();
    });

    expect(result.current.orientationPermission).toBe('denied');

    act(() => {
      emitDeviceOrientation(8);
    });

    expect(result.current.tilt).toBe(0);
    expect(result.current.hasSensor).toBe(false);
  });

  it('requestPermission API absent → unsupported, listener attaches immediately', async () => {
    removeRequestPermission();

    const { result } = renderHook(() => useDeviceOrientation());

    expect(result.current.orientationPermission).toBe('unsupported');

    act(() => {
      emitDeviceOrientation(3.1);
    });

    expect(result.current.tilt).toBe(3.1);
    expect(result.current.hasSensor).toBe(true);
  });

  it('gamma within ±1.5° sets isLevel true', async () => {
    removeRequestPermission();

    const { result } = renderHook(() => useDeviceOrientation());

    act(() => {
      emitDeviceOrientation(1.4);
    });

    expect(result.current.isLevel).toBe(true);
  });

  it('gamma outside ±1.5° sets isLevel false', async () => {
    removeRequestPermission();

    const { result } = renderHook(() => useDeviceOrientation());

    act(() => {
      emitDeviceOrientation(2.0);
    });

    expect(result.current.isLevel).toBe(false);
  });

  it('setSimulatedTilt uses 800ms haptic debounce', async () => {
    removeRequestPermission();

    const { result } = renderHook(() => useDeviceOrientation());

    act(() => {
      result.current.setSimulatedTilt(0);
    });
    act(() => {
      result.current.setSimulatedTilt(0);
    });

    expect(navigator.vibrate).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(801);
      result.current.setSimulatedTilt(0);
    });

    expect(navigator.vibrate).toHaveBeenCalledTimes(2);
  });

  it('real sensor path uses 1200ms haptic debounce', async () => {
    removeRequestPermission();

    const { result } = renderHook(() => useDeviceOrientation());

    act(() => {
      emitDeviceOrientation(0);
    });
    act(() => {
      emitDeviceOrientation(0);
    });

    expect(navigator.vibrate).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1201);
      emitDeviceOrientation(0);
    });

    expect(navigator.vibrate).toHaveBeenCalledTimes(2);
  });

  it('sets hasSensor false after 3s without deviceorientation events', async () => {
    removeRequestPermission();

    const { result } = renderHook(() => useDeviceOrientation());

    expect(result.current.hasSensor).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.hasSensor).toBe(false);
  });
});
