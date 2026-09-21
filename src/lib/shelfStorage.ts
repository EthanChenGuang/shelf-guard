/** RED stub — replaced in GREEN commit. */
export async function runSchemaMigrationIfNeeded() {
  return {ok: false as const, error: 'QUOTA_EXCEEDED' as const};
}

export async function loadBaseline(_shelfId: number, _displayUrl = '') {
  throw new Error('NOT_IMPLEMENTED');
}

export async function saveBaseline(_shelfId: number, _calibration: unknown) {
  return {ok: false as const, error: 'QUOTA_EXCEEDED' as const};
}

export async function loadAuditHistoryRaw(_shelfId: number) {
  return [];
}

export async function appendAuditRecord(_shelfId: number, _record: unknown) {
  return {ok: false as const, error: 'QUOTA_EXCEEDED' as const};
}

export async function loadActiveShelfId() {
  return -1;
}

export async function saveActiveShelfId(_shelfId: number) {
  return {ok: false as const, error: 'QUOTA_EXCEEDED' as const};
}

export function toViewBaseline() {
  throw new Error('NOT_IMPLEMENTED');
}

export function toViewAuditRecord() {
  throw new Error('NOT_IMPLEMENTED');
}
