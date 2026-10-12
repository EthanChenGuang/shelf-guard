#!/usr/bin/env node
/**
 * Playwright harness for ShelfGuard verification.
 * Invoked from .cursor/skills/verify-shelfguard/SKILL.md — do not run against a dev server you did not start for verification.
 */
import { chromium, webkit, devices } from 'playwright';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const DEFAULT_URL = process.env.SHELFGUARD_VERIFY_URL ?? 'http://127.0.0.1:4173';
const BASELINE_FIXTURE = join(REPO_ROOT, 'public/test-fixtures/baseline-aligned.jpg');
const CAPTURE_FIXTURE = join(REPO_ROOT, 'public/test-fixtures/capture-displaced.jpg');

const IT = {
  captureScan: 'Scatta e analizza lo scaffale',
  baselineEstablished: 'Riferimento pronto',
  baselineNotSet: 'Nessun riferimento',
  finishInspection: "Conferma e concludi l'ispezione",
  auditResult: "Risultato dell'ispezione",
  pickFromGallery: "Scegli la foto dell'ispezione dalla galleria",
};

const CROSS_PLATFORM_DEVICES = [
  { name: 'iPhone 14', engine: 'webkit', platform: 'ios' },
  { name: 'iPhone 15 Pro Max', engine: 'webkit', platform: 'ios' },
  { name: 'Pixel 7', engine: 'chromium', platform: 'android' },
  { name: 'Galaxy S9+', engine: 'chromium', platform: 'android' },
];

function usage() {
  console.error(`Usage:
  control-shelfguard doctor [--url URL] [--pid-file PATH]
  control-shelfguard browser drive <feature-id> [--url URL] [--artifacts-dir DIR] [--engine chromium|webkit] [--device NAME]
  control-shelfguard browser snapshot [--url URL] [--artifacts-dir DIR] [--name NAME]

Feature ids: establish-baseline, inspect-scan, inspect-scan-cross-platform, multi-shelf
`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--pid-file') out.pidFile = argv[++i];
    else if (a === '--artifacts-dir') out.artifactsDir = argv[++i];
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--engine') out.engine = argv[++i];
    else if (a === '--device') out.device = argv[++i];
    else out._.push(a);
  }
  return out;
}

function deviceSlug(name) {
  return String(name).replace(/\+/g, '-plus').replace(/\s+/g, '-');
}

function curlOk(url) {
  const r = spawnSync('curl', ['-sf', '-o', '/dev/null', '-w', '%{http_code}', url], {
    encoding: 'utf8',
  });
  return r.status === 0 && r.stdout?.trim() === '200';
}

function opencvScriptOk(baseUrl) {
  const scriptUrl = `${baseUrl.replace(/\/$/, '')}/opencv/opencv.js`;
  const headResp = spawnSync('curl', ['-sf', '-r', '0-511', scriptUrl], { encoding: 'utf8' });
  if (headResp.status !== 0) return false;
  const head = headResp.stdout.trimStart().slice(0, 32).toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html')) return false;
  const lenResp = spawnSync(
    'curl',
    ['-sfI', scriptUrl],
    { encoding: 'utf8' },
  );
  const match = lenResp.stdout.match(/content-length:\s*(\d+)/i);
  const len = match ? Number(match[1]) : 0;
  return len > 100_000;
}

function doctor({ url = DEFAULT_URL, pidFile }) {
  const errors = [];
  if (!curlOk(url)) errors.push(`HTTP GET ${url} did not return 200`);
  if (!opencvScriptOk(url)) {
    errors.push(
      `${url}/opencv/opencv.js is missing or returned HTML (use launch-verify-server.sh preview on :4173, not Vite dev)`,
    );
  }
  const html = spawnSync('curl', ['-sf', url], { encoding: 'utf8' });
  if (html.status !== 0) errors.push(`Could not fetch ${url} body`);
  else if (!/Online Market|shelfguard/i.test(html.stdout) && !html.stdout.includes('root')) {
    errors.push('Page body does not look like the ShelfGuard Vite shell');
  }
  if (pidFile) {
    if (!existsSync(pidFile)) errors.push(`PID file missing: ${pidFile}`);
    else {
      const pid = readFileSync(pidFile, 'utf8').trim();
      const alive = spawnSync('kill', ['-0', pid], { stdio: 'ignore' });
      if (alive.status !== 0) errors.push(`Dev server PID ${pid} from ${pidFile} is not running`);
    }
  }
  for (const f of [BASELINE_FIXTURE, CAPTURE_FIXTURE]) {
    if (!existsSync(f)) errors.push(`Missing fixture: ${f}`);
  }
  if (errors.length) {
    console.error('doctor: FAIL');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('doctor: OK');
  console.log(`  url: ${url}`);
  if (pidFile) console.log(`  pid-file: ${pidFile}`);
  console.log(`  fixtures: baseline-aligned.jpg, capture-displaced.jpg`);
}

async function withBrowser(url, fn, options = {}) {
  const deviceName = options.device;
  const descriptor = deviceName ? devices[deviceName] : null;
  if (deviceName && !descriptor) {
    throw new Error(`Unknown Playwright device: ${deviceName}`);
  }
  const engine = options.engine ?? descriptor?.defaultBrowserType ?? 'chromium';
  const browserType = engine === 'webkit' ? webkit : chromium;
  const launch =
    engine === 'chromium'
      ? {
          headless: true,
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        }
      : { headless: true };
  const browser = await browserType.launch(launch);
  try {
    const context = await browser.newContext({
      ...(descriptor ?? {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      }),
      locale: 'it-IT',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      ...(engine === 'chromium' ? { permissions: ['camera'] } : {}),
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('load').catch(() => undefined);
    return await fn(page, context);
  } finally {
    await browser.close();
  }
}

async function dismissOrientationBanner(page) {
  const close = page.getByRole('button', { name: /chiudi|close|关闭/i });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  }
}

async function waitForCameraIdle(page) {
  await page.getByTestId('camera-view').waitFor({ state: 'visible', timeout: 30_000 });
  await dismissOrientationBanner(page);
  await page.waitForTimeout(400);
  await dismissOrientationBanner(page);
}

/** PR #6: do not drive until IndexedDB baseline hydration finishes (pill is empty while loading). */
async function waitForShelfHydrated(page) {
  await page
    .getByTestId('baseline-status-pill')
    .getByText(/Riferimento pronto|Nessun riferimento/)
    .waitFor({ timeout: 15_000 });
}

async function driveEstablishBaseline(page, artifactsDir) {
  mkdirSync(artifactsDir, { recursive: true });
  await waitForCameraIdle(page);
  await waitForShelfHydrated(page);
  await page.getByTestId('baseline-status-pill').getByText(IT.baselineNotSet).waitFor({
    timeout: 15_000,
  });
  await page.getByTestId('baseline-photo-input').waitFor({ state: 'attached', timeout: 10_000 });
  await page.getByTestId('baseline-photo-input').setInputFiles(BASELINE_FIXTURE);
  await page.getByTestId('baseline-status-pill').getByText(IT.baselineEstablished).waitFor({
    timeout: 30_000,
  });
  await page.screenshot({ path: join(artifactsDir, 'establish-baseline-camera.png'), fullPage: true });
  const pill = await page.getByTestId('baseline-status-pill').innerText();
  writeFileSync(join(artifactsDir, 'establish-baseline-pill.txt'), pill, 'utf8');
  const rotation = await rotateAndAssertNoOffset(page, artifactsDir, 'establish-baseline-rotate');
  return { pill, rotation };
}

async function dispatchPinch(page, selector, fromDist, toDist) {
  await page.locator(selector).evaluate((el, { fromDist, toDist }) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const pair = (dist) => [
      { id: 31, x: cx, y: cy - dist / 2 },
      { id: 32, x: cx, y: cy + dist / 2 },
    ];
    const fireTouch = () => {
      if (typeof Touch !== 'function' || typeof TouchEvent !== 'function') return false;
      try {
        const touch = (id, x, y) =>
          new Touch({
            identifier: id,
            target: el,
            clientX: x,
            clientY: y,
            pageX: x,
            pageY: y,
            screenX: x,
            screenY: y,
            radiusX: 2.5,
            radiusY: 2.5,
            rotationAngle: 0,
            force: 1,
          });
        const asTouches = (pts) => pts.map((p) => touch(p.id, p.x, p.y));
        const fire = (type, pts, ended = false) => {
          const list = asTouches(pts);
          el.dispatchEvent(
            new TouchEvent(type, {
              bubbles: true,
              cancelable: true,
              touches: ended ? [] : list,
              targetTouches: ended ? [] : list,
              changedTouches: list,
            }),
          );
        };
        fire('touchstart', pair(fromDist));
        fire('touchmove', pair(toDist));
        fire('touchend', pair(toDist), true);
        return true;
      } catch {
        return false;
      }
    };
    const firePointer = () => {
      const fire = (type, pts) => {
        for (const p of pts) {
          el.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: p.id,
              pointerType: 'mouse',
              clientX: p.x,
              clientY: p.y,
              isPrimary: p.id === 31,
              buttons: type === 'pointerup' ? 0 : 1,
            }),
          );
        }
      };
      fire('pointerdown', pair(fromDist));
      fire('pointermove', pair(toDist));
      fire('pointerup', pair(toDist));
    };
    if (!fireTouch()) firePointer();
  }, { fromDist, toDist });
}

async function dispatchHoldStart(page, selector) {
  await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    try {
      if (typeof Touch === 'function' && typeof TouchEvent === 'function') {
        const t = new Touch({ identifier: 0, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
        el.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [t],
            targetTouches: [t],
            changedTouches: [t],
          }),
        );
        return;
      }
    } catch {
      // WebKit without Touch constructor — mouse hold still starts blink-compare.
    }
    el.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1 }),
    );
  });
}

function assertCenteredBox(box, pageWidth, label) {
  if (!box) throw new Error(`${label}: comparison image has no box`);
  const leftGap = box.x;
  const rightGap = pageWidth - (box.x + box.width);
  const delta = Math.abs(leftGap - rightGap);
  if (delta > 8) {
    throw new Error(
      `${label}: comparison image is not centered (left ${leftGap.toFixed(1)} vs right ${rightGap.toFixed(1)})`,
    );
  }
  return { leftGap, rightGap, delta };
}

async function measureHorizontalLock(page, label) {
  const metrics = await page.evaluate(() => {
    const root = document.getElementById('root');
    const camera = document.querySelector('[data-testid="camera-view"]');
    const results = document.querySelector('[data-testid="inspect-image-viewport"]');
    const subject = camera || results || root || document.body;
    const rect = subject.getBoundingClientRect();
    return {
      scrollX: window.scrollX,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      subjectLeft: rect.left,
    };
  });
  if (Math.abs(metrics.scrollX) > 0.5) {
    throw new Error(`${label}: scrollX=${metrics.scrollX} (expected 0)`);
  }
  if (metrics.scrollWidth > metrics.innerWidth + 1) {
    throw new Error(
      `${label}: document width ${metrics.scrollWidth} > viewport ${metrics.innerWidth}`,
    );
  }
  if (metrics.subjectLeft < -1) {
    throw new Error(`${label}: content left edge at ${metrics.subjectLeft} (white-strip shift)`);
  }
  return metrics;
}

async function rotateAndAssertNoOffset(page, artifactsDir, name) {
  const sizes = [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 932, height: 430 },
    { width: 390, height: 844 },
  ];
  const rows = [];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.evaluate(() => {
      window.scrollTo(48, 0);
      document.documentElement.scrollLeft = 48;
      document.body.scrollLeft = 48;
      window.dispatchEvent(new Event('orientationchange'));
    });
    await page.waitForTimeout(320);
    const label = `${name}-${size.width}x${size.height}`;
    const metrics = await measureHorizontalLock(page, label);
    await page.screenshot({ path: join(artifactsDir, `${label}.png`), fullPage: false });
    rows.push(
      `${label} scrollX=${metrics.scrollX} client=${metrics.clientWidth} inner=${metrics.innerWidth} scrollW=${metrics.scrollWidth} left=${metrics.subjectLeft.toFixed(1)}`,
    );
  }
  writeFileSync(join(artifactsDir, `${name}-offset.txt`), `${rows.join('\n')}\n`, 'utf8');
  return rows;
}

function formatZoomOverflow(label, info) {
  return [
    `${label} scale=${info.scale}`,
    `frame=${info.frame.w.toFixed(0)}x${info.frame.h.toFixed(0)}@${info.frame.x.toFixed(0)},${info.frame.y.toFixed(0)}`,
    `layer=${info.layer.w.toFixed(0)}x${info.layer.h.toFixed(0)}@${info.layer.x.toFixed(0)},${info.layer.y.toFixed(0)}`,
    `beyondFrame=${info.extendsBeyondFrame}`,
    `clips=${info.clips.length}`,
    `shortCover=${(info.shortCover * 100).toFixed(0)}%`,
    `area=${(info.coverage * 100).toFixed(0)}%`,
  ].join(' ');
}

async function assertUnclippedWholeScreenZoom(page, label) {
  const info = await page.evaluate(() => {
    const frame = document.querySelector('[data-testid="inspect-image-viewport"]');
    const layer = document.querySelector('[data-testid="inspect-image-zoom-layer"]');
    if (!frame || !layer) return { error: 'missing frame or zoom layer' };
    const fr = frame.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clips = [];
    let el = layer.parentElement;
    while (el) {
      const st = getComputedStyle(el);
      const hidden = ['hidden', 'clip'];
      if (hidden.includes(st.overflowX) || hidden.includes(st.overflowY) || hidden.includes(st.overflow)) {
        clips.push({
          id: el.id || el.getAttribute('data-testid') || el.tagName,
          overflowX: st.overflowX,
          overflowY: st.overflowY,
        });
      }
      el = el.parentElement;
    }
    const intersectW = Math.max(0, Math.min(lr.right, vw) - Math.max(lr.left, 0));
    const intersectH = Math.max(0, Math.min(lr.bottom, vh) - Math.max(lr.top, 0));
    const coverage = vw * vh > 0 ? (intersectW * intersectH) / (vw * vh) : 0;
    const shortCover = vh <= vw ? intersectH / vh : intersectW / vw;
    const geomPossible =
      vw * vh > 0 ? (Math.min(lr.width, vw) * Math.min(lr.height, vh)) / (vw * vh) : 0;
    return {
      scale: Number(frame.getAttribute('data-zoom-scale') || '1'),
      zoomedAttr: frame.getAttribute('data-inspect-zoomed'),
      frame: { x: fr.x, y: fr.y, w: fr.width, h: fr.height },
      layer: { x: lr.x, y: lr.y, w: lr.width, h: lr.height },
      viewport: { w: vw, h: vh },
      clips,
      coverage,
      shortCover,
      geomPossible,
      extendsBeyondFrame:
        lr.width > fr.width + 8 &&
        lr.height > fr.height + 8 &&
        lr.left < fr.left - 2 &&
        lr.right > fr.right + 2 &&
        lr.top < fr.top - 2 &&
        lr.bottom > fr.bottom + 2,
    };
  });
  if (info.error) throw new Error(`${label}: ${info.error}`);
  if (info.scale < 2.4) {
    throw new Error(`${label}: expected scale ~2.75, got ${info.scale}`);
  }
  if (info.zoomedAttr !== 'true') {
    throw new Error(`${label}: data-inspect-zoomed should be true while zoomed`);
  }
  if (!info.extendsBeyondFrame) {
    throw new Error(
      `${label}: zoomed image is still clipped to the frame (frame ${info.frame.w.toFixed(0)}x${info.frame.h.toFixed(0)} layer ${info.layer.w.toFixed(0)}x${info.layer.h.toFixed(0)} at ${info.layer.x.toFixed(0)},${info.layer.y.toFixed(0)})`,
    );
  }
  if (info.clips.length) {
    throw new Error(
      `${label}: zoomed image is clipped by ancestors ${JSON.stringify(info.clips)}`,
    );
  }
  // Area ≥70% is only possible when the scaled photo is that large (portrait).
  // Landscape phones keep a short contained frame; require the short axis to be
  // covered so the zoomed photo paints over chrome instead of sitting in the box.
  if (info.shortCover < 0.9) {
    throw new Error(
      `${label}: zoomed image covers ${(info.shortCover * 100).toFixed(0)}% of the short viewport axis (need ≥90%; area ${(info.coverage * 100).toFixed(0)}%)`,
    );
  }
  return info;
}

async function countFlickerDuringPinch(page, selector) {
  return page.locator(selector).evaluate(async (el) => {
    let blinkToggles = 0;
    let scaleResets = 0;
    let lastBlink = el.querySelector('[data-showing-baseline]')?.getAttribute('data-showing-baseline') ?? 'false';
    let lastScale = Number(el.getAttribute('data-zoom-scale') ?? '1');
    const obs = new MutationObserver(() => {
      const blink =
        el.querySelector('[data-showing-baseline]')?.getAttribute('data-showing-baseline') ?? 'false';
      const scale = Number(el.getAttribute('data-zoom-scale') ?? '1');
      if (blink !== lastBlink) {
        blinkToggles += 1;
        lastBlink = blink;
      }
      if (lastScale > 1.05 && scale <= 1.01) scaleResets += 1;
      lastScale = scale;
    });
    obs.observe(el, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-showing-baseline', 'data-zoom-scale', 'src'],
    });

    const rect = el.getBoundingClientRect();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    try {
      const touch = (id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
      const fire = (type, touches) => {
        el.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches,
            targetTouches: touches,
            changedTouches: touches,
          }),
        );
      };

      const a0 = touch(0, cx, cy - 40);
      fire('touchstart', [a0]);
      const pair = (dist) => [touch(0, cx, cy - dist / 2), touch(1, cx, cy + dist / 2)];
      fire('touchstart', pair(80));
      for (let i = 0; i < 10; i += 1) {
        const dist = 90 + i * 12;
        const fingers = pair(dist);
        fire('touchmove', fingers);
        fire('touchend', [fingers[0]]);
        fire('touchstart', fingers);
      }
      fire('touchend', []);
    } catch {
      // WebKit without Touch() — skip the flicker sequence; pinch/overflow still asserted.
    }
    await new Promise((r) => setTimeout(r, 80));
    obs.disconnect();
    return {
      blinkToggles,
      scaleResets,
      showingBaseline: el.querySelector('[data-showing-baseline="true"]') !== null,
      scale: Number(el.getAttribute('data-zoom-scale') ?? '1'),
    };
  });
}

async function pinchAndBlinkViewport(page, artifactsDir, name) {
  const selector = '[data-testid="inspect-image-viewport"]';
  const viewport = page.getByTestId('inspect-image-viewport');
  if (await page.getByTestId('inspect-image-fullscreen').count()) {
    throw new Error(`${name}: comparison fullscreen overlay is still present`);
  }
  if (await page.getByTestId('inspect-image-fullscreen-open').count()) {
    throw new Error(`${name}: fullscreen expand control is still present`);
  }
  const flicker = await countFlickerDuringPinch(page, selector);
  if (flicker.blinkToggles > 0) {
    throw new Error(`${name}: blink-compare toggled ${flicker.blinkToggles} times during pinch`);
  }
  if (flicker.scaleResets > 0) {
    throw new Error(`${name}: zoom scale reset ${flicker.scaleResets} times during pinch`);
  }
  if (flicker.showingBaseline) {
    throw new Error(`${name}: baseline was showing after a multi-touch pinch`);
  }
  await dispatchPinch(page, selector, 400, 80);
  await dispatchPinch(page, selector, 80, 220);
  let scale = await viewport.getAttribute('data-zoom-scale');
  if (!scale || Number(scale) < 2.4) {
    // TouchEvent constructor can exist on WebKit without delivering the pinch; Pointer is the fallback.
    await page.locator(selector).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const fire = (type, y0, y1, extra) => {
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'mouse', clientX: cx, clientY: y0, isPrimary: true, ...extra }));
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 42, pointerType: 'mouse', clientX: cx, clientY: y1, isPrimary: false, ...extra }));
      };
      fire('pointerdown', cy - 40, cy + 40, { buttons: 1 });
      fire('pointermove', cy - 110, cy + 110, { buttons: 1 });
      fire('pointerup', cy - 110, cy + 110, { buttons: 0 });
    });
    scale = await viewport.getAttribute('data-zoom-scale');
  }
  if (!scale || Number(scale) < 2.4) {
    throw new Error(`${name}: pinch zoom did not reach ~2.75 (data-zoom-scale=${scale})`);
  }
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-inspect-zoomed') === 'true',
    null,
    { timeout: 3_000 },
  );
  const overflow = await assertUnclippedWholeScreenZoom(page, name);
  await page.screenshot({ path: join(artifactsDir, `${name}-zoom.png`), fullPage: false });
  await dispatchHoldStart(page, selector);
  await page.waitForTimeout(550);
  if ((await viewport.locator('[data-showing-baseline="true"]').count()) < 1) {
    throw new Error(`${name}: zoomed blink-compare did not show the baseline image`);
  }
  const scaleWhileBlink = await viewport.getAttribute('data-zoom-scale');
  if (scaleWhileBlink !== scale) {
    throw new Error(`${name}: blink changed zoom (${scale} -> ${scaleWhileBlink})`);
  }
  await page.screenshot({ path: join(artifactsDir, `${name}-zoom-blink.png`), fullPage: false });
  await viewport.evaluate((el) => {
    try {
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [] }));
    } catch {
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    }
  });
  await dispatchPinch(page, selector, 400, 80);
  return { scale: Number(scale), overflow };
}

async function measureAndShotResults(page, artifactsDir, name) {
  const pageSize = page.viewportSize();
  const viewportBox = await page.getByTestId('inspect-image-viewport').boundingBox();
  const center = assertCenteredBox(viewportBox, pageSize.width, name);
  await page.screenshot({ path: join(artifactsDir, `${name}.png`), fullPage: false });
  return {
    viewport: `${pageSize.width}x${pageSize.height}`,
    image: `${Math.round(viewportBox.width)}x${Math.round(viewportBox.height)} @ ${Math.round(viewportBox.x)},${Math.round(viewportBox.y)}`,
    leftGap: center.leftGap.toFixed(1),
    rightGap: center.rightGap.toFixed(1),
    delta: center.delta.toFixed(1),
  };
}

async function driveInspectScan(page, artifactsDir) {
  mkdirSync(artifactsDir, { recursive: true });
  await waitForCameraIdle(page);
  await waitForShelfHydrated(page);
  if (await page.getByTestId('baseline-status-pill').getByText(IT.baselineNotSet).isVisible().catch(() => false)) {
    await driveEstablishBaseline(page, join(artifactsDir, 'preflight-baseline'));
  }
  await page.getByTestId('baseline-status-pill').getByText(IT.baselineEstablished).waitFor({
    timeout: 15_000,
  });
  // First capture after a persisted baseline must compare, not overwrite (PR #6 / STAB-05).
  await page.getByRole('button', { name: IT.pickFromGallery }).click();
  await page.getByTestId('gallery-input').setInputFiles(CAPTURE_FIXTURE);
  await page.getByRole('button', { name: IT.finishInspection }).waitFor({
    timeout: 120_000,
  });
  await page.getByText(IT.auditResult).waitFor({ timeout: 5_000 });
  if (await page.getByTestId('camera-view').isVisible().catch(() => false)) {
    throw new Error('First capture stayed on camera idle — comparison did not run');
  }
  writeFileSync(
    join(artifactsDir, 'first-capture-comparison.txt'),
    "PASS: first capture with existing baseline opened Risultato dell'ispezione (comparison), not a baseline rewrite.\n",
    'utf8',
  );

  const metrics = [];
  const zoomScales = {};
  const overflowRows = [];
  const portrait = await measureAndShotResults(page, artifactsDir, 'inspect-scan-results-390x844');
  metrics.push(`390x844 results ${portrait.image} left=${portrait.leftGap} right=${portrait.rightGap} delta=${portrait.delta}`);
  copyFileSync(join(artifactsDir, 'inspect-scan-results-390x844.png'), join(artifactsDir, 'inspect-scan-results.png'));
  const portraitZoom = await pinchAndBlinkViewport(page, artifactsDir, 'inspect-scan-390x844');
  zoomScales['390x844'] = portraitZoom.scale;
  overflowRows.push(formatZoomOverflow('390x844', portraitZoom.overflow));
  copyFileSync(join(artifactsDir, 'inspect-scan-390x844-zoom-blink.png'), join(artifactsDir, 'inspect-scan-zoom-blink.png'));

  for (const size of [
    { width: 844, height: 390 },
    { width: 932, height: 430 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(200);
    const label = `${size.width}x${size.height}`;
    const shot = await measureAndShotResults(page, artifactsDir, `inspect-scan-results-${label}`);
    metrics.push(`${label} results ${shot.image} left=${shot.leftGap} right=${shot.rightGap} delta=${shot.delta}`);
    const zoomed = await pinchAndBlinkViewport(page, artifactsDir, `inspect-scan-${label}`);
    zoomScales[label] = zoomed.scale;
    overflowRows.push(formatZoomOverflow(label, zoomed.overflow));
  }

  writeFileSync(join(artifactsDir, 'inspect-scan-center.txt'), `${metrics.join('\n')}\n`, 'utf8');
  writeFileSync(join(artifactsDir, 'inspect-scan-zoom-overflow.txt'), `${overflowRows.join('\n')}\n`, 'utf8');
  const rotation = await rotateAndAssertNoOffset(page, artifactsDir, 'inspect-scan-rotate');
  const aria = await page.locator('body').ariaSnapshot();
  writeFileSync(join(artifactsDir, 'inspect-scan.aria.txt'), aria, 'utf8');
  return {
    hasFinish: true,
    centered: true,
    firstCaptureComparison: true,
    noFullscreen: true,
    noFlicker: true,
    noHorizontalOffset: true,
    zoomScales,
    rotation,
  };
}

async function driveMultiShelf(page, artifactsDir) {
  mkdirSync(artifactsDir, { recursive: true });
  await waitForCameraIdle(page);
  await waitForShelfHydrated(page);
  const carousel = page.getByTestId('shelf-carousel');
  await carousel.getByRole('tab', { name: 'Scaffale 2' }).click();
  const current = await carousel.getByRole('tab', { name: 'Scaffale 2' }).getAttribute('aria-current');
  if (current !== 'true') throw new Error('Scaffale 2 not selected after click');
  await waitForShelfHydrated(page);
  await page.getByTestId('baseline-status-pill').getByText(IT.baselineNotSet).waitFor({
    timeout: 10_000,
  });
  await page.screenshot({ path: join(artifactsDir, 'multi-shelf-2-empty-baseline.png'), fullPage: true });
  return { shelf: 2 };
}

async function reachInspectResults(page, artifactsDir) {
  await waitForCameraIdle(page);
  await waitForShelfHydrated(page);
  if (await page.getByTestId('baseline-status-pill').getByText(IT.baselineNotSet).isVisible().catch(() => false)) {
    mkdirSync(join(artifactsDir, 'preflight-baseline'), { recursive: true });
    await page.getByTestId('baseline-photo-input').waitFor({ state: 'attached', timeout: 10_000 });
    await page.getByTestId('baseline-photo-input').setInputFiles(BASELINE_FIXTURE);
    await page.getByTestId('baseline-status-pill').getByText(IT.baselineEstablished).waitFor({
      timeout: 30_000,
    });
    await page.screenshot({
      path: join(artifactsDir, 'preflight-baseline', 'establish-baseline-camera.png'),
      fullPage: true,
    });
  }
  await page.getByTestId('baseline-status-pill').getByText(IT.baselineEstablished).waitFor({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: IT.pickFromGallery }).click();
  await page.getByTestId('gallery-input').setInputFiles(CAPTURE_FIXTURE);
  await page.getByRole('button', { name: IT.finishInspection }).waitFor({
    timeout: 120_000,
  });
  await page.getByText(IT.auditResult).waitFor({ timeout: 5_000 });
}

async function driveInspectScanOnDevice(page, artifactsDir, device) {
  mkdirSync(artifactsDir, { recursive: true });
  await reachInspectResults(page, artifactsDir);
  const slug = deviceSlug(device.name);
  const portraitLabel = `${slug}-portrait`;
  const landscapeLabel = `${slug}-landscape`;
  await measureAndShotResults(page, artifactsDir, `inspect-scan-${portraitLabel}`);
  const portraitZoom = await pinchAndBlinkViewport(page, artifactsDir, `inspect-scan-${portraitLabel}`);
  const landscapeSpec = devices[`${device.name} landscape`];
  if (!landscapeSpec?.viewport) {
    throw new Error(`No Playwright landscape profile for ${device.name}`);
  }
  await page.setViewportSize(landscapeSpec.viewport);
  await page.waitForTimeout(250);
  await measureAndShotResults(page, artifactsDir, `inspect-scan-${landscapeLabel}`);
  const landscapeZoom = await pinchAndBlinkViewport(page, artifactsDir, `inspect-scan-${landscapeLabel}`);
  const overflowRows = [
    formatZoomOverflow(portraitLabel, portraitZoom.overflow),
    formatZoomOverflow(landscapeLabel, landscapeZoom.overflow),
  ];
  writeFileSync(join(artifactsDir, 'inspect-scan-zoom-overflow.txt'), `${overflowRows.join('\n')}\n`, 'utf8');
  return {
    device: device.name,
    engine: device.engine,
    platform: device.platform,
    portrait: {
      scale: portraitZoom.scale,
      shortCover: portraitZoom.overflow.shortCover,
      clips: portraitZoom.overflow.clips.length,
      beyondFrame: portraitZoom.overflow.extendsBeyondFrame,
    },
    landscape: {
      scale: landscapeZoom.scale,
      shortCover: landscapeZoom.overflow.shortCover,
      clips: landscapeZoom.overflow.clips.length,
      beyondFrame: landscapeZoom.overflow.extendsBeyondFrame,
    },
  };
}

async function driveInspectScanCrossPlatform(url, artifactsDir) {
  mkdirSync(artifactsDir, { recursive: true });
  const rows = [];
  const devicesOut = [];
  for (const device of CROSS_PLATFORM_DEVICES) {
    const dir = join(artifactsDir, deviceSlug(device.name));
    const result = await withBrowser(
      url,
      (page) => driveInspectScanOnDevice(page, dir, device),
      { device: device.name, engine: device.engine },
    );
    devicesOut.push(result);
    rows.push(
      `${result.platform}/${result.engine} ${result.device} portrait scale=${result.portrait.scale} beyond=${result.portrait.beyondFrame} clips=${result.portrait.clips} short=${(result.portrait.shortCover * 100).toFixed(0)}% | landscape scale=${result.landscape.scale} beyond=${result.landscape.beyondFrame} clips=${result.landscape.clips} short=${(result.landscape.shortCover * 100).toFixed(0)}%`,
    );
  }
  writeFileSync(join(artifactsDir, 'cross-platform-report.txt'), `${rows.join('\n')}\n`, 'utf8');
  return { devices: devicesOut, report: rows };
}

async function browserDrive(featureId, { url = DEFAULT_URL, artifactsDir, engine, device }) {
  if (!artifactsDir) {
    console.error('browser drive requires --artifacts-dir');
    process.exit(2);
  }
  if (featureId === 'inspect-scan-cross-platform') {
    const result = await driveInspectScanCrossPlatform(url, artifactsDir);
    console.log(JSON.stringify({ featureId, ok: true, ...result }, null, 2));
    return;
  }
  const drivers = {
    'establish-baseline': driveEstablishBaseline,
    'inspect-scan': driveInspectScan,
    'multi-shelf': driveMultiShelf,
  };
  const driver = drivers[featureId];
  if (!driver) {
    console.error(`Unknown feature id: ${featureId}`);
    usage();
  }
  const result = await withBrowser(url, (page) => driver(page, artifactsDir), { engine, device });
  console.log(JSON.stringify({ featureId, ok: true, ...result }, null, 2));
}

async function browserSnapshot({ url = DEFAULT_URL, artifactsDir, name = 'snapshot' }) {
  if (!artifactsDir) {
    console.error('browser snapshot requires --artifacts-dir');
    process.exit(2);
  }
  mkdirSync(artifactsDir, { recursive: true });
  await withBrowser(url, async (page) => {
    await waitForCameraIdle(page);
    await page.screenshot({ path: join(artifactsDir, `${name}.png`), fullPage: true });
    const aria = await page.locator('body').ariaSnapshot();
    writeFileSync(join(artifactsDir, `${name}.aria.txt`), aria, 'utf8');
  });
  console.log(`snapshot written to ${artifactsDir}/${name}.{png,aria.txt}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, sub, ...rest] = args._;
  if (cmd === 'doctor') {
    doctor({ url: args.url ?? DEFAULT_URL, pidFile: args.pidFile });
    return;
  }
  if (cmd === 'browser' && sub === 'drive') {
    const [featureId] = rest;
    if (!featureId) usage();
    await browserDrive(featureId, {
      url: args.url ?? DEFAULT_URL,
      artifactsDir: args.artifactsDir ? resolve(args.artifactsDir) : undefined,
      engine: args.engine,
      device: args.device,
    });
    return;
  }
  if (cmd === 'browser' && sub === 'snapshot') {
    await browserSnapshot({
      url: args.url ?? DEFAULT_URL,
      artifactsDir: args.artifactsDir ? resolve(args.artifactsDir) : undefined,
      name: args.name,
    });
    return;
  }
  usage();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
