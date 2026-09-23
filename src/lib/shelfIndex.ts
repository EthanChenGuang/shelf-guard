const SHELF_COUNT = 5;

/** Clamp shelf index to 0–4 before storage writes (T-05-04). */
export function clampShelfIndex(index: number): number {
  return Math.max(0, Math.min(SHELF_COUNT - 1, Math.floor(index)));
}

export function nextShelfIndex(current: number): number {
  return (clampShelfIndex(current) + 1) % SHELF_COUNT;
}

export function prevShelfIndex(current: number): number {
  return (clampShelfIndex(current) - 1 + SHELF_COUNT) % SHELF_COUNT;
}
