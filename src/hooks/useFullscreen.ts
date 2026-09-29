import { useCallback, useEffect, useState } from 'react';

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

function fullscreenElement(doc: WebkitDocument): Element | null {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * Whole-page full screen (hides the browser's address and navigation bars). `supported` is false
 * where the page cannot go full screen, e.g. Safari on iPhone.
 */
export function useFullscreen(): { supported: boolean; isFullscreen: boolean; toggle: () => void } {
  const doc = document as WebkitDocument;
  const supported = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
  const [isFullscreen, setIsFullscreen] = useState(() => fullscreenElement(doc) !== null);

  useEffect(() => {
    const sync = () => setIsFullscreen(fullscreenElement(doc) !== null);
    doc.addEventListener('fullscreenchange', sync);
    doc.addEventListener('webkitfullscreenchange', sync);
    return () => {
      doc.removeEventListener('fullscreenchange', sync);
      doc.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [doc]);

  const toggle = useCallback(() => {
    const run = async () => {
      if (fullscreenElement(doc)) {
        await (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
        return;
      }
      const root = doc.documentElement as WebkitElement;
      await (root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen?.());
    };
    run().catch((err) => console.warn('Full screen request failed:', err));
  }, [doc]);

  return { supported, isFullscreen, toggle };
}
