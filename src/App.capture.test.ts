import {describe, expect, it} from 'vitest';
import {isCaptureLocked} from './lib/captureLock';

describe('App shutter guard (STAB-01)', () => {
  it('returns early when captureLockRef is already true', () => {
    expect(isCaptureLocked('CAMERA_IDLE', true)).toBe(true);
  });

  it('blocks re-entry during SCANNING_ANIM', () => {
    expect(isCaptureLocked('SCANNING_ANIM', false)).toBe(true);
  });

  it('blocks re-entry during PROCESSING', () => {
    expect(isCaptureLocked('PROCESSING', false)).toBe(true);
  });

  it('allows capture when idle and unlocked', () => {
    expect(isCaptureLocked('CAMERA_IDLE', false)).toBe(false);
  });
});
