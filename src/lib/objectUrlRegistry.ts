/** Tracks blob object URLs and revokes them on shelf switch / unmount (D-07). */
export function createDisplayUrlRegistry() {
  const urls = new Map<string, string>();

  function set(key: string, blob: Blob): string {
    if (!(blob instanceof Blob)) {
      return '';
    }
    revoke(key);
    const url = URL.createObjectURL(blob);
    urls.set(key, url);
    return url;
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
