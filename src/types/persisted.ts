import type {DetectedAnomaly, ToleranceLevel, ToleranceValue} from '../types';

/** IndexedDB baseline record — image stored as Blob, not data URL (D-05). */
export interface PersistedBaseline {
  id: string;
  createdAt: number;
  imageBlob: Blob;
  imageDimensions: {width: number; height: number};
  splitYPercentages: [number, number, number, number];
  tierLabels: [string, string, string, string];
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
  thumbnailBlob: Blob;
  anomalies: DetectedAnomaly[];
  tolerance: ToleranceValue | ToleranceLevel;
}

export type StorageWriteResult =
  | {ok: true}
  | {ok: false; error: 'QUOTA_EXCEEDED'};
