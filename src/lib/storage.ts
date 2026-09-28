import { get, set } from 'idb-keyval';
import { Language, ToleranceLevel, ToleranceValue } from '../types';
import { DEFAULT_MIN_CONFIDENCE, MIN_CONFIDENCE_CEIL, MIN_CONFIDENCE_FLOOR } from './vision/confidence';
import { legacyToleranceToNumber } from './vision/toleranceParams';

const KEY_LANG = 'shelfguard_lang';
const KEY_TOLERANCE = 'shelfguard_tolerance';
const KEY_MIN_CONFIDENCE = 'shelfguard_min_confidence';

function clampToleranceValue(value: number): ToleranceValue {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function migrateLegacyTolerance(tol: ToleranceLevel): ToleranceValue {
  return legacyToleranceToNumber(tol);
}

/** Global language preference — not shelf-scoped (D-09). */
export async function loadSavedLanguage(): Promise<Language> {
  try {
    const lang = await get<Language>(KEY_LANG);
    if (lang === 'cn' || lang === 'en') return lang;
  } catch (err) {
    console.warn('Failed to load language setting:', err);
  }
  return 'cn';
}

export async function saveLanguage(lang: Language): Promise<void> {
  try {
    await set(KEY_LANG, lang);
  } catch (err) {
    console.error('Failed to save language setting:', err);
  }
}

/** Global tolerance preference — not shelf-scoped (D-09). Returns 0–100; migrates legacy enum on load (D-11). */
export async function loadSavedTolerance(): Promise<ToleranceValue> {
  try {
    const tol = await get<ToleranceValue | ToleranceLevel>(KEY_TOLERANCE);
    if (typeof tol === 'number' && Number.isFinite(tol)) {
      const clamped = clampToleranceValue(tol);
      if (clamped !== tol) {
        await set(KEY_TOLERANCE, clamped);
      }
      return clamped;
    }
    if (tol === 'strict' || tol === 'normal' || tol === 'loose') {
      const migrated = migrateLegacyTolerance(tol);
      await set(KEY_TOLERANCE, migrated);
      return migrated;
    }
  } catch (err) {
    console.warn('Failed to load tolerance:', err);
  }
  return 50;
}

export async function saveTolerance(tol: ToleranceValue): Promise<void> {
  try {
    await set(KEY_TOLERANCE, clampToleranceValue(tol));
  } catch (err) {
    console.error('Failed to save tolerance:', err);
  }
}

/** Global confidence threshold (percent); anything missing or out of range falls back to the default. */
export async function loadSavedMinConfidence(): Promise<number> {
  try {
    const value = await get<unknown>(KEY_MIN_CONFIDENCE);
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= MIN_CONFIDENCE_FLOOR &&
      value <= MIN_CONFIDENCE_CEIL
    ) {
      return value;
    }
  } catch (err) {
    console.warn('Failed to load confidence threshold:', err);
  }
  return DEFAULT_MIN_CONFIDENCE;
}

export async function saveMinConfidence(value: number): Promise<void> {
  try {
    await set(KEY_MIN_CONFIDENCE, Math.max(MIN_CONFIDENCE_FLOOR, Math.min(MIN_CONFIDENCE_CEIL, Math.round(value))));
  } catch (err) {
    console.error('Failed to save confidence threshold:', err);
  }
}
