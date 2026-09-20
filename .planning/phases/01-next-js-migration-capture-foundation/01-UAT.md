---
status: partial
phase: 01-next-js-migration-capture-foundation
source: [01-VERIFICATION.md, autonomous-self-verify 2026-09-20, autonomous-self-verify 2026-09-20T21:52Z https://shelf-guard-pearl.vercel.app/, human-verify 2026-09-21]
started: 2026-09-20T18:30:00Z
updated: 2026-09-21T00:08:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Install PWA from Vercel preview and verify offline app shell
expected: PWA installs; offline reload serves cached shell; demo capture + analysis completes without network
result: issue
reported: "Human 2026-09-21: PWA install + offline reload OK on https://shelf-guard-pearl.vercel.app/. Demo shutter tap — no results appeared."
severity: major
note: "Install/offline sub-criteria human-pass. Demo capture sub-criteria fail — matches autonomous SecurityError: canvas tainted by cross-origin googleusercontent baseline (toDataURL). CAM-09 unit tests use data: URLs and do not catch this."

### 2. Deny camera permission on iOS Safari standalone PWA
expected: Inline banner shows cameraPermissionDenied headline and cameraErrorIosGuide body; demo feed remains usable
result: blocked
blocked_by: physical-device
reason: "Requires iOS Safari standalone PWA on physical device. Autonomous proxy: CameraView.error.test.tsx 3/3 pass (无法访问摄像头 + Safari iOS guide copy)."

### 3. Tap shutter with analyzeShelfCapture delayed >800ms
expected: UI transitions to PROCESSING overlay before results appear
result: pass
source: automated
note: "App.processing.integration.test.tsx 1/1 pass — PROCESSING overlay with 正在分析展架差异 copy at 800ms."

### 4. View offline pill at 320px viewport width
expected: Offline indicator text does not clip and does not overlap shutter control
result: pass
source: automated
note: "Playwright on Vercel at 320×640: bottom-28, verticalGap +4px, clearsShutter true. OfflineIndicator.test.tsx 3/3 pass."

## Summary

total: 4
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 1

## Gaps

- gap_id: G-01-7
  truth: "Demo capture + analysis completes on production Vercel (PWA-01 / CAM-09 runtime)"
  status: failed
  reason: "Human: shutter tap produced no results on shelf-guard-pearl.vercel.app. Autonomous: HTMLCanvasElement.toDataURL SecurityError — canvas tainted by cross-origin DEFAULT_SHELF_IMAGE_URL (googleusercontent.com) without crossOrigin on Image."
  severity: major
  test: 1
  artifacts:
    - path: src/hooks/useCameraStream.ts
      issue: captureDemoFrameFromUrl loads external URL without img.crossOrigin
    - path: src/lib/constants.ts
      issue: DEFAULT_SHELF_IMAGE_URL is cross-origin CDN
  missing:
    - "Set img.crossOrigin='anonymous' for http(s) baseline URLs, or ship baseline as same-origin /public asset"
