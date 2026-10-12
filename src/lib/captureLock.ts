import {AppMode} from '../types';

/** Returns true when shutter capture should be ignored (STAB-01, STAB-05). */
export function isCaptureLocked(
  appMode: AppMode,
  captureLock: boolean,
  shelfHydrated = true,
): boolean {
  return (
    !shelfHydrated ||
    appMode === 'SCANNING_ANIM' ||
    appMode === 'PROCESSING' ||
    captureLock
  );
}
