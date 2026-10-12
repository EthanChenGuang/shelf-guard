import { useEffect, useState } from 'react';

export interface VisualViewportRect {
  offsetTop: number;
  offsetLeft: number;
  width: number;
  height: number;
}

function readVisualViewport(): VisualViewportRect {
  const vv = window.visualViewport;
  if (vv) {
    return {
      offsetTop: vv.offsetTop,
      offsetLeft: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
    };
  }
  return {
    offsetTop: 0,
    offsetLeft: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/** Visible browser viewport, including address-bar and pinch-zoom offsets on mobile. */
export function useVisualViewport(): VisualViewportRect {
  const [rect, setRect] = useState<VisualViewportRect>(() =>
    typeof window === 'undefined'
      ? { offsetTop: 0, offsetLeft: 0, width: 0, height: 0 }
      : readVisualViewport(),
  );

  useEffect(() => {
    const update = () => setRect(readVisualViewport());
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return rect;
}
