import { useCallback, useEffect, useRef, useState } from 'react';

export type OrientationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

function needsOrientationPermission(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      .requestPermission === 'function'
  );
}

export function useDeviceOrientation() {
  const [tilt, setTilt] = useState<number>(0);
  const [isLevel, setIsLevel] = useState<boolean>(true);
  const [hasSensor, setHasSensor] = useState<boolean>(false);
  const [orientationPermission, setOrientationPermission] = useState<OrientationPermission>(
    () => (needsOrientationPermission() ? 'prompt' : 'unsupported'),
  );
  const lastVibrateTime = useRef<number>(0);
  const listenerAttached = useRef<boolean>(false);
  const sensorDetectedRef = useRef<boolean>(false);
  const noEventTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (event.gamma !== null && event.gamma !== undefined) {
      sensorDetectedRef.current = true;
      setHasSensor(true);
      const rawTilt = Math.min(Math.max(event.gamma, -30), 30);
      const rounded = Math.round(rawTilt * 10) / 10;
      setTilt(rounded);

      const levelCondition = Math.abs(rounded) <= 1.5;
      setIsLevel(levelCondition);

      if (levelCondition) {
        const now = Date.now();
        if (now - lastVibrateTime.current > 1200) {
          try {
            navigator.vibrate?.(40);
          } catch {
            // ignore vibration error
          }
          lastVibrateTime.current = now;
        }
      }
    }
  }, []);

  const clearNoEventTimeout = useCallback(() => {
    if (noEventTimeoutRef.current) {
      clearTimeout(noEventTimeoutRef.current);
      noEventTimeoutRef.current = null;
    }
  }, []);

  const startNoEventTimeout = useCallback(() => {
    clearNoEventTimeout();
    noEventTimeoutRef.current = setTimeout(() => {
      if (!sensorDetectedRef.current) {
        setHasSensor(false);
      }
    }, 3000);
  }, [clearNoEventTimeout]);

  const attachListener = useCallback(() => {
    if (listenerAttached.current) return;
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      listenerAttached.current = true;
      startNoEventTimeout();
    }
  }, [handleOrientation, startNoEventTimeout]);

  const detachListener = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', handleOrientation);
    }
    listenerAttached.current = false;
    clearNoEventTimeout();
  }, [handleOrientation, clearNoEventTimeout]);

  useEffect(() => {
    if (!needsOrientationPermission()) {
      attachListener();
    }
    return () => {
      detachListener();
    };
  }, [attachListener, detachListener]);

  const requestOrientationPermission = useCallback(async (): Promise<OrientationPermission> => {
    if (!needsOrientationPermission()) {
      setOrientationPermission('unsupported');
      attachListener();
      return 'unsupported';
    }
    try {
      const state = await (
        DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
      ).requestPermission();
      if (state === 'granted') {
        setOrientationPermission('granted');
        attachListener();
        return 'granted';
      }
      setOrientationPermission('denied');
      return 'denied';
    } catch {
      setOrientationPermission('denied');
      return 'denied';
    }
  }, [attachListener]);

  const setSimulatedTilt = useCallback((newTilt: number) => {
    setTilt(newTilt);
    const levelCondition = Math.abs(newTilt) <= 1.5;
    setIsLevel(levelCondition);
    if (levelCondition) {
      const now = Date.now();
      if (now - lastVibrateTime.current > 800) {
        try {
          navigator.vibrate?.(40);
        } catch {
          // ignore
        }
        lastVibrateTime.current = now;
      }
    }
  }, []);

  return {
    tilt,
    isLevel,
    hasSensor,
    orientationPermission,
    requestOrientationPermission,
    setSimulatedTilt,
  };
}
