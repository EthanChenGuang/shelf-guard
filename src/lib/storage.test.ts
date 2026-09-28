import { beforeEach, describe, expect, it } from 'vitest';
import { clear, set } from 'idb-keyval';
import { loadSavedMinConfidence, saveMinConfidence } from './storage';

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
