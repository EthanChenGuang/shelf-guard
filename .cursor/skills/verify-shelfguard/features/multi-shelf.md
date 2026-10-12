# Multi-shelf switch

Five numbered shelves (**Scaffale 1**–**5**) each store their own baseline and audit history in IndexedDB.

## Sub-features

- `shelf-select` — tap a shelf number in the header carousel
- `shelf-isolation` — baseline state is per shelf (new shelf shows **Nessun riferimento**)

## How to get to it (user POV)

- On the camera screen, use the shelf selector chips labeled **1**–**5** (ARIA **Shelf 1** … **Shelf 5**)
- Tap another shelf to switch context

## Driving it with control-shelfguard

Preconditions:

- Preview at `http://127.0.0.1:4173`
- Shelf 1 may already have a baseline from a prior step in the same context; switching to shelf 2 expects a clean baseline state

- **Select shelf 2.** Run `browser drive multi-shelf`. Click `[aria-label="Shelf 2"]`.
- **Assert isolation.** `[data-testid="baseline-status-pill"]` shows **Nessun riferimento** for shelf 2.
- **Proof.** Screenshot `multi-shelf-2-empty-baseline.png`.

## Gotchas

- Swipe carousel is only enabled in `CAMERA_IDLE`; use numbered buttons for stable automation
- Establishing a baseline on shelf 2 requires a fresh drive or manual upload after switch
- IndexedDB persists in the browser profile; always use a new Playwright context per verification run
