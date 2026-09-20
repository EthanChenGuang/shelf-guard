# Feature Research

**Domain:** Retail shelf inspection / planogram compliance audit (mobile & PWA)
**Researched:** 2026-09-20
**Confidence:** MEDIUM (industry patterns corroborated across multiple vendor sources; individual vendor claims unverified)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy in the aisle.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Guided photo capture** | Reps cannot produce comparable images without angle/distance/framing hints; every major product (ShelfAlign, Tevian, FORM) advertises "smart camera guidance" | MEDIUM | Testable: capture rejected or warned when blur/glare/tilt exceeds threshold; optional overlay frame for fixture bounds |
| **Reference baseline comparison** | Audit means "compare reality to approved layout"; Planofy/LEAFIO/Asseco all compare shelf photo to stored planogram or reference image | MEDIUM | ShelfGuard uses per-fixture baseline photo (not SKU catalog planogram) — valid for fixed-display retail |
| **Visual anomaly map on result screen** | Users must see *where* problems are without re-walking the bay; LEAFIO marks mismatches on-image; Scandit uses AR highlights | MEDIUM | Testable: each flagged issue has bounding region + type label (missing / displaced / gap) |
| **Missing & displaced detection (at minimum)** | Core compliance questions are "what's gone?" and "what moved?"; universal across ShelfAlign, Tevian, MileApp, fAIcing | HIGH | v1 can use pixel/region diff per ROI tier before SKU IR; must not return static mock results |
| **Pass/fail or compliance summary** | Managers and reps need a single number or status to decide whether to fix now; FORM/ShelfAlign expose compliance % | LOW | Testable: summary updates when tolerance slider changes; shows count by severity |
| **Sub-60-second in-aisle loop** | Field time is expensive; Planofy cites 10–15 min manual → ~20 sec; ShelfGuard PRD targets 30 sec | MEDIUM | Testable: capture → result < 30 s on mid-tier phone with client-side pipeline |
| **Capture quality gate** | Bad photos cause false alarms; Tevian explicitly checks glare, blur, angle before analysis | MEDIUM | Testable: block or warn on blur score, extreme tilt (> ±1.5° if level gauge used), underexposure |
| **Reference alignment aid (ghost overlay or equivalent)** | Fixed-camera workflows require verifying same viewpoint before diff; industry uses reference overlay, AR guides, or homography preview | MEDIUM | Ghost overlay + opacity slider is table stakes for *fixed-fixture* audit, not a differentiator |
| **Per-fixture or per-shelf data isolation** | Multi-bay stores need separate baselines and histories; enterprise apps scope by store/visit/fixture | LOW | ShelfGuard: 5 independent shelf units with swipe — matches expectation |
| **Audit history with timestamp + thumbnail** | Proof of execution and trend tracking; all field apps retain visit photos | LOW | Testable: each audit stores ISO timestamp, shelf ID, thumbnail, anomaly count |
| **Offline-first capture & analysis** | Aisle Wi-Fi is unreliable; Eyrene, fAIcing CCU case, Trax on-device IR, ShelfSet hybrid all support offline | MEDIUM | v1 PWA: baseline, capture, client diff, history must work without network |
| **Adjustable sensitivity / tolerance** | Lighting and minor shifts differ daily; without tolerance, false positives erode trust (shelfanalytics.org threshold tuning) | LOW | Testable: same capture yields fewer flags at high tolerance, more at low |
| **Before/after or blink comparison** | Reps validate flags visually when AI is uncertain; standard in photo-diff workflows | LOW | Long-press blink compare between baseline and capture |
| **First-run baseline setup flow** | Cannot audit without reference; users expect wizard when no baseline exists | LOW | INITIAL_GUIDE when shelf has no calibrated baseline |
| **Bilingual UI (for APAC retail ops)** | Store staff switch languages; expected in multi-market deployments | LOW | zh/en toggle persists |

### Differentiators (Competitive Advantage)

Features that set a product apart. Not required to be "an audit app," but create competitive moat or align with ShelfGuard's core value (30-second clarity on missing/displaced).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Fixed-position ghost overlay + level gauge combo** | Faster re-alignment than free-form enterprise capture; reduces registration error for same-fixture re-shoots | MEDIUM | ShelfGuard differentiator vs generic "take a shelf photo" apps — measurable: fewer false positives when level within ±1.5° |
| **Row/zone-scoped ROI calibration (4-tier dividers)** | Surfaces *which shelf row* changed without full SKU IR; lighter than Tevian stitch + SKU detect | MEDIUM | Maps to planogram "shelf rows"; testable: anomalies tagged with `rowIndex` 1–4 |
| **Hybrid client diff + optional cloud vision (Gemini)** | Offline speed for first pass, AI precision for ambiguous cases — uncommon in single-vendor enterprise stacks | HIGH | v1.x differentiator; defer full Gemini to post pixel-diff validation |
| **Zero-backend single-device PWA** | No IT integration for pilot stores; contrasts with Trax/FORM/Pensa SaaS | LOW | Trade-off: no HQ dashboard — acceptable for v1 per PROJECT.md |
| **Instant local feedback (no upload wait)** | Trax cloud path takes minutes in legacy mode; on-device IR is enterprise-only | MEDIUM | Client-side Canvas diff as v1 primary path |
| **Multi-fixture swipe UX (5 shelves)** | Cleaner than re-selecting store/fixture in enterprise task apps | LOW | UX differentiator for cosmetics display units with multiple bays |
| **Scan-line processing ritual + stat capsule** | Reinforces "scan complete" trust cue; polish that commodity audit apps lack | LOW | UI/UX differentiator aligned with PRD |
| **SKU-level recognition at scale** | Identifies exact SKU, facings, OOS — Trax/FORM/Pensa core enterprise value | VERY HIGH | v2+ for ShelfGuard; not v1 differentiator |
| **Share-of-shelf & competitor detection** | Category management KPI; Asseco RIR, ShelfSet, Trax | VERY HIGH | Out of ShelfGuard v1 scope |
| **Price tag OCR & promo compliance** | Revenue leakage detection; Scandit, Tevian, Pensa | HIGH | Anti-scope for v1 |
| **AR continuous scanning (no shutter)** | Trax on-device AR mode — immersive but heavy | VERY HIGH | Explicitly out of scope (photo-only) |
| **HQ dashboard + multi-store analytics** | Enterprise buyer requirement | HIGH | v2+ / out of scope v1 |
| **Auto planogram generation from photos** | FORM Pic&Plan, Pensa — reduces planogram authoring cost | VERY HIGH | v2+ consideration |
| **Next-best-action task routing** | Pensa/Trax workflow automation | HIGH | v2+ with backend |
| **Photo stitching for long bays** | Scientific Reports 2025 pipeline; Tevian multi-photo stitch | HIGH | v2 if single frame cannot cover fixture |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for v1 or for ShelfGuard's fixed-fixture model.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full SKU catalog recognition in v1** | "Real planogram compliance" sounds like SKU ID | Requires massive labeled dataset, per-market SKU onboarding, GPU; false SKU swaps erode trust more than pixel diff | v1: region-level missing/displaced via baseline diff + ROI tiers; v2: optional Gemini or IR for ambiguous zones |
| **Real-time video stream analysis** | Feels futuristic | Battery drain, heat, jittery false positives, complex on mobile web | Single shutter capture with 0.8s scan animation |
| **Multi-store SaaS + user auth in v1** | HQ wants visibility | Scope explosion; distracts from 30-sec core loop and PRD UI fidelity | Local IndexedDB v1; export/share or backend v2 |
| **Automatic planogram import from PDF** | Merchandisers have PDF planograms | PDF-to-realogram gap is why Asseco says "planograms are ignored"; misalignment with actual fixture | Capture-on-site baseline photo as ground truth |
| **Zero false positives guarantee** | Buyers hate noise | Impossible with lighting, customer pickup, reflection; leads to endless threshold tuning | User-adjustable tolerance + blink compare + row-scoped thresholds |
| **Cloud-only analysis pipeline** | Easier model deployment | Fails offline; adds 5–60s latency | Client-first diff; optional Gemini when online |
| **Unbounded audit history storage** | "Keep everything" | IndexedDB bloat (CONCERNS.md: 50MB+ with thumbnails) | Cap history per shelf (e.g., 50), compress thumbnails |
| **Competitive intelligence / share-of-shelf** | Category managers want it | Requires competitor SKU training data unrelated to display compliance | Stay on own-assortment change detection |
| **Price compliance & OCR** | Retail standard in enterprise IR | Different CV problem; scope creep | Defer entirely |
| **Homography-free diff on handheld re-shoot** | Skip alignment UX | Viewpoint change dominates signal; research (Nature Sci Reports 2025) shows partial capture breaks compliance | Fixed tripod/stand + ghost overlay + level gauge |
| **Single global tolerance for all rows** | Simpler settings | Top rows get glare; bottom rows get shadows — one threshold fails | Per-ROI-tier calibration (ShelfGuard 4-row model) |
| **Demo/mock analysis in production path** | Speeds UI dev | Destroys trust — current `analyzeShelfCapture()` mock issue | Feature-flag demo only; real diff in production |

## Feature Dependencies

```
Baseline photo capture
    └──requires──> ROI tier calibration (split lines)
                       └──requires──> Ghost overlay alignment preview
                                              └──requires──> Level gauge within tolerance

Capture quality gate
    └──requires──> Camera stream + level gauge
    └──blocks──> Reliable pixel diff

Pixel diff (client)
    └──requires──> Baseline + aligned capture + ROI tiers
    └──enhances──> Optional Gemini refinement (ambiguous regions only)

Multi-shelf (5 units)
    └──requires──> Per-shelf baseline + history keys in storage
    └──conflicts──> Single global baseline (legacy model)

Audit history
    └──requires──> Successful analysis run + shelf ID

INITIAL_GUIDE
    └──requires──> Empty/default baseline detection
    └──conflicts──> Silent demo baseline (current brownfield gap)

Optional Gemini vision
    └──requires──> Working client diff pipeline + API key
    └──conflicts──> Offline-only mode (must degrade gracefully)
```

### Dependency Notes

- **ROI calibration requires baseline:** Row dividers are meaningless without a reference image defining the fixture bounds.
- **Ghost overlay enhances alignment, not detection alone:** Overlay is for human/algorithm registration; detection runs after alignment confirmation.
- **Gemini conflicts with offline-only:** Must skip or queue; never block the 30-second loop on network.
- **Multi-shelf conflicts with single-shelf data model:** Migration needed for 5 isolated `ShelfCalibration` records.

## MVP Definition

Scoped to **ShelfGuard** (fixed-display, 5 fixtures, local PWA) with explicit v1 / v1.x / v2 guidance.

### Launch With (v1)

Minimum viable product — validates "30-second clarity on missing/displaced" without enterprise IR.

- [ ] **Three-view FSM** (camera → ROI config → result) — core workflow container; test: mode transitions match PRD states
- [ ] **5-shelf swipe with isolated baseline + history** — multi-fixture table stakes for target stores
- [ ] **Ghost overlay with opacity control** — alignment before capture; test: overlay tracks baseline image per shelf
- [ ] **Level gauge (±1.5° snap + haptic)** — capture quality gate; test: shutter disabled or warned outside tolerance
- [ ] **4-row ROI draggable dividers** — zone-scoped analysis; test: divider positions persist per shelf baseline
- [ ] **Real client-side pixel diff** (replace mock) — detects missing/displaced by ROI; test: moved object changes bounding boxes; clean shelf → zero anomalies
- [ ] **Result annotations** (red/yellow boxes, tap dismiss, stat capsule) — actionable visual map; test: counts match visible boxes
- [ ] **Blink compare on result** — human verification; test: long-press toggles baseline/capture
- [ ] **Tolerance slider with live re-analysis** — false positive control; test: anomaly count monotonic vs tolerance
- [ ] **Audit history per shelf** (timestamp, thumbnail, counts) — proof of patrol; test: new audit prepends, cap enforced
- [ ] **INITIAL_GUIDE when no baseline** — first-run path; test: fresh install routes to calibration, not silent demo
- [ ] **Offline PWA shell** — aisle-ready; test: airplane mode completes full audit loop
- [ ] **PRD UI/UX fidelity** (Minimalist Light tokens, scan line 0.8s, i18n) — user-stated v1 priority

### Add After Validation (v1.x)

Features to add once pixel diff accuracy is validated on real fixture photos.

- [ ] **Optional Gemini Vision pass** — trigger: client diff confidence low or user opt-in; refine ambiguous regions only
- [ ] **Capture-from-camera for new baseline** — trigger: field ops need live re-baseline without upload
- [ ] **Per-row tolerance presets** — trigger: top-row glare drives false positives despite global slider
- [ ] **Export audit report** (PDF/image share) — trigger: store manager wants proof outside app
- [ ] **Bundled default baseline in `public/`** — trigger: offline CDN failure for demo image
- [ ] **Homography auto-align** — trigger: slight viewpoint drift causes diff noise even with ghost overlay

### Future Consideration (v2+)

Defer until product-market fit with single-store PWA.

- [ ] **Backend sync + multi-store dashboard** — HQ visibility; requires auth, API, privacy policy
- [ ] **SKU-level IR** — integration with product master data
- [ ] **Share-of-shelf / competitor facings** — category analytics
- [ ] **Price & promo compliance** — separate CV pipeline
- [ ] **Task management / corrective action tickets** — Pensa-style workflow
- [ ] **SFA/ERP integrations** — enterprise sales execution stack
- [ ] **Photo stitching for wide bays** — when single frame insufficient
- [ ] **Native app store distribution** — if PWA camera limits block target devices

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Real pixel diff (replace mock) | HIGH | MEDIUM | P1 |
| 5-shelf isolated data + swipe UI | HIGH | MEDIUM | P1 |
| Ghost overlay + level gauge | HIGH | LOW (exists) | P1 |
| 4-row ROI calibration | HIGH | LOW (exists) | P1 |
| Result annotations + blink compare | HIGH | LOW (exists) | P1 |
| INITIAL_GUIDE first-run | HIGH | LOW | P1 |
| PRD UI/UX alignment | HIGH | MEDIUM | P1 |
| Tolerance slider live re-analysis | HIGH | LOW (exists) | P1 |
| Audit history per shelf | MEDIUM | LOW (exists) | P1 |
| Capture quality gate (blur/glare) | HIGH | MEDIUM | P2 |
| Optional Gemini refinement | MEDIUM | MEDIUM | P2 (v1.x) |
| Per-row tolerance | MEDIUM | LOW | P2 |
| Export/share report | MEDIUM | LOW | P2 |
| Homography auto-align | MEDIUM | HIGH | P3 |
| Backend + dashboard | HIGH (enterprise) | VERY HIGH | P3 (v2) |
| SKU-level IR | HIGH (enterprise) | VERY HIGH | P3 (v2) |

**Priority key:**
- P1: Must have for v1 launch
- P2: Should have in v1.x after core diff validated
- P3: Future / enterprise tier

## Competitor Feature Analysis

| Feature | Enterprise IR (Trax/FORM) | Store-team photo audit (Planofy/ShelfAlign) | ShelfGuard Approach |
|---------|---------------------------|---------------------------------------------|---------------------|
| Detection method | SKU IR vs planogram library | SKU IR vs planogram + cloud CV | Baseline photo pixel diff + ROI tiers; optional Gemini |
| Capture mode | AR scan or multi-photo stitch | Guided single photo | Fixed-position single photo + ghost overlay |
| Time to result | Seconds (on-device) to minutes (cloud) | ~3–20 seconds claimed | Target < 30 seconds client-side |
| Offline | On-device IR (premium) | Partial (ShelfSet hybrid) | Full offline v1 |
| Multi-fixture | Store/visit scoped in task app | Store network scale | 5 local shelves, swipe UX |
| Alignment aid | AR + angle hints | Smart camera guidance | Ghost overlay + level gauge |
| Action workflow | Next-best-action tasks | Task integration optional | Visual map only v1; no task routing |
| HQ analytics | Core product | Web dashboard | Deferred v2 |
| Price/promo | Yes | Some | Out of scope |
| Share of shelf | Yes | Yes | Out of scope |

## v1 Expected Behavior Summary

For downstream milestone research (multi-shelf, ghost overlay, ROI calibration, anomaly detection):

| Capability | v1 Expected Behavior | Not in v1 |
|------------|---------------------|-----------|
| **Multi-shelf** | 5 shelves, each with own baseline, ROI splits, history; swipe switches context instantly | Cross-shelf analytics, copy baseline between shelves |
| **Ghost overlay** | Show baseline semi-transparent over live preview; user adjusts opacity; alignment is manual with level aid | Auto homography warp of live feed |
| **ROI tier calibration** | User sets 4 horizontal bands on baseline; diff computed per band; anomalies inherit row index | Auto row detection from shelf rails |
| **Anomaly detection** | Client diff flags region-level missing (empty vs baseline) and displaced (changed blob position) within ROI; tolerance filters noise | SKU identity, facing count, price errors |
| **Gemini** | Off by default; optional second pass on flagged crops if enabled and online | Primary detection path |

## Sources

- [ShelfAlign](https://www.shelfalign.com/) — guided capture, planogram compliance, offline sync
- [FORM / GoSpotCheck IR Planogram Compliance](https://www.form.com/ir-planogram-compliance/) — compliance scoring, Pic&Plan
- [Planofy (Bluesoft)](https://bluesoft.com/product/planofy/) — store-team photo audit, realogram
- [Tevian Shelf Audit](https://tevian.ai/en/products/shelf-audit/) — quality gate, planogram compare
- [Asseco Retail Image Recognition](https://assecoplatform.com/retail-image-recognition/) — planogram 360°, AR, offline
- [Scandit Planogram & Price Compliance](https://www.scandit.com/solutions/planogram-and-price-compliance/) — AR overlay guidance
- [LEAFIO AI Planogram Recognition](https://www.leafio.ai/ai-planogram-image-recognition/) — visual compliance reports
- [Trax On-Device IR](https://traxretail.com/solutions/trax-image-recognition/on-device-ir/) — AR scan, offline IR
- [Pensa Systems](https://pensasystems.com/) — Vision AI workflows
- [fAIcing / IntellIA](https://intellia.online/en/solutions/faicing/) — offline Android IR case study
- [MileApp Merchandising AI](https://mile.app/en/solutions/merchandising-ai/) — compliance + availability from photos
- [Nature Sci Reports — planogram CV pipeline](https://www.nature.com/articles/s41598-025-27773-5) — partial capture, viewpoint challenges
- [Shelf Analytics — false positive / threshold tuning](https://www.shelfanalytics.org/planogram-sync-sku-mapping-strategies/threshold-tuning-for-compliance-accuracy/) — tolerance calibration patterns
- ShelfGuard `.planning/PROJECT.md` — v1 scope, validated/active requirements

---
*Feature research for: retail shelf inspection / planogram audit mobile apps*
*Researched: 2026-09-20*
