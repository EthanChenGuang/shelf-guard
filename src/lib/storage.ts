import { get, set } from 'idb-keyval';
import { Language, ToleranceLevel, ToleranceValue } from '../types';
import { legacyToleranceToNumber } from './vision/toleranceParams';

const KEY_LANG = 'shelfguard_lang';
const KEY_TOLERANCE = 'shelfguard_tolerance';

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
