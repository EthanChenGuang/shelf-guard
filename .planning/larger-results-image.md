# Larger results image (feat/larger-results-image)

Measured with the verify-shelfguard harness (`i-image-size-no-hoverflow` / "image size" table in
`cross-platform-report.txt` and `inspect-scan-zoom-report.txt`): `inspect-image-viewport` rect at the
initial scroll, fixture `capture-displaced.jpg` (portrait 9:16).

Artifacts: `/opt/cursor/artifacts/verify-shelfguard/larger-results-image-20261015-104545/{before,after}/`

## Sizing rule

| | before (main f6b827c) | after |
|---|---|---|
| max height | `100dvh - 8.75rem (header/HUD) - hint strip` | `100dvh - hint strip - 0.5rem - safe-area top/bottom` (`100vh` fallback via `@supports`) |
| max width | `min(100%, 28rem)` | `100% - max(1rem, safe-area-left) - max(1rem, safe-area-right)` |
| hint strip | 4.35rem portrait / 2.65rem landscape | unchanged |

When the photo is scrolled so its top is at the viewport top, photo + one-line hint fit the viewport.

## Before / after (cross-platform harness)

| device / orientation | viewport | before image | before area | after image | after area | gain (area) |
|---|---|---|---|---|---|---|
| iPhone 14 portrait (WebKit) | 390x664 | 256x454 | 44.8% | 330x586 | 74.7% | 1.67x |
| iPhone 14 landscape (WebKit) | 750x340 | 89x158 | 5.5% | 163x290 | 18.5% | 3.36x |
| iPhone 15 Pro Max portrait (WebKit) | 430x739 | 298x529 | 49.6% | 372x661 | 77.4% | 1.56x |
| iPhone 15 Pro Max landscape (WebKit) | 814x380 | 111x198 | 7.1% | 185x330 | 19.8% | 2.78x |
| Pixel 7 portrait (Chromium) | 412x839 | 354x629 | 64.5% | 380x676 | 74.3% | 1.15x |
| Pixel 7 landscape (Chromium) | 863x360 | 100x178 | 5.7% | 174x310 | 17.4% | 3.03x |
| Galaxy S9+ portrait (Chromium) | 320x658 | 252x448 | 53.7% | 288x512 | 70.0% | 1.30x |
| Galaxy S9+ landscape (Chromium) | 658x320 | 77x138 | 5.1% | 152x270 | 19.4% | 3.85x |

## Before / after (inspect-scan, Chromium fixed viewports)

| viewport | before image | before area | after image | after area |
|---|---|---|---|---|
| 390x844 portrait | 357x634 | 68.8% | 358x636 | 69.2% |
| 844x390 landscape | 117x208 | 7.4% | 191x340 | 19.7% |
| 932x430 landscape | 139x248 | 8.6% | 214x380 | 20.2% |

(390x844 was already width-capped at 100%; the 1rem gutter keeps it about the same.)

## Notes

- First attempt used a 0.5rem gutter. Pixel 7 / Galaxy S9+ portrait then failed `a-page` / `g-page`,
  because the photo filled the width and no off-photo point was left to start a page swipe
  (`after-attempt1-0.5rem-gutter/`). A 1rem gutter (same as the header `px-4`) fixed it without
  touching the check.
- A landscape photo is still height-bound: a 9:16 photo on a ~320–430px-tall screen can't get much
  bigger and still show the hint below it in one screen.
