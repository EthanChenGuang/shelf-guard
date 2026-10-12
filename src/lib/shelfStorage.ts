import {del, delMany, get, set, setMany} from 'idb-keyval';
import type {AuditRecord, ShelfCalibration} from '../types';
import type {
  PersistedAuditRecord,
  PersistedBaseline,
  StorageWriteResult,
} from '../types/persisted';
import {compressToJpegBlob, dataUrlToBlob, isQuotaError, isStructuredCloneError} from './blobUtils';
import {DEFAULT_CALIBRATION} from './constants';

const LEGACY_KEY_BASELINE = 'shelfguard_baseline';
const LEGACY_KEY_HISTORY = 'shelfguard_audit_history';
const KEY_ACTIVE_SHELF = 'shelfguard_active_shelf';
const KEY_SCHEMA_VERSION = 'shelfguard_schema_version';
const CURRENT_SCHEMA = 2;
export const HISTORY_CAP = 20;

const baselineKey = (shelfId: number) => `shelf:${shelfId}:baseline`;
const historyKey = (shelfId: number) => `shelf:${shelfId}:history`;

/** Clamp shelf index to valid range 0–4 (D-09, T-02-03). */
export function validateShelfId(shelfId: number): number {
  if (!Number.isFinite(shelfId)) return 0;
  return Math.min(4, Math.max(0, Math.trunc(shelfId)));
}

export function toViewBaseline(
  persisted: PersistedBaseline,
  displayUrl: string,
): ShelfCalibration {
  return {
    id: persisted.id,
    createdAt: persisted.createdAt,
    imageDataUrl: displayUrl,
    imageDimensions: persisted.imageDimensions,
    lensFocalLength: persisted.lensFocalLength ?? null,
  };
}

export function toViewAuditRecord(
  persisted: PersistedAuditRecord,
  thumbUrl: string,
): AuditRecord {
  return {
    id: persisted.id,
    timestamp: persisted.timestamp,
    dateStr: persisted.dateStr,
    timeStr: persisted.timeStr,
    complianceRate: persisted.complianceRate,
    standardCount: persisted.standardCount,
    actualCount: persisted.actualCount,
    missingCount: persisted.missingCount,
    displacedCount: persisted.displacedCount,
    addedCount: persisted.addedCount ?? 0,
    thumbnailUrl: thumbUrl,
    anomalies: persisted.anomalies,
    tolerance: persisted.tolerance,
  };
}

/** Records from earlier versions may carry extra fields (e.g. tier split lines); they are ignored. */
function isBaselineRecord(data: PersistedBaseline | undefined): data is PersistedBaseline {
  return !!data && data.imageDimensions?.width > 0 && data.imageDimensions?.height > 0;
}

export function materializeImageBlob(data: PersistedBaseline): Blob | null {
  if (typeof Blob !== 'undefined' && data.imageBlob instanceof Blob) return data.imageBlob;
  if (data.imageBytes) {
    const bytes = data.imageBytes instanceof ArrayBuffer
      ? data.imageBytes
      : new Uint8Array(data.imageBytes as ArrayLike<number>).buffer;
    return new Blob([bytes], { type: data.imageType || 'image/jpeg' });
  }
  return null;
}

async function viewToPersistedBaseline(
  view: ShelfCalibration,
  asBytes: boolean,
): Promise<PersistedBaseline> {
  const imageBlob = await dataUrlToBlob(view.imageDataUrl);
  const base = {
    id: view.id,
    createdAt: view.createdAt,
    imageDimensions: view.imageDimensions,
    lensFocalLength: view.lensFocalLength ?? null,
  };
  if (!asBytes) {
    return { ...base, imageBlob };
  }
  return {
    ...base,
    imageBytes: await imageBlob.arrayBuffer(),
    imageType: imageBlob.type || 'image/jpeg',
  };
}

async function auditViewToPersisted(
  record: AuditRecord,
): Promise<PersistedAuditRecord> {
  const thumbnailBlob = await compressToJpegBlob(record.thumbnailUrl);
  return {
    id: record.id,
    timestamp: record.timestamp,
    dateStr: record.dateStr,
    timeStr: record.timeStr,
    complianceRate: record.complianceRate,
    standardCount: record.standardCount,
    actualCount: record.actualCount,
    missingCount: record.missingCount,
    displacedCount: record.displacedCount,
    addedCount: record.addedCount ?? 0,
    thumbnailBlob,
    anomalies: record.anomalies,
    tolerance: record.tolerance,
  };
}

/** One-way v1→v2 migration: legacy keys → shelf:0, Blobs, schema_version=2 (D-04). */
export async function runSchemaMigrationIfNeeded(): Promise<StorageWriteResult> {
  try {
    const version = await get<number>(KEY_SCHEMA_VERSION);
    if (version === CURRENT_SCHEMA) {
      return {ok: true};
    }

    const legacyBaseline = await get<ShelfCalibration>(LEGACY_KEY_BASELINE);
    const legacyHistory = await get<AuditRecord[]>(LEGACY_KEY_HISTORY);

    const entries: [string, unknown][] = [[KEY_SCHEMA_VERSION, CURRENT_SCHEMA]];

    if (legacyBaseline?.imageDataUrl) {
      const imageBlob = await dataUrlToBlob(legacyBaseline.imageDataUrl);
      const persisted: PersistedBaseline = {
        id: legacyBaseline.id,
        createdAt: legacyBaseline.createdAt,
        imageBlob,
        imageDimensions: legacyBaseline.imageDimensions,
      };
      entries.push([baselineKey(0), persisted]);
    }

    if (Array.isArray(legacyHistory) && legacyHistory.length > 0) {
      const persistedHistory: PersistedAuditRecord[] = await Promise.all(
        legacyHistory.map(async (record) => {
          const thumbnailBlob = record.thumbnailUrl.startsWith('data:')
            ? await dataUrlToBlob(record.thumbnailUrl)
            : await compressToJpegBlob(record.thumbnailUrl);
          return {
            id: record.id,
            timestamp: record.timestamp,
            dateStr: record.dateStr,
            timeStr: record.timeStr,
            complianceRate: record.complianceRate,
            standardCount: record.standardCount,
            actualCount: record.actualCount,
            missingCount: record.missingCount,
            displacedCount: record.displacedCount,
            addedCount: record.addedCount ?? 0,
            thumbnailBlob,
            anomalies: record.anomalies,
            tolerance: record.tolerance,
          };
        }),
      );
      entries.push([historyKey(0), persistedHistory]);
    }

    await setMany(entries);

    const legacyKeys: string[] = [];
    if (legacyBaseline) legacyKeys.push(LEGACY_KEY_BASELINE);
    if (Array.isArray(legacyHistory) && legacyHistory.length > 0) {
      legacyKeys.push(LEGACY_KEY_HISTORY);
    }
    if (legacyKeys.length > 0) {
      await delMany(legacyKeys);
    }

    return {ok: true};
  } catch (err) {
    if (isQuotaError(err)) {
      return {ok: false, error: 'QUOTA_EXCEEDED'};
    }
    console.error('Schema migration failed:', err);
    throw err;
  }
}

export async function loadBaselineRaw(
  shelfId: number,
): Promise<PersistedBaseline | null> {
  const id = validateShelfId(shelfId);
  try {
    const data = await get<PersistedBaseline>(baselineKey(id));
    if (isBaselineRecord(data)) {
      const imageBlob = materializeImageBlob(data);
      return imageBlob ? { ...data, imageBlob } : data;
    }
  } catch (err) {
    console.warn(
      `Failed to load baseline raw for shelf ${id}:`,
      err,
    );
  }
  return null;
}

export async function loadBaseline(
  shelfId: number,
  displayUrl = '',
): Promise<ShelfCalibration> {
  const data = await loadBaselineRaw(shelfId);
  if (data) {
    return toViewBaseline(data, displayUrl);
  }
  return DEFAULT_CALIBRATION;
}

export async function clearBaseline(
  shelfId: number,
): Promise<StorageWriteResult> {
  const id = validateShelfId(shelfId);
  try {
    await del(baselineKey(id));
    return {ok: true};
  } catch (err) {
    if (isQuotaError(err)) {
      return {ok: false, error: 'QUOTA_EXCEEDED'};
    }
    console.error(`Failed to clear baseline for shelf ${id}:`, err);
    throw err;
  }
}

export async function saveBaseline(
  shelfId: number,
  viewCalibration: ShelfCalibration,
): Promise<StorageWriteResult> {
  const id = validateShelfId(shelfId);
  try {
    try {
      await set(baselineKey(id), await viewToPersistedBaseline(viewCalibration, false));
      return {ok: true};
    } catch (err) {
      if (isQuotaError(err)) {
        return {ok: false, error: 'QUOTA_EXCEEDED'};
      }
      if (!isStructuredCloneError(err) && !/BlobURL/i.test(String(err))) {
        throw err;
      }
      await set(baselineKey(id), await viewToPersistedBaseline(viewCalibration, true));
      return {ok: true};
    }
  } catch (err) {
    if (isQuotaError(err)) {
      return {ok: false, error: 'QUOTA_EXCEEDED'};
    }
    console.error(`Failed to save baseline for shelf ${id}:`, err);
    throw err;
  }
}

export async function loadAuditHistoryRaw(
  shelfId: number,
): Promise<PersistedAuditRecord[]> {
  const id = validateShelfId(shelfId);
  try {
    const list = await get<PersistedAuditRecord[]>(historyKey(id));
    if (Array.isArray(list)) {
      return list;
    }
  } catch (err) {
    console.warn(`Failed to load audit history for shelf ${id}:`, err);
  }
  return [];
}

export async function loadAuditHistory(
  shelfId: number,
  thumbUrlResolver?: (blob: Blob, recordId: string) => string,
): Promise<AuditRecord[]> {
  const raw = await loadAuditHistoryRaw(shelfId);
  return raw.map((record) =>
    toViewAuditRecord(
      record,
      thumbUrlResolver
        ? thumbUrlResolver(record.thumbnailBlob, record.id)
        : '',
    ),
  );
}

export async function appendAuditRecord(
  shelfId: number,
  record: AuditRecord,
): Promise<StorageWriteResult> {
  const id = validateShelfId(shelfId);
  try {
    const existing = await loadAuditHistoryRaw(id);
    const persisted = await auditViewToPersisted(record);
    const updated = [persisted, ...existing].slice(0, HISTORY_CAP);
    await set(historyKey(id), updated);
    return {ok: true};
  } catch (err) {
    if (isQuotaError(err)) {
      return {ok: false, error: 'QUOTA_EXCEEDED'};
    }
    console.error(`Failed to append audit record for shelf ${id}:`, err);
    throw err;
  }
}

export async function loadActiveShelfId(): Promise<number> {
  try {
    const stored = await get<number>(KEY_ACTIVE_SHELF);
    if (typeof stored === 'number' && Number.isFinite(stored)) {
      return validateShelfId(stored);
    }
  } catch (err) {
    console.warn('Failed to load active shelf id:', err);
  }
  return 0;
}

export async function saveActiveShelfId(
  shelfId: number,
): Promise<StorageWriteResult> {
  const id = validateShelfId(shelfId);
  try {
    await set(KEY_ACTIVE_SHELF, id);
    return {ok: true};
  } catch (err) {
    if (isQuotaError(err)) {
      return {ok: false, error: 'QUOTA_EXCEEDED'};
    }
    console.error('Failed to save active shelf id:', err);
    throw err;
  }
}
