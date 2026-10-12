/** React/jsdom TouchList may expose `.item` or only numeric indices. */
export function touchAt(
  touches: { length: number; item?: (index: number) => { clientX: number; clientY: number } | null } | ArrayLike<{ clientX: number; clientY: number }>,
  index: number,
): { clientX: number; clientY: number } | null {
  const list = touches as { item?: (i: number) => { clientX: number; clientY: number } | null };
  if (typeof list.item === 'function') {
    const fromItem = list.item(index);
    if (fromItem) return fromItem;
  }
  const fallback = (touches as ArrayLike<{ clientX: number; clientY: number } | undefined>)[index];
  return fallback ?? null;
}
