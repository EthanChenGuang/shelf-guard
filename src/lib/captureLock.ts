import {AppMode} from '../types';

/** Returns true when shutter capture should be ignored (STAB-01). */
export function isCaptureLocked(appMode: AppMode, captureLock: boolean): boolean {
  return (
    appMode === 'SCANNING_ANIM' ||
    appMode === 'PROCESSING' ||
    captureLock
  );
}
