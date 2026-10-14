# Language toggle

Cycles the UI among Italian, English, and Chinese from the **IT** / **EN** / **CN** control in the camera header.

## Sub-features

- `lang-cycle` — each tap advances IT → EN → CN → IT
- `lang-persist` — choice saved to local storage (survives reload)

## How to get to it (user POV)

- On the camera screen, tap the language chip (`[data-testid="language-toggle"]`)

## Driving it with control-shelfguard

Preconditions:

- Preview at `http://127.0.0.1:4173`

Manual Playwright steps (no dedicated `browser drive` yet):

- Click `[data-testid="language-toggle"]` until `[data-testid="app-title"]` reflects English copy (**Online Marketplace** shelf inspection title from `I18N.en`)
- Screenshot for proof

## Gotchas

- Default first load is **Italian**; ARIA labels for shutter/gallery follow the active language
- After switching language, update selectors to the matching `I18N.*` strings
- Not covered by the bundled `browser drive` commands; add a drive recipe here if this flow becomes critical
