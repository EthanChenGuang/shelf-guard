function isBlobLike(value: unknown): value is Blob {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Blob).size === 'number' &&
    typeof (value as Blob).type === 'string'
  );
}

/** Tracks blob object URLs and revokes them on shelf switch / unmount (D-07). */
export function createDisplayUrlRegistry() {
  const urls = new Map<string, string>();

  function set(key: string, blob: Blob): string {
    if (!isBlobLike(blob)) {
      return '';
    }
    revoke(key);
    try {
      const url = URL.createObjectURL(blob);
      urls.set(key, url);
      return url;
    } catch {
      return '';
    }
  }

  function revoke(key: string): void {
    const existing = urls.get(key);
    if (existing) {
      URL.revokeObjectURL(existing);
      urls.delete(key);
    }
  }

  function revokeAll(): void {
    for (const url of urls.values()) {
      URL.revokeObjectURL(url);
    }
    urls.clear();
  }

  return {set, revoke, revokeAll};
}
