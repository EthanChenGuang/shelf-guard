import { useEffect, useRef, useState } from 'react';

export function useDeviceOrientation() {
  const [tilt, setTilt] = useState<number>(0);
  const [isLevel, setIsLevel] = useState<boolean>(true);
  const [hasSensor, setHasSensor] = useState<boolean>(false);
  const lastVibrateTime = useRef<number>(0);

  useEffect(() => {
    let sensorDetected = false;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma !== null && event.gamma !== undefined) {
        sensorDetected = true;
        setHasSensor(true);
        // Gamma is left-to-right tilt in degrees (-90 to 90)
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
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  // Desktop simulator fallback / helper
  const setSimulatedTilt = (newTilt: number) => {
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
  };

  return {
    tilt,
    isLevel,
    hasSensor,
    setSimulatedTilt,
  };
}
