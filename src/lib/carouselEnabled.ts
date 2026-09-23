import type { AppMode } from '../types';

/** Carousel swipe/dot selection allowed only in idle camera modes (D-05). */
export function isCarouselEnabled(appMode: AppMode): boolean {
  return appMode === 'CAMERA_IDLE' || appMode === 'INITIAL_GUIDE';
}
