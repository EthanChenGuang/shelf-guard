import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('idb-keyval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('idb-keyval')>();
  return {
    ...actual,
    set: vi.fn(actual.set),
    setMany: vi.fn(actual.setMany),
  };
});

import {clear, get, set, setMany} from 'idb-keyval';
import {DEFAULT_CALIBRATION} from './constants';
import type {AuditRecord, ShelfCalibration} from '../types';
import {
  appendAuditRecord,
  loadActiveShelfId,
  loadAuditHistoryRaw,
  loadBaseline,
  runSchemaMigrationIfNeeded,
  saveActiveShelfId,
  saveBaseline,
} from './shelfStorage';

class MockImage {
  naturalWidth = 640;
  naturalHeight = 480;
  width = 640;
  height = 480;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

function expectBlob(value: unknown) {
  expect(value).toBeDefined();
  expect(typeof value).not.toBe('string');
  expect(typeof (value as Blob).size).toBe('number');
  expect(typeof (value as Blob).type).toBe('string');
}

const TEST_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';

const LEGACY_BASELINE_KEY = 'shelfguard_baseline';
const LEGACY_HISTORY_KEY = 'shelfguard_audit_history';
const SCHEMA_VERSION_KEY = 'shelfguard_schema_version';

function makeCalibration(id: string): ShelfCalibration {
  return {
    id,
    createdAt: Date.now(),
    imageDataUrl: TEST_DATA_URL,
    imageDimensions: {width: 1080, height: 1920},
    splitYPercentages: [0.295, 0.455, 0.618, 0.782],
    tierLabels: ['T1', 'T2', 'T3', 'T4'],
  };
}

function makeAuditRecord(id: string): AuditRecord {
  return {
    id,
    timestamp: Date.now(),
    dateStr: '2026-09-21',
    timeStr: '12:00',
    complianceRate: 95,
    standardCount: 24,
    actualCount: 23,
    missingCount: 1,
    displacedCount: 0,
    thumbnailUrl: TEST_DATA_URL,
    anomalies: [],
    tolerance: 'normal',
  };
}

beforeEach(async () => {
  vi.mocked(set).mockImplementation(
    (await vi.importActual<typeof import('idb-keyval')>('idb-keyval')).set,
  );
  vi.stubGlobal('Image', MockImage);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (source: {width: number; height: number}) => ({
      width: source.width ?? 640,
      height: source.height ?? 480,
      close: vi.fn(),
    })),
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    callback(new Blob(['jpeg-bytes'], {type: type ?? 'image/jpeg'}));
  });
  await clear();
});

describe('runSchemaMigrationIfNeeded (DATA-03)', () => {
  it('migrates legacy baseline and history to shelf:0 and sets schema_version=2', async () => {
    const legacyBaseline = makeCalibration('legacy-baseline');
    const legacyHistory = [makeAuditRecord('audit-1')];
    await set(LEGACY_BASELINE_KEY, legacyBaseline);
    await set(LEGACY_HISTORY_KEY, legacyHistory);

    const result = await runSchemaMigrationIfNeeded();
    expect(result).toEqual({ok: true});

    expect(await get(SCHEMA_VERSION_KEY)).toBe(2);

    const migratedBaseline = await get('shelf:0:baseline');
    expect(migratedBaseline).toBeDefined();
    expectBlob((migratedBaseline as {imageBlob: unknown}).imageBlob);

    const migratedHistory = await get('shelf:0:history');
    expect(Array.isArray(migratedHistory)).toBe(true);
    expectBlob((migratedHistory as {thumbnailBlob: unknown}[])[0].thumbnailBlob);

    expect(await get(LEGACY_BASELINE_KEY)).toBeUndefined();
    expect(await get(LEGACY_HISTORY_KEY)).toBeUndefined();
  });

  it('is a no-op when schema_version is already 2', async () => {
    await set(SCHEMA_VERSION_KEY, 2);
    await set('shelf:0:baseline', {
      id: 'existing',
      createdAt: 1,
      imageBlob: new Blob(['x'], {type: 'image/jpeg'}),
      imageDimensions: {width: 1, height: 1},
      splitYPercentages: [0.1, 0.2, 0.3, 0.4],
      tierLabels: ['a', 'b', 'c', 'd'],
    });

    const result = await runSchemaMigrationIfNeeded();
    expect(result).toEqual({ok: true});
    expect((await get('shelf:0:baseline') as {id: string}).id).toBe('existing');
  });

  it('returns QUOTA_EXCEEDED when setMany fails during legacy migration (D-20)', async () => {
    await set(LEGACY_BASELINE_KEY, makeCalibration('legacy-quota'));
    vi.mocked(setMany).mockRejectedValueOnce(
      new DOMException('Quota exceeded', 'QuotaExceededError'),
    );

    const result = await runSchemaMigrationIfNeeded();
    expect(result).toEqual({ok: false, error: 'QUOTA_EXCEEDED'});
  });
});

describe('loadBaseline / saveBaseline (DATA-01, DATA-02)', () => {
  it('isolates baseline data per shelfId', async () => {
    await saveBaseline(0, makeCalibration('shelf-0'));
    await saveBaseline(1, makeCalibration('shelf-1'));

    const base0 = await loadBaseline(0, 'url-0');
    const base1 = await loadBaseline(1, 'url-1');

    expect(base0.id).toBe('shelf-0');
    expect(base1.id).toBe('shelf-1');
  });

  it('returns DEFAULT_CALIBRATION for empty shelves 1-4 (D-10)', async () => {
    for (const shelfId of [1, 2, 3, 4]) {
      const baseline = await loadBaseline(shelfId);
      expect(baseline.id).toBe(DEFAULT_CALIBRATION.id);
    }
  });

  it('persists imageBlob as Blob, not string', async () => {
    await saveBaseline(0, makeCalibration('blob-check'));
    const raw = await get('shelf:0:baseline');
    expectBlob((raw as {imageBlob: unknown}).imageBlob);
  });
});

describe('appendAuditRecord history cap (DATA-05)', () => {
  it('caps per-shelf history at 20 FIFO records', async () => {
    for (let i = 0; i < 21; i++) {
      const result = await appendAuditRecord(0, makeAuditRecord(`rec-${i}`));
      expect(result).toEqual({ok: true});
    }

    const history = await loadAuditHistoryRaw(0);
    expect(history).toHaveLength(20);
    expect(history.some((r) => r.id === 'rec-0')).toBe(false);
    expect(history.some((r) => r.id === 'rec-20')).toBe(true);
  });

  it('stores audit thumbnail as Blob, not data URL string', async () => {
    await appendAuditRecord(0, makeAuditRecord('thumb-blob'));
    const stored = await get('shelf:0:history');
    expect(Array.isArray(stored)).toBe(true);
    const record = (stored as {thumbnailBlob?: unknown; thumbnailUrl?: unknown}[])[0];
    expect(record.thumbnailBlob).toBeDefined();
    expect(typeof record.thumbnailBlob).not.toBe('string');
    expect(record.thumbnailUrl).toBeUndefined();
  });

  it('compresses thumbnail width to max 320px before persist', async () => {
    class WideMockImage extends MockImage {
      naturalWidth = 800;
      width = 800;
    }
    vi.stubGlobal('Image', WideMockImage);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 800,
        height: 600,
        close: vi.fn(),
      })),
    );

    let canvasWidth = 0;
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName) => {
        const el = origCreateElement(tagName);
        if (tagName === 'canvas') {
          Object.defineProperty(el, 'width', {
            set(value: number) {
              canvasWidth = value;
            },
            get() {
              return canvasWidth;
            },
            configurable: true,
          });
        }
        return el;
      });

    try {
      await appendAuditRecord(0, makeAuditRecord('wide-thumb'));
      expect(canvasWidth).toBeLessThanOrEqual(320);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('idb-keyval shelf:0:history length stays at or below 20 after stress append', async () => {
    for (let i = 0; i < 25; i++) {
      await appendAuditRecord(0, makeAuditRecord(`stress-${i}`));
    }
    const stored = await get('shelf:0:history');
    expect(Array.isArray(stored)).toBe(true);
    expect((stored as unknown[]).length).toBeLessThanOrEqual(20);
  });
});

describe('quota errors (DATA-04)', () => {
  it('returns QUOTA_EXCEEDED when saveBaseline hits QuotaExceededError', async () => {
    vi.mocked(set).mockRejectedValueOnce(
      new DOMException('Quota exceeded', 'QuotaExceededError'),
    );

    const result = await saveBaseline(0, makeCalibration('quota-test'));
    expect(result).toEqual({ok: false, error: 'QUOTA_EXCEEDED'});
  });
});

describe('active shelf (SHLF-04)', () => {
  it('saveActiveShelfId(3) then loadActiveShelfId returns 3', async () => {
    const saveResult = await saveActiveShelfId(3);
    expect(saveResult).toEqual({ok: true});
    expect(await loadActiveShelfId()).toBe(3);
  });

  it('clamps invalid active shelf values to 0-4', async () => {
    await set('shelfguard_active_shelf', 99);
    expect(await loadActiveShelfId()).toBe(4);

    await set('shelfguard_active_shelf', -5);
    expect(await loadActiveShelfId()).toBe(0);
  });
});
