import { get, set, del } from 'idb-keyval';
import { AuditRecord, Language, ShelfCalibration, ToleranceLevel } from '../types';
import { DEFAULT_CALIBRATION } from './constants';

const KEY_BASELINE = 'shelfguard_baseline';
const KEY_HISTORY = 'shelfguard_audit_history';
const KEY_LANG = 'shelfguard_lang';
const KEY_TOLERANCE = 'shelfguard_tolerance';

export async function loadBaseline(): Promise<ShelfCalibration> {
  try {
    const data = await get<ShelfCalibration>(KEY_BASELINE);
    if (data && data.splitYPercentages && data.splitYPercentages.length === 4) {
      return data;
    }
  } catch (err) {
    console.warn('Failed to load baseline from IndexedDB, using default:', err);
  }
  return DEFAULT_CALIBRATION;
}

export async function saveBaseline(calibration: ShelfCalibration): Promise<void> {
  try {
    await set(KEY_BASELINE, calibration);
  } catch (err) {
    console.error('Failed to save baseline to IndexedDB:', err);
  }
}

export async function clearBaseline(): Promise<void> {
  try {
    await del(KEY_BASELINE);
  } catch (err) {
    console.error('Failed to clear baseline:', err);
  }
}

export async function loadAuditHistory(): Promise<AuditRecord[]> {
  try {
    const list = await get<AuditRecord[]>(KEY_HISTORY);
    if (Array.isArray(list)) {
      return list;
    }
  } catch (err) {
    console.warn('Failed to load history:', err);
  }
  return [];
}

export async function saveAuditRecord(record: AuditRecord): Promise<void> {
  try {
    const existing = await loadAuditHistory();
    const updated = [record, ...existing].slice(0, 50); // keep last 50
    await set(KEY_HISTORY, updated);
  } catch (err) {
    console.error('Failed to append audit record:', err);
  }
}

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
