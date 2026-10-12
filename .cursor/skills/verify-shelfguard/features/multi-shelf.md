# Multi-shelf switch

Five shelves (**Scaffale 1**–**5**) each store their own baseline and audit history in IndexedDB.

## Sub-features

- `shelf-select` — tap a carousel tab (dot) under the camera top bar
- `shelf-isolation` — baseline state is per shelf (new shelf shows **Nessun riferimento**)

## How to get to it (user POV)

- On the camera screen, use the five-dot carousel (`[data-testid="shelf-carousel"]`)
- Each tab’s accessible name is **Scaffale 1** … **Scaffale 5** in Italian (or **Shelf n** / **柜架 n** after language toggle)
- Tap another shelf to switch context; wait for the baseline pill to hydrate again

## Driving it with control-shelfguard

Preconditions:

- Preview at `http://127.0.0.1:4173`
- Fresh browser context (empty IndexedDB) so shelf 2 has no baseline

- **Select shelf 2.** Run `browser drive multi-shelf`. Click `[data-testid="shelf-carousel"]` tab **Scaffale 2**.
- **Wait for hydration.** Switching shelves reloads IndexedDB; the pill is blank until ready.
- **Assert isolation.** `[data-testid="baseline-status-pill"]` shows **Nessun riferimento** for shelf 2.
- **Proof.** Screenshot `multi-shelf-2-empty-baseline.png`.

## Gotchas

- The carousel is `role="tablist"` dots, not numbered **Shelf 1** buttons (`ShelfSelector` is unused on camera)
- Swipe is only enabled in `CAMERA_IDLE`; click the tab for stable automation
- After a shelf change, wait for hydration before reading the baseline pill
- IndexedDB persists in the browser profile; always use a new Playwright context per verification run
