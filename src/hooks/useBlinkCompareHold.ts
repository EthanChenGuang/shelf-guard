import { useCallback, useRef, useState } from 'react';

export const COMPARE_HOLD_MS = 450;
const MOVE_CANCEL_PX = 12;

export interface BlinkCompareHold {
  isBlinking: boolean;
  begin: (x?: number, y?: number) => void;
  move: (x: number, y: number) => void;
  end: () => void;
  cancel: () => void;
}

/**
 * Press-and-hold to swap in the baseline. Movement cancels the hold so pinch/pan
 * still work while zoomed. Optional onShortRelease is unused on the results page.
 */
export function useBlinkCompareHold(options: { onShortRelease?: () => void } = {}): BlinkCompareHold {
  const [isBlinking, setIsBlinking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downRef = useRef(false);
  const holdRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const onShortReleaseRef = useRef(options.onShortRelease);
  onShortReleaseRef.current = options.onShortRelease;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const begin = useCallback((x = 0, y = 0) => {
    downRef.current = true;
    holdRef.current = false;
    movedRef.current = false;
    startRef.current = { x, y };
    clearTimer();
    timerRef.current = setTimeout(() => {
      holdRef.current = true;
      setIsBlinking(true);
    }, COMPARE_HOLD_MS);
  }, []);

  const move = useCallback((x: number, y: number) => {
    if (!downRef.current) return;
    if (Math.hypot(x - startRef.current.x, y - startRef.current.y) <= MOVE_CANCEL_PX) return;
    movedRef.current = true;
    holdRef.current = false;
    clearTimer();
    setIsBlinking(false);
  }, []);

  const end = useCallback(() => {
    if (!downRef.current) return;
    downRef.current = false;
    clearTimer();
    const wasHold = holdRef.current;
    const wasMoved = movedRef.current;
    holdRef.current = false;
    movedRef.current = false;
    setIsBlinking(false);
    if (!wasHold && !wasMoved) onShortReleaseRef.current?.();
  }, []);

  const cancel = useCallback(() => {
    downRef.current = false;
    holdRef.current = false;
    movedRef.current = false;
    clearTimer();
    setIsBlinking(false);
  }, []);

  return { isBlinking, begin, move, end, cancel };
}
