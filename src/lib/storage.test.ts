import { beforeEach, describe, expect, it } from 'vitest';
import { clear, set } from 'idb-keyval';
import { loadSavedLanguage, loadSavedMinConfidence, saveLanguage, saveMinConfidence } from './storage';

describe('confidence threshold persistence', () => {
  beforeEach(async () => {
    await clear();
  });

  it('defaults to 85 when nothing is stored', async () => {
    await expect(loadSavedMinConfidence()).resolves.toBe(85);
  });

  it('round-trips a saved threshold', async () => {
    await saveMinConfidence(90);
    await expect(loadSavedMinConfidence()).resolves.toBe(90);
  });

  it.each([30, 120, 85.5, Number.NaN, '90'])('falls back to 85 for stored %s', async (value) => {
    await set('shelfguard_min_confidence', value);
    await expect(loadSavedMinConfidence()).resolves.toBe(85);
  });
});

describe('language persistence', () => {
  beforeEach(async () => {
    await clear();
  });

  it('defaults to Italian when nothing is stored', async () => {
    await expect(loadSavedLanguage()).resolves.toBe('it');
  });

  it('round-trips a saved language', async () => {
    await saveLanguage('en');
    await expect(loadSavedLanguage()).resolves.toBe('en');
  });

  it.each(['it', 'en', 'cn'] as const)('round-trips %s', async (lang) => {
    await saveLanguage(lang);
    await expect(loadSavedLanguage()).resolves.toBe(lang);
  });

  it('falls back to Italian for an unknown stored value', async () => {
    await set('shelfguard_lang', 'fr');
    await expect(loadSavedLanguage()).resolves.toBe('it');
  });
});
