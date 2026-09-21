import {delMany, get, set, setMany} from 'idb-keyval';
import type {AuditRecord, ShelfCalibration} from '../types';
import type {
  PersistedAuditRecord,
  PersistedBaseline,
  StorageWriteResult,
} from '../types/persisted';
import {compressToJpegBlob, dataUrlToBlob, isQuotaError} from './blobUtils';
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
    splitYPercentages: persisted.splitYPercentages,
    tierLabels: persisted.tierLabels,
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
    thumbnailUrl: thumbUrl,
    anomalies: persisted.anomalies,
    tolerance: persisted.tolerance,
  };
}

function isValidSplitY(
  splits: unknown,
): splits is [number, number, number, number] {
  return (
    Array.isArray(splits) &&
    splits.length === 4 &&
    splits.every((n) => typeof n === 'number')
  );
}

async function viewToPersistedBaseline(
  view: ShelfCalibration,
): Promise<PersistedBaseline> {
  const imageBlob = await dataUrlToBlob(view.imageDataUrl);

  return {
    id: view.id,
    createdAt: view.createdAt,
    imageBlob,
    imageDimensions: view.imageDimensions,
    splitYPercentages: view.splitYPercentages,
    tierLabels: view.tierLabels,
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

    if (
      legacyBaseline &&
      isValidSplitY(legacyBaseline.splitYPercentages)
    ) {
      const imageBlob = await dataUrlToBlob(legacyBaseline.imageDataUrl);
      const persisted: PersistedBaseline = {
        id: legacyBaseline.id,
        createdAt: legacyBaseline.createdAt,
        imageBlob,
        imageDimensions: legacyBaseline.imageDimensions,
        splitYPercentages: legacyBaseline.splitYPercentages,
        tierLabels: legacyBaseline.tierLabels,
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

export async function loadBaseline(
  shelfId: number,
  displayUrl = '',
): Promise<ShelfCalibration> {
  const id = validateShelfId(shelfId);
  try {
    const data = await get<PersistedBaseline>(baselineKey(id));
    if (data && isValidSplitY(data.splitYPercentages)) {
      return toViewBaseline(data, displayUrl);
    }
  } catch (err) {
    console.warn(
      `Failed to load baseline for shelf ${id}, using default:`,
      err,
    );
  }
  return DEFAULT_CALIBRATION;
}

export async function saveBaseline(
  shelfId: number,
  viewCalibration: ShelfCalibration,
): Promise<StorageWriteResult> {
  const id = validateShelfId(shelfId);
  try {
    const persisted = await viewToPersistedBaseline(viewCalibration);
    await set(baselineKey(id), persisted);
    return {ok: true};
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
  thumbUrlResolver?: (blob: Blob) => string,
): Promise<AuditRecord[]> {
  const raw = await loadAuditHistoryRaw(shelfId);
  return raw.map((record) =>
    toViewAuditRecord(
      record,
      thumbUrlResolver ? thumbUrlResolver(record.thumbnailBlob) : '',
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
