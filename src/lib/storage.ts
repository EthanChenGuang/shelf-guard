import { get, set } from 'idb-keyval';
import { Language, ToleranceLevel } from '../types';

const KEY_LANG = 'shelfguard_lang';
const KEY_TOLERANCE = 'shelfguard_tolerance';

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

/** Global tolerance preference — not shelf-scoped (D-09). */
export async function loadSavedTolerance(): Promise<ToleranceLevel> {
  try {
    const tol = await get<ToleranceLevel>(KEY_TOLERANCE);
    if (tol === 'strict' || tol === 'normal' || tol === 'loose') return tol;
  } catch (err) {
    console.warn('Failed to load tolerance:', err);
  }
  return 'normal';
}

export async function saveTolerance(tol: ToleranceLevel): Promise<void> {
  try {
    await set(KEY_TOLERANCE, tol);
  } catch (err) {
    console.error('Failed to save tolerance:', err);
  }
}
