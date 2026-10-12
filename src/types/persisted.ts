import type {DetectedAnomaly, ToleranceLevel, ToleranceValue} from '../types';

/** IndexedDB baseline record — image stored as Blob, not data URL (D-05). */
export interface PersistedBaseline {
  id: string;
  createdAt: number;
  /** Preferred. Playwright WebKit cannot structured-clone Blob; then `imageBytes` is used. */
  imageBlob?: Blob;
  /** ArrayBuffer fallback when the engine cannot clone Blob (WebKit MiniBrowser). */
  imageBytes?: ArrayBuffer;
  imageType?: string;
  imageDimensions: {width: number; height: number};
  lensFocalLength?: number | null;
}

/** IndexedDB audit record — thumbnail stored as Blob, not data URL (D-08). */
export interface PersistedAuditRecord {
  id: string;
  timestamp: number;
  dateStr: string;
  timeStr: string;
  complianceRate: number;
  standardCount: number;
  actualCount: number;
  missingCount: number;
  displacedCount: number;
  /** Absent on records saved before added items were counted. */
  addedCount?: number;
  thumbnailBlob: Blob;
  anomalies: DetectedAnomaly[];
  tolerance: ToleranceValue | ToleranceLevel;
}

export type StorageWriteResult =
  | {ok: true}
  | {ok: false; error: 'QUOTA_EXCEEDED'};
