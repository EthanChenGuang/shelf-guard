#!/usr/bin/env node
/**
 * Playwright harness for ShelfGuard verification.
 * Invoked from .cursor/skills/verify-shelfguard/SKILL.md — do not run against a dev server you did not start for verification.
 */
import { chromium, webkit, devices } from 'playwright';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

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
  pressHoldCompare: 'Tocca 🔍 per ingrandire · Tieni premuto per il riferimento',
  goldenBaseline: 'Stai vedendo la foto di riferimento',
  zoomEnter: 'Ingrandisci immagine',
  zoomExit: 'Chiudi ingrandimento',
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
  else if (!/Online Marketplace|shelfguard/i.test(html.stdout) && !html.stdout.includes('root')) {
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

/**
 * Playwright 1.49 (repo pin) only ships an Ubuntu-20.04 WebKit fallback on hosts it does not know
 * (e.g. Debian 13), which cannot start there. SHELFGUARD_WEBKIT_PLAYWRIGHT=<path to a newer
 * `playwright` package dir> launches WebKit from that install instead; Chromium and the device
 * descriptors always come from the repo's Playwright.
 */
function webkitLauncher() {
  const override = process.env.SHELFGUARD_WEBKIT_PLAYWRIGHT;
  if (!override) return webkit;
  return createRequire(import.meta.url)(resolve(override)).webkit;
}

async function withBrowser(url, fn, options = {}) {
  const deviceName = options.device;
  const descriptor = deviceName ? devices[deviceName] : null;
  if (deviceName && !descriptor) {
    throw new Error(`Unknown Playwright device: ${deviceName}`);
  }
  const engine = options.engine ?? descriptor?.defaultBrowserType ?? 'chromium';
  const browserType = engine === 'webkit' ? webkitLauncher() : chromium;
  const launch =
    engine === 'chromium'
      ? {
          headless: true,
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        }
      : { headless: true };
  const contextOptions = {
    ...(descriptor ?? {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    }),
    locale: 'it-IT',
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
    ...(engine === 'chromium' ? { permissions: ['camera'] } : {}),
  };
  // Ephemeral WebKit contexts reject Blobs in IndexedDB (the baseline is a Blob), so WebKit runs
  // in a persistent context on a fresh temp profile — still an empty IndexedDB per drive.
  const profileDir = engine === 'webkit' ? mkdtempSync(join(tmpdir(), 'sg-webkit-profile-')) : null;
  const browser = profileDir ? null : await browserType.launch(launch);
  const context = profileDir
    ? await browserType.launchPersistentContext(profileDir, { ...launch, ...contextOptions })
    : await browser.newContext(contextOptions);
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('load').catch(() => undefined);
    return await fn(page, context, engine);
  } finally {
    try {
      await (browser ?? context).close();
    } catch (err) {
      if (err?.code !== 'EIO') throw err;
    }
    if (profileDir) rmSync(profileDir, { recursive: true, force: true });
  }
}

function isTransientIo(err) {
  return err?.code === 'EIO' || err?.syscall === 'close';
}

async function saveScreenshot(page, destPath, options = {}) {
  mkdirSync(dirname(destPath), { recursive: true });
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const tmpPath = join(tmpdir(), `sg-shot-${process.pid}-${Date.now()}-${attempt}.png`);
    try {
      await page.screenshot({ ...options, path: tmpPath });
      copyFileSync(tmpPath, destPath);
      return;
    } catch (err) {
      lastErr = err;
      if (!isTransientIo(err)) throw err;
      await new Promise((resolveWait) => setTimeout(resolveWait, 200 * (attempt + 1)));
    } finally {
      try {
        unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
  }
  throw lastErr;
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

async function captureAppHeader(page, artifactsDir, name) {
  const title = page.getByTestId('app-title');
  await title.waitFor({ state: 'visible', timeout: 10_000 });
  const metrics = await title.evaluate((el) => {
    const nameEl = el.querySelector('.app-title-name');
    const subEl = el.querySelector('.app-title-subtitle');
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const nameText = (nameEl?.textContent ?? '').trim();
    const rects = el.getClientRects();
    const nameRects = nameEl?.getClientRects() ?? [];
    const box = el.getBoundingClientRect();
    return {
      text,
      nameText,
      alt: el.querySelector('img')?.getAttribute('alt') ?? '',
      whiteSpace: nameEl ? getComputedStyle(nameEl).whiteSpace : '',
      rectCount: rects.length,
      nameRectCount: nameRects.length,
      width: Math.round(box.width),
      height: Math.round(box.height),
      inViewport: box.top >= 0 && box.left >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1,
    };
  });
  if (!metrics.nameText.includes('Online Marketplace')) {
    throw new Error(`${name}: header missing Online Marketplace: ${metrics.text}`);
  }
  if (metrics.alt !== 'Online Marketplace') {
    throw new Error(`${name}: icon alt=${metrics.alt} (expected Online Marketplace)`);
  }
  if (metrics.whiteSpace !== 'nowrap' || metrics.rectCount !== 1 || metrics.nameRectCount !== 1) {
    throw new Error(
      `${name}: header wrapped whiteSpace=${metrics.whiteSpace} rects=${metrics.rectCount} nameRects=${metrics.nameRectCount}`,
    );
  }
  if (!metrics.inViewport) {
    throw new Error(`${name}: header overflowed the viewport`);
  }
  const box = await title.boundingBox();
  const pageSize = page.viewportSize();
  const clip = box
    ? {
        x: Math.max(0, Math.floor(box.x) - 8),
        y: Math.max(0, Math.floor(box.y) - 8),
        width: Math.min(pageSize.width, Math.ceil(box.width) + 16),
        height: Math.min(pageSize.height, Math.ceil(box.height) + 16),
      }
    : undefined;
  await saveScreenshot(page, join(artifactsDir, `${name}-header.png`), { fullPage: false, clip });
  writeFileSync(
    join(artifactsDir, `${name}-header.txt`),
    `${name} text="${metrics.text}" nowrap=${metrics.whiteSpace} rects=${metrics.rectCount} ${metrics.width}x${metrics.height} inViewport=${metrics.inViewport}\n`,
    'utf8',
  );
  return metrics;
}

async function captureAppHeaderOrientations(page, artifactsDir, prefix, portraitSize, landscapeSize) {
  const previous = page.viewportSize();
  await page.setViewportSize(portraitSize);
  await page.waitForTimeout(120);
  const portrait = await captureAppHeader(page, artifactsDir, `${prefix}-portrait`);
  await page.setViewportSize(landscapeSize);
  await page.waitForTimeout(120);
  const landscape = await captureAppHeader(page, artifactsDir, `${prefix}-landscape`);
  if (previous) await page.setViewportSize(previous);
  return { portrait, landscape };
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
  await saveScreenshot(page, join(artifactsDir, 'establish-baseline-camera.png'), { fullPage: true });
  const pill = await page.getByTestId('baseline-status-pill').innerText();
  writeFileSync(join(artifactsDir, 'establish-baseline-pill.txt'), pill, 'utf8');
  const rotation = await rotateAndAssertNoOffset(page, artifactsDir, 'establish-baseline-rotate');
  return { pill, rotation };
}

const SEL = {
  image: '[data-testid="inspect-image-viewport"]',
  enter: '[data-testid="inspect-zoom-enter"]',
  overlay: '[data-testid="inspect-zoom-overlay"]',
  stage: '[data-testid="inspect-zoom-stage"]',
  layer: '[data-testid="inspect-zoom-layer"]',
  exit: '[data-testid="inspect-zoom-exit"]',
  zoomHint: '[data-testid="inspect-zoom-hint"]',
};

/**
 * Touch input per engine.
 * - Chromium: trusted CDP `Input.dispatchTouchEvent` — real TouchEvents/PointerEvents and real
 *   compositor scrolling, so `touch-action` and passive/non-passive listeners behave as on Android.
 * - WebKit: Playwright has no touch injection beyond `tap()` (which IS trusted and is used for the
 *   magnifier/X buttons). Pinch, pan and hold are untrusted JS `TouchEvent`s (or `PointerEvent`
 *   pointerType=mouse when `new Touch()` is unavailable or not honoured). Idle page scroll on WebKit is
 *   proven by: computed `touch-action` on the photo and every ancestor allows pan-y, synthetic
 *   cancelable touchstart/touchmove on the photo are NOT defaultPrevented, and a trusted
 *   `mouse.wheel` over the photo scrolls the window.
 */
async function createTouchDriver(page, context, engine) {
  if (engine === 'chromium') {
    const cdp = await context.newCDPSession(page);
    const send = (type, points) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 2, radiusY: 2, force: 1 })),
      });
    return { engine, trusted: true, method: 'cdp Input.dispatchTouchEvent (trusted)', send };
  }
  return {
    engine,
    trusted: false,
    method: 'synthetic JS TouchEvent/PointerEvent (untrusted) + trusted tap()/mouse.wheel',
  };
}

/** steps: [{ type: 'start'|'move'|'end', points: [{ id, x, y }] }]; `end` lists the points still down. */
async function syntheticGesture(page, selector, steps, { forcePointer = false } = {}) {
  return page.locator(selector).evaluate(
    (el, { steps, forcePointer }) => {
      const results = [];
      // Chromium: new Touch(). WebKit: `new Touch()` is an illegal constructor, but the legacy
      // document.createTouch/createTouchList objects are accepted by the TouchEvent constructor.
      const makeTouch = (p) => {
        try {
          return new Touch({
            identifier: p.id,
            target: el,
            clientX: p.x,
            clientY: p.y,
            pageX: p.x + window.scrollX,
            pageY: p.y + window.scrollY,
            screenX: p.x,
            screenY: p.y,
            radiusX: 2.5,
            radiusY: 2.5,
            rotationAngle: 0,
            force: 1,
          });
        } catch {
          if (typeof document.createTouch !== 'function') return null;
          return document.createTouch(window, el, p.id, p.x + window.scrollX, p.y + window.scrollY, p.x, p.y);
        }
      };
      const nativeTouch = (() => {
        try {
          new Touch({ identifier: 0, target: el, clientX: 0, clientY: 0 });
          return true;
        } catch {
          return false;
        }
      })();
      const asList = (touches) => (nativeTouch ? touches : document.createTouchList(...touches));
      let canTouch = !forcePointer && typeof TouchEvent === 'function';
      if (canTouch) {
        try {
          const probe = makeTouch({ id: 99, x: 0, y: 0 });
          new TouchEvent('touchcancel', { touches: asList([]), changedTouches: asList([probe]) });
          canTouch = Boolean(probe);
        } catch {
          canTouch = false;
        }
      }
      if (canTouch) {
        let last = [];
        for (const s of steps) {
          const type = s.type === 'start' ? 'touchstart' : s.type === 'move' ? 'touchmove' : 'touchend';
          const touches = s.points.map(makeTouch);
          const changed =
            s.type === 'end' ? last.filter((p) => !s.points.some((q) => q.id === p.id)).map(makeTouch) : touches;
          const ev = new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: asList(touches),
            targetTouches: asList(touches),
            changedTouches: asList(changed),
          });
          el.dispatchEvent(ev);
          results.push({ type, defaultPrevented: ev.defaultPrevented });
          last = s.points;
        }
        return { mode: nativeTouch ? 'touch' : 'touch(createTouch)', results };
      }
      const down = new Map();
      const fire = (type, p) => {
        const ev = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: p.id,
          pointerType: 'mouse',
          clientX: p.x,
          clientY: p.y,
          isPrimary: p.id === [...down.keys()][0],
          buttons: type === 'pointerup' ? 0 : 1,
        });
        el.dispatchEvent(ev);
        results.push({ type, defaultPrevented: ev.defaultPrevented });
      };
      for (const s of steps) {
        if (s.type === 'start') {
          for (const p of s.points) {
            if (!down.has(p.id)) {
              down.set(p.id, p);
              fire('pointerdown', p);
            }
          }
        } else if (s.type === 'move') {
          for (const p of s.points) {
            down.set(p.id, p);
            fire('pointermove', p);
          }
        } else {
          for (const [id, p] of [...down]) {
            if (!s.points.some((q) => q.id === id)) {
              fire('pointerup', p);
              down.delete(id);
            }
          }
        }
      }
      return { mode: 'pointer', results };
    },
    { steps, forcePointer },
  );
}

/** Run a gesture with the engine's best touch source. */
async function runGesture(page, driver, selector, steps, options = {}) {
  if (driver.trusted && !options.forcePointer) {
    for (const s of steps) {
      if (s.type === 'start') await driver.send('touchStart', s.points);
      else if (s.type === 'move') await driver.send('touchMove', s.points);
      else await driver.send('touchEnd', []);
      await page.waitForTimeout(16);
    }
    return { mode: 'cdp' };
  }
  return syntheticGesture(page, selector, steps, options);
}

async function centerOf(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no bounding box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

/**
 * Point on the photo nearest its center whose hit target is the photo itself — not an anomaly
 * AR box (those stop touch propagation so they can be tapped to dismiss) and not a button.
 */
async function pressPointOn(page, selector) {
  const point = await page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const left = Math.max(r.left, 0);
    const top = Math.max(r.top, 0);
    const right = Math.min(r.right, window.innerWidth);
    const bottom = Math.min(r.bottom, window.innerHeight);
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const candidates = [];
    for (let i = 1; i < 12; i += 1) {
      for (let j = 1; j < 12; j += 1) {
        candidates.push({ x: left + ((right - left) * i) / 12, y: top + ((bottom - top) * j) / 12 });
      }
    }
    candidates.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    // A finger is not a pixel: browsers retarget touches to nearby tappable boxes, so require
    // clearance around the point (shrinking it on very small photos).
    const free = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      return hit && el.contains(hit) && !hit.closest('.ar-box, button') ? hit : null;
    };
    for (const radius of [24, 16, 8, 0]) {
      for (const c of candidates) {
        const hit = free(c.x, c.y);
        if (!hit) continue;
        const ring = [
          [radius, 0],
          [-radius, 0],
          [0, radius],
          [0, -radius],
          [radius * 0.7, radius * 0.7],
          [-radius * 0.7, radius * 0.7],
          [radius * 0.7, -radius * 0.7],
          [-radius * 0.7, -radius * 0.7],
        ];
        if (ring.every(([dx, dy]) => free(c.x + dx, c.y + dy))) {
          return { ...c, clearance: radius, hit: hit.getAttribute('data-testid') || hit.tagName.toLowerCase() };
        }
      }
    }
    return null;
  });
  if (!point) throw new Error(`${selector}: no free press point (all covered by AR boxes/buttons)`);
  return point;
}

function pinchSteps(c, fromDist, toDist, moves = 8) {
  const pair = (d) => [
    { id: 1, x: c.x, y: c.y - d / 2 },
    { id: 2, x: c.x, y: c.y + d / 2 },
  ];
  const steps = [{ type: 'start', points: pair(fromDist) }];
  for (let i = 1; i <= moves; i += 1) {
    steps.push({ type: 'move', points: pair(fromDist + ((toDist - fromDist) * i) / moves) });
  }
  steps.push({ type: 'end', points: [] });
  return steps;
}

function dragSteps(start, dx, dy, moves = 8) {
  const steps = [{ type: 'start', points: [{ id: 1, x: start.x, y: start.y }] }];
  for (let i = 1; i <= moves; i += 1) {
    steps.push({
      type: 'move',
      points: [{ id: 1, x: start.x + (dx * i) / moves, y: start.y + (dy * i) / moves }],
    });
  }
  steps.push({ type: 'end', points: [] });
  return steps;
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
    await saveScreenshot(page, join(artifactsDir, `${label}.png`), { fullPage: false });
    rows.push(
      `${label} scrollX=${metrics.scrollX} client=${metrics.clientWidth} inner=${metrics.innerWidth} scrollW=${metrics.scrollWidth} left=${metrics.subjectLeft.toFixed(1)}`,
    );
  }
  writeFileSync(join(artifactsDir, `${name}-offset.txt`), `${rows.join('\n')}\n`, 'utf8');
  return rows;
}

async function releaseHold(page, selector) {
  await page.locator(selector).evaluate((el) => {
    try {
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [] }));
    } catch {
      /* ignore */
    }
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  });
}

function readPageStateInPage() {
  const html = document.documentElement;
  const body = document.body;
  const hc = getComputedStyle(html);
  const bc = getComputedStyle(body);
  return {
    scrollY: window.scrollY,
    htmlCss: html.style.cssText,
    bodyCss: body.style.cssText,
    computed: {
      htmlOverflowX: hc.overflowX,
      htmlOverflowY: hc.overflowY,
      htmlTouchAction: hc.touchAction,
      bodyOverflowX: bc.overflowX,
      bodyOverflowY: bc.overflowY,
      bodyTouchAction: bc.touchAction,
      bodyPosition: bc.position,
    },
    zoomAttr: html.getAttribute('data-inspect-zoom-mode'),
    overlay: Boolean(document.querySelector('[data-testid="inspect-zoom-overlay"]')),
  };
}

function diffPageState(pre, post) {
  const diffs = [];
  if (post.overlay) diffs.push('overlay still mounted');
  if (post.zoomAttr) diffs.push(`html[data-inspect-zoom-mode]=${post.zoomAttr}`);
  if (post.htmlCss !== pre.htmlCss) diffs.push(`html style "${pre.htmlCss}" -> "${post.htmlCss}"`);
  if (post.bodyCss !== pre.bodyCss) diffs.push(`body style "${pre.bodyCss}" -> "${post.bodyCss}"`);
  for (const key of Object.keys(pre.computed)) {
    if (pre.computed[key] !== post.computed[key]) {
      diffs.push(`${key} ${pre.computed[key]} -> ${post.computed[key]}`);
    }
  }
  if (Math.abs(post.scrollY - pre.scrollY) > 2) diffs.push(`scrollY ${pre.scrollY} -> ${post.scrollY}`);
  return diffs;
}

async function resetZoomUi(page) {
  if (await page.locator(SEL.overlay).count()) {
    await page.keyboard.press('Escape');
    await page.locator(SEL.overlay).waitFor({ state: 'detached', timeout: 3_000 }).catch(() => undefined);
  }
  await releaseHold(page, SEL.image).catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
}

/** (a) Idle photo: touch-action allows pan-y and a vertical swipe starting on the photo scrolls the page. */
async function assertIdleSwipeScrolls(page, driver) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const chain = await page.locator(SEL.image).evaluate((el) => {
    const out = [];
    for (let cur = el; cur; cur = cur.parentElement) {
      out.push({
        node: cur.getAttribute('data-testid') || cur.id || cur.tagName.toLowerCase(),
        touchAction: getComputedStyle(cur).touchAction,
      });
    }
    return out;
  });
  const imageTouchAction = chain[0]?.touchAction;
  const blocked = chain.filter(
    (c) => !(c.touchAction === 'auto' || c.touchAction === 'manipulation' || c.touchAction.includes('pan-y')),
  );
  if (blocked.length) throw new Error(`touch-action blocks pan-y: ${JSON.stringify(blocked)}`);
  const room = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
  if (room < 40) throw new Error(`page is not tall enough to scroll (room=${room}px)`);
  const c = await pressPointOn(page, SEL.image);
  const dy = Math.round(Math.max(60, Math.min(240, c.y - 24)));
  const before = await page.evaluate(() => window.scrollY);
  let how;
  if (driver.trusted) {
    await runGesture(page, driver, SEL.image, dragSteps(c, 0, -dy, 12));
    how = `cdp-touch-swipe dy=-${dy}`;
  } else {
    const synth = await syntheticGesture(page, SEL.image, dragSteps(c, 0, -dy, 6));
    if (synth.mode === 'pointer') throw new Error('engine has no synthetic TouchEvent to probe the swipe');
    const prevented = synth.results.filter((r) => r.defaultPrevented);
    if (prevented.length) {
      throw new Error(`synthetic ${synth.mode} swipe on the photo was defaultPrevented: ${JSON.stringify(prevented)}`);
    }
    // Untrusted touches never scroll natively (and mobile WebKit has no mouse.wheel), so apply the
    // browser's default pan-y action for the un-cancelled swipe and confirm the page really moves.
    await page.evaluate((d) => window.scrollBy(0, d), dy);
    how = `synthetic-${synth.mode} not defaultPrevented + emulated pan-y default scrollBy dy=${dy}`;
  }
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.scrollY);
  const blinking = await page.locator(`${SEL.image} [data-showing-baseline="true"]`).count();
  if (after - before < 20) {
    throw new Error(
      `vertical swipe on the photo did not scroll: scrollY ${before} -> ${after} (${how}, touch-action=${imageTouchAction})`,
    );
  }
  if (blinking) throw new Error('swipe left the reference photo showing (hold not cancelled by movement)');
  return `touch-action=${imageTouchAction} scrollY ${before}->${after} room=${room} via ${how}`;
}

/** (f) Italian one-line hint below the photo, never on it. */
async function assertItalianHint(page, artifactsDir, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await assertNoPinchOverlay(page, name);
  const hold = page.getByTestId('inspect-hold-hint');
  await hold.waitFor({ state: 'visible', timeout: 12_000 });
  const holdPe = await hold.evaluate((el) => getComputedStyle(el).pointerEvents);
  if (holdPe !== 'none') throw new Error(`hint pointer-events=${holdPe} (expected none)`);
  const holdText = ((await hold.textContent()) ?? '').trim();
  if (!holdText.includes(IT.pressHoldCompare)) throw new Error(`hint missing Italian copy: "${holdText}"`);
  if ((await page.getByTestId('inspect-hold-graphic').count()) < 1) {
    throw new Error('hint is missing the press/ring graphic');
  }
  const captionLine = await assertHoldCaptionSingleLine(page, `${name} before-press`);
  const geometry = await assertHoldOutsideImage(page, `${name} before-press`);
  await saveScreenshot(page, join(artifactsDir, `${name}-hold-hints.png`), { fullPage: false });
  await shotHintFrames(page, artifactsDir, name, 'hold');
  writeFileSync(join(artifactsDir, `${name}-hold-geometry.txt`), `${geometry}\n${captionLine}\n`, 'utf8');
  return `"${holdText}" ${geometry.replace(`${name} before-press `, '')}`;
}

/** (e) Press-and-hold shows the reference photo and the Italian status — idle or in zoom mode. */
async function assertHoldShowsReference(page, driver, artifactsDir, name, { zoom }) {
  const target = zoom ? SEL.stage : SEL.image;
  if (!zoom) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
  }
  const pressed = await pressPointOn(page, target);
  let info;
  let geometry = '';
  let via = driver.trusted ? 'cdp-touch-hold' : 'synthetic-touch-hold';
  try {
    if (driver.trusted) {
      await driver.send('touchStart', [{ id: 1, ...pressed }]);
    } else {
      const synth = await syntheticGesture(page, target, [{ type: 'start', points: [{ id: 1, ...pressed }] }]);
      if (synth.mode === 'pointer') {
        await dispatchHoldStart(page, target);
        via = 'synthetic-mousedown-hold';
      } else {
        via = `synthetic-${synth.mode}-hold`;
      }
    }
    await page.waitForTimeout(650);
    info = await page.evaluate((isZoom) => {
      const root = document.querySelector(
        isZoom ? '[data-testid="inspect-zoom-overlay"]' : '[data-testid="inspect-image-viewport"]',
      );
      const status = document.querySelector(
        isZoom ? '[data-testid="inspect-zoom-hint"]' : '[data-testid="inspect-hold-hint"]',
      );
      return {
        showing: Boolean(root?.querySelector('[data-showing-baseline="true"]')),
        text: (status?.textContent ?? '').trim(),
        scale: document.querySelector('[data-testid="inspect-zoom-stage"]')?.getAttribute('data-zoom-scale') ?? null,
      };
    }, zoom);
    if (!zoom && info.showing) {
      geometry = (await assertHoldOutsideImage(page, `${name} while-pressing`)).replace(`${name} while-pressing `, '');
      const prior = join(artifactsDir, `${name}-hold-geometry.txt`);
      const existing = existsSync(prior) ? readFileSync(prior, 'utf8') : '';
      writeFileSync(prior, `${existing}${name} while-pressing ${geometry}\n`, 'utf8');
    }
    await saveScreenshot(page, join(artifactsDir, `${name}-${zoom ? 'zoom-hold' : 'hold-status'}.png`), {
      fullPage: false,
    });
  } finally {
    if (driver.trusted) await driver.send('touchEnd', []);
    else {
      await syntheticGesture(page, target, [{ type: 'end', points: [] }]).catch(() => undefined);
      await releaseHold(page, target);
    }
    await page.waitForTimeout(150);
  }
  if (!info.showing) {
    throw new Error(
      `hold did not show the reference photo at (${Math.round(pressed.x)},${Math.round(pressed.y)}) hit=${pressed.hit} via ${via} (status="${info.text}")`,
    );
  }
  if (!info.text.includes(IT.goldenBaseline)) {
    throw new Error(`status is missing "${IT.goldenBaseline}": "${info.text}"`);
  }
  return `status="${info.text}"${zoom ? ` scale=${info.scale}` : ''}${geometry ? ` ${geometry}` : ''} via ${via}`;
}

/** (b) Magnifier opens the full-screen overlay. Returns the page state captured just before the tap. */
async function enterZoomMode(page, artifactsDir, name) {
  await page.evaluate(() => window.scrollTo(0, 36));
  await page.waitForTimeout(200);
  const pre = await page.evaluate(readPageStateInPage);
  const enter = page.locator(SEL.enter);
  const label = await enter.getAttribute('aria-label');
  if (label !== IT.zoomEnter) throw new Error(`magnifier aria-label="${label}" (expected "${IT.zoomEnter}")`);
  await enter.tap();
  await page.locator(SEL.overlay).waitFor({ state: 'visible', timeout: 3_000 });
  await page.waitForTimeout(150);
  const info = await page.evaluate(() => {
    const o = document.querySelector('[data-testid="inspect-zoom-overlay"]');
    const stage = document.querySelector('[data-testid="inspect-zoom-stage"]');
    const r = o.getBoundingClientRect();
    return {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      vw: window.innerWidth,
      vh: window.innerHeight,
      parentIsBody: o.parentElement === document.body,
      role: o.getAttribute('role'),
      modal: o.getAttribute('aria-modal'),
      bodyPosition: getComputedStyle(document.body).position,
      htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
      stageTouchAction: getComputedStyle(stage).touchAction,
      focused: document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName,
      exitLabel: document.querySelector('[data-testid="inspect-zoom-exit"]')?.getAttribute('aria-label'),
    };
  });
  const problems = [];
  const covers =
    Math.abs(info.rect.x) <= 1 &&
    Math.abs(info.rect.y) <= 1 &&
    Math.abs(info.rect.w - info.vw) <= 1 &&
    Math.abs(info.rect.h - info.vh) <= 1;
  if (!covers) problems.push(`overlay ${JSON.stringify(info.rect)} does not cover ${info.vw}x${info.vh}`);
  if (!info.parentIsBody) problems.push('overlay is not portaled to <body>');
  if (info.role !== 'dialog' || info.modal !== 'true') problems.push(`role=${info.role} aria-modal=${info.modal}`);
  if (info.bodyPosition !== 'fixed') problems.push(`body position=${info.bodyPosition} (scroll not locked)`);
  if (info.stageTouchAction !== 'none') problems.push(`stage touch-action=${info.stageTouchAction}`);
  if (info.exitLabel !== IT.zoomExit) problems.push(`X aria-label="${info.exitLabel}"`);
  if (problems.length) throw new Error(problems.join('; '));
  if (artifactsDir) {
    await saveScreenshot(page, join(artifactsDir, `${name}-zoom-enter.png`), { fullPage: false });
  }
  return {
    pre,
    detail: `overlay ${info.rect.w}x${info.rect.h} portal=body body=${info.bodyPosition} html.overflowY=${info.htmlOverflowY} stage touch-action=${info.stageTouchAction} focus=${info.focused}`,
  };
}

/** (c) Pinch then one-finger pan inside the overlay. */
async function assertPinchPanInOverlay(page, driver, artifactsDir, name) {
  const c = await centerOf(page, SEL.stage);
  const readScale = async () => Number(await page.locator(SEL.stage).getAttribute('data-zoom-scale'));
  const readTransform = () => page.locator(SEL.layer).evaluate((el) => el.style.transform);
  let mode = (await runGesture(page, driver, SEL.stage, pinchSteps(c, 80, 220))).mode;
  let scale = await readScale();
  if (!(scale > 1.5) && !driver.trusted) {
    await runGesture(page, driver, SEL.stage, pinchSteps(c, 80, 220), { forcePointer: true });
    scale = await readScale();
    mode = `${mode}->pointer`;
  }
  if (!(scale > 1.5)) throw new Error(`pinch did not zoom (data-zoom-scale=${scale}, via ${mode})`);
  const t0 = await readTransform();
  let panMode = (await runGesture(page, driver, SEL.stage, dragSteps(c, 60, 40))).mode;
  let t1 = await readTransform();
  if (t1 === t0 && !driver.trusted) {
    await runGesture(page, driver, SEL.stage, dragSteps(c, 60, 40), { forcePointer: true });
    t1 = await readTransform();
    panMode = `${panMode}->pointer`;
  }
  if (t1 === t0) throw new Error(`pan did not move the zoomed photo (${t0}, via ${panMode})`);
  const scaleAfterPan = await readScale();
  if (!(scaleAfterPan > 1.5)) throw new Error(`pan reset the zoom (scale ${scale} -> ${scaleAfterPan})`);
  if (await page.locator(`${SEL.overlay} [data-showing-baseline="true"]`).count()) {
    throw new Error('pinch/pan left the reference photo showing');
  }
  await saveScreenshot(page, join(artifactsDir, `${name}-zoom.png`), { fullPage: false });
  return `scale=${scale} via ${mode}; transform "${t0}" -> "${t1}" via ${panMode}`;
}

/** (d) Exit via X / Escape / Back and assert html/body styles, computed overflow/touch-action and scrollY are restored. */
async function exitAndAssertRestored(page, pre, how) {
  const urlBefore = page.url();
  if (how === 'x') {
    const exit = page.locator(SEL.exit);
    const label = await exit.getAttribute('aria-label');
    if (label !== IT.zoomExit) throw new Error(`X aria-label="${label}" (expected "${IT.zoomExit}")`);
    await exit.tap();
  } else if (how === 'esc') {
    await page.keyboard.press('Escape');
  } else {
    await page.goBack({ waitUntil: 'commit', timeout: 5_000 });
  }
  await page.locator(SEL.overlay).waitFor({ state: 'detached', timeout: 3_000 });
  await page.waitForTimeout(250);
  const post = await page.evaluate(readPageStateInPage);
  const diffs = diffPageState(pre, post);
  if (page.url() !== urlBefore) diffs.push(`url ${urlBefore} -> ${page.url()}`);
  if (!(await page.getByRole('button', { name: IT.finishInspection }).isVisible())) {
    diffs.push('left the results screen');
  }
  if (diffs.length) throw new Error(`not restored after ${how}: ${diffs.join('; ')}`);
  return `overlay gone; scrollY=${post.scrollY} html="${post.htmlCss}" body="${post.bodyCss}" overflowY=${post.computed.htmlOverflowY}/${post.computed.bodyOverflowY} touch-action=${post.computed.htmlTouchAction}/${post.computed.bodyTouchAction}`;
}

async function runCheck(rows, label, check, fn) {
  try {
    const detail = await fn();
    rows.push({ label, check, pass: true, detail: detail ?? '' });
    return true;
  } catch (err) {
    rows.push({ label, check, pass: false, detail: String(err?.message ?? err).split('\n')[0] });
    return false;
  }
}

const CHECK_SHORT = {
  'a-idle-swipe-scrolls': 'a',
  'b-magnifier-enters-overlay': 'b',
  'c-pinch-pan-scale': 'c',
  'c2-no-blink-flicker-in-zoom': 'c2',
  'd-x-exits-restores': 'd-x',
  'd-esc-exits-restores': 'd-esc',
  'd-back-exits-restores': 'd-back',
  'e-hold-reference-idle': 'e-idle',
  'e-hold-reference-zoom': 'e-zoom',
  'f-hint-italian-below-image': 'f',
  'layout-centered': 'center',
  'layout-rotate-no-offset': 'rotate',
  'setup-reach-results': 'setup',
};

const ZOOM_CHECKS = [
  'a-idle-swipe-scrolls',
  'b-magnifier-enters-overlay',
  'c-pinch-pan-scale',
  'd-x-exits-restores',
  'd-esc-exits-restores',
  'd-back-exits-restores',
  'e-hold-reference-idle',
  'e-hold-reference-zoom',
  'f-hint-italian-below-image',
];

/** Run checks (a)–(f) at one viewport size. Never throws; returns PASS/FAIL rows. */
async function verifyZoomModeAt(page, driver, artifactsDir, name, label, size) {
  const rows = [];
  await page.setViewportSize(size);
  await page.waitForTimeout(300);
  await resetZoomUi(page);
  await runCheck(rows, label, 'layout-centered', async () => {
    const m = await measureAndShotResults(page, artifactsDir, `${name}-results`);
    return `image ${m.image} left=${m.leftGap} right=${m.rightGap}`;
  });
  await runCheck(rows, label, 'f-hint-italian-below-image', () => assertItalianHint(page, artifactsDir, name));
  await runCheck(rows, label, 'e-hold-reference-idle', () =>
    assertHoldShowsReference(page, driver, artifactsDir, name, { zoom: false }),
  );
  await runCheck(rows, label, 'a-idle-swipe-scrolls', () => assertIdleSwipeScrolls(page, driver));

  let pre = null;
  const entered = await runCheck(rows, label, 'b-magnifier-enters-overlay', async () => {
    await resetZoomUi(page);
    const r = await enterZoomMode(page, artifactsDir, name);
    pre = r.pre;
    return r.detail;
  });
  if (entered) {
    await runCheck(rows, label, 'c-pinch-pan-scale', () => assertPinchPanInOverlay(page, driver, artifactsDir, name));
    await runCheck(rows, label, 'e-hold-reference-zoom', () =>
      assertHoldShowsReference(page, driver, artifactsDir, name, { zoom: true }),
    );
    await runCheck(rows, label, 'd-x-exits-restores', async () => {
      const restored = await exitAndAssertRestored(page, pre, 'x');
      await saveScreenshot(page, join(artifactsDir, `${name}-after-exit.png`), { fullPage: false });
      const swipe = await assertIdleSwipeScrolls(page, driver);
      return `${restored}; swipe-after-exit ${swipe}`;
    });
  } else {
    for (const check of ['c-pinch-pan-scale', 'e-hold-reference-zoom', 'd-x-exits-restores']) {
      rows.push({ label, check, pass: false, detail: 'skipped: magnifier did not open the overlay' });
    }
  }
  for (const how of ['esc', 'back']) {
    await runCheck(rows, label, `d-${how}-exits-restores`, async () => {
      await resetZoomUi(page);
      const r = await enterZoomMode(page, null, name);
      return exitAndAssertRestored(page, r.pre, how);
    });
  }
  await resetZoomUi(page);
  return rows;
}

function formatZoomReport(title, notes, rows) {
  const labels = [...new Set(rows.map((r) => r.label))];
  const checks = [...new Set([...ZOOM_CHECKS, ...rows.map((r) => r.check)])].filter((c) =>
    rows.some((r) => r.check === c),
  );
  const cell = (label, check) => {
    const hits = rows.filter((r) => r.label === label && r.check === check);
    if (!hits.length) return '-';
    return hits.every((r) => r.pass) ? 'PASS' : 'FAIL';
  };
  const short = (c) => CHECK_SHORT[c] ?? c;
  const cols = checks.map((c) => ({ c, head: short(c), w: Math.max(4, short(c).length) }));
  const width = Math.max(...labels.map((l) => l.length), 'device / orientation'.length);
  const matrix = [
    `${'device / orientation'.padEnd(width)}  ${cols.map((k) => k.head.padEnd(k.w)).join('  ')}`,
    ...labels.map((l) => `${l.padEnd(width)}  ${cols.map((k) => cell(l, k.c).padEnd(k.w)).join('  ')}`),
  ];
  const fails = rows.filter((r) => !r.pass).length;
  return [
    title,
    ...notes.map((n) => `# ${n}`),
    '',
    `checks: ${checks.join(', ')}`,
    ...matrix,
    '',
    ...rows.map((r) => `${r.pass ? 'PASS' : 'FAIL'}  ${r.label}  ${r.check}  ${r.detail}`),
    '',
    `SUMMARY ${fails === 0 ? 'PASS' : 'FAIL'} pass=${rows.length - fails} fail=${fails}`,
    '',
  ].join('\n');
}

async function countFlickerDuringPinch(page, selector) {
  return page.locator(selector).evaluate(async (el) => {
    let blinkToggles = 0;
    let scaleResets = 0;
    let lastBlink = el.querySelector('[data-showing-baseline]')?.getAttribute('data-showing-baseline') ?? 'false';
    let lastScale = Number(el.getAttribute('data-zoom-scale') ?? '1');
    const obs = new MutationObserver(() => {
      const blink = el.querySelector('[data-showing-baseline]')?.getAttribute('data-showing-baseline') ?? 'false';
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
    let supported = true;
    try {
      const touch = (id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
      const fire = (type, touches) => {
        el.dispatchEvent(
          new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: touches }),
        );
      };
      fire('touchstart', [touch(0, cx, cy - 40)]);
      const pair = (dist) => [touch(0, cx, cy - dist / 2), touch(1, cx, cy + dist / 2)];
      fire('touchstart', pair(80));
      for (let i = 0; i < 10; i += 1) {
        const fingers = pair(90 + i * 12);
        fire('touchmove', fingers);
        fire('touchend', [fingers[0]]);
        fire('touchstart', fingers);
      }
      fire('touchend', []);
    } catch {
      supported = false;
    }
    await new Promise((r) => setTimeout(r, 80));
    obs.disconnect();
    return {
      supported,
      blinkToggles,
      scaleResets,
      showingBaseline: el.querySelector('[data-showing-baseline="true"]') !== null,
      scale: Number(el.getAttribute('data-zoom-scale') ?? '1'),
    };
  });
}

function clipFromBox(box, pageSize) {
  if (!box) return undefined;
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const maxW = pageSize?.width ?? box.x + box.width;
  const maxH = pageSize?.height ?? box.y + box.height;
  return {
    x,
    y,
    width: Math.max(1, Math.min(box.width, maxW - x)),
    height: Math.max(1, Math.min(box.height, maxH - y)),
  };
}

function unionBoxes(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

function boxesIntersect(a, b, slop = 1) {
  return !(
    a.x + a.width <= b.x + slop ||
    b.x + b.width <= a.x + slop ||
    a.y + a.height <= b.y + slop ||
    b.y + b.height <= a.y + slop
  );
}

function boxInsideViewport(box, pageSize, slop = 2) {
  return (
    box.x >= -slop &&
    box.y >= -slop &&
    box.x + box.width <= pageSize.width + slop &&
    box.y + box.height <= pageSize.height + slop
  );
}

async function clipInspectViewport(page) {
  const box = await page.getByTestId('inspect-image-viewport').boundingBox();
  return clipFromBox(box, page.viewportSize());
}

async function clipInspectHoldStage(page) {
  const image = await page.getByTestId('inspect-image-viewport').boundingBox();
  const hold = await page.getByTestId('inspect-hold-hint').boundingBox().catch(() => null);
  return clipFromBox(unionBoxes(image, hold), page.viewportSize());
}

function formatHoldGeometry(name, image, hold, pageSize, ok) {
  return [
    `${name} image=${Math.round(image.width)}x${Math.round(image.height)}@${Math.round(image.x)},${Math.round(image.y)}`,
    `hold=${Math.round(hold.width)}x${Math.round(hold.height)}@${Math.round(hold.x)},${Math.round(hold.y)}`,
    `intersect=${boxesIntersect(image, hold)} below=${hold.y + 1 >= image.y + image.height} inViewport=${boxInsideViewport(hold, pageSize)}`,
    `ok=${ok}`,
  ].join(' ');
}

async function assertHoldCaptionSingleLine(page, name) {
  const metrics = await page.getByTestId('inspect-hold-hint').evaluate((el) => {
    const caption = el.querySelector('.inspect-hint-caption');
    if (!caption) return { error: 'missing .inspect-hint-caption' };
    const cs = getComputedStyle(caption);
    const rects = caption.getClientRects();
    return {
      text: (caption.textContent ?? '').trim(),
      whiteSpace: cs.whiteSpace,
      overflow: cs.overflowX || cs.overflow,
      textOverflow: cs.textOverflow,
      fontSize: cs.fontSize,
      rectCount: rects.length,
      captionHeight: caption.getBoundingClientRect().height,
      scrollWidth: Math.round(caption.scrollWidth),
      clientWidth: Math.round(caption.clientWidth),
    };
  });
  if (metrics.error) {
    throw new Error(`${name}: ${metrics.error}`);
  }
  if (metrics.whiteSpace !== 'nowrap') {
    throw new Error(`${name}: hold caption white-space=${metrics.whiteSpace} (expected nowrap)`);
  }
  if (metrics.rectCount !== 1) {
    throw new Error(`${name}: hold caption wrapped to ${metrics.rectCount} line boxes`);
  }
  return [
    `${name} caption="${metrics.text}"`,
    `whiteSpace=${metrics.whiteSpace}`,
    `rects=${metrics.rectCount}`,
    `fontSize=${metrics.fontSize}`,
    `overflow=${metrics.overflow}`,
    `textOverflow=${metrics.textOverflow}`,
    `height=${Math.round(metrics.captionHeight)}`,
    `fits=${metrics.scrollWidth <= metrics.clientWidth + 1}`,
    `scrollW=${metrics.scrollWidth}/${metrics.clientWidth}`,
  ].join(' ');
}

async function assertHoldOutsideImage(page, name) {
  const image = await page.getByTestId('inspect-image-viewport').boundingBox();
  const hold = await page.getByTestId('inspect-hold-hint').boundingBox();
  const pageSize = page.viewportSize();
  if (!image || !hold || !pageSize) {
    throw new Error(`${name}: missing image/hold/viewport boxes`);
  }
  if (boxesIntersect(image, hold)) {
    throw new Error(`${name}: hold/status intersects the image frame`);
  }
  if (hold.y + 1 < image.y + image.height) {
    throw new Error(`${name}: hold/status is not below the image (hold.y=${hold.y} image.bottom=${image.y + image.height})`);
  }
  if (!boxInsideViewport(hold, pageSize)) {
    throw new Error(
      `${name}: hold/status not fully in viewport hold=${Math.round(hold.x)},${Math.round(hold.y)} ${Math.round(hold.width)}x${Math.round(hold.height)} vp=${pageSize.width}x${pageSize.height}`,
    );
  }
  const insideViewport = await page.getByTestId('inspect-image-viewport').evaluate((el) => {
    const hint = document.querySelector('[data-testid="inspect-hold-hint"]');
    return Boolean(hint && el.contains(hint));
  });
  if (insideViewport) {
    throw new Error(`${name}: hold hint is still a descendant of the image viewport`);
  }
  return formatHoldGeometry(name, image, hold, pageSize, true);
}

async function shotHintFrames(page, artifactsDir, name, kind) {
  const clip = kind === 'hold' ? await clipInspectHoldStage(page) : await clipInspectViewport(page);
  for (let i = 0; i < 3; i += 1) {
    if (i > 0) await page.waitForTimeout(400);
    await saveScreenshot(page, join(artifactsDir, `${name}-${kind}-frame-${i}.png`), { clip });
  }
}

async function assertNoPinchOverlay(page, name) {
  const count = await page.getByTestId('inspect-pinch-hint').count();
  if (count === 0) return;
  const visible = await page.getByTestId('inspect-pinch-hint').isVisible().catch(() => false);
  if (visible) {
    throw new Error(`${name}: pinch overlay must not appear on inspect results`);
  }
}

async function measureAndShotResults(page, artifactsDir, name) {
  const pageSize = page.viewportSize();
  const viewportBox = await page.getByTestId('inspect-image-viewport').boundingBox();
  const center = assertCenteredBox(viewportBox, pageSize.width, name);
  await saveScreenshot(page, join(artifactsDir, `${name}.png`), { fullPage: false });
  return {
    viewport: `${pageSize.width}x${pageSize.height}`,
    image: `${Math.round(viewportBox.width)}x${Math.round(viewportBox.height)} @ ${Math.round(viewportBox.x)},${Math.round(viewportBox.y)}`,
    leftGap: center.leftGap.toFixed(1),
    rightGap: center.rightGap.toFixed(1),
    delta: center.delta.toFixed(1),
  };
}

async function driveInspectScan(page, artifactsDir, context, engine) {
  mkdirSync(artifactsDir, { recursive: true });
  await waitForCameraIdle(page);
  await waitForShelfHydrated(page);
  if (await page.getByTestId('baseline-status-pill').getByText(IT.baselineNotSet).isVisible().catch(() => false)) {
    await driveEstablishBaseline(page, join(artifactsDir, 'preflight-baseline'));
  }
  await page.getByTestId('baseline-status-pill').getByText(IT.baselineEstablished).waitFor({
    timeout: 15_000,
  });
  await captureAppHeaderOrientations(
    page,
    artifactsDir,
    'inspect-scan-360',
    { width: 360, height: 800 },
    { width: 800, height: 360 },
  );
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

  const driver = await createTouchDriver(page, context, engine);
  const rows = [];
  for (const [label, size] of [
    ['390x844 portrait', { width: 390, height: 844 }],
    ['844x390 landscape', { width: 844, height: 390 }],
    ['932x430 landscape', { width: 932, height: 430 }],
  ]) {
    rows.push(
      ...(await verifyZoomModeAt(page, driver, artifactsDir, `inspect-scan-${size.width}x${size.height}`, label, size)),
    );
  }
  copyFileSync(join(artifactsDir, 'inspect-scan-390x844-results.png'), join(artifactsDir, 'inspect-scan-results.png'));

  await page.setViewportSize({ width: 390, height: 844 });
  await resetZoomUi(page);
  await runCheck(rows, '390x844 portrait', 'c2-no-blink-flicker-in-zoom', async () => {
    await enterZoomMode(page, null, 'inspect-scan-390x844');
    const flicker = await countFlickerDuringPinch(page, SEL.stage);
    await resetZoomUi(page);
    if (!flicker.supported) throw new Error('Touch() unavailable for the rapid 1↔2 finger sequence');
    if (flicker.blinkToggles || flicker.scaleResets || flicker.showingBaseline) {
      throw new Error(`blinkToggles=${flicker.blinkToggles} scaleResets=${flicker.scaleResets} showingBaseline=${flicker.showingBaseline}`);
    }
    return `rapid 1<->2 finger: blinkToggles=0 scaleResets=0 scale=${flicker.scale}`;
  });
  await runCheck(rows, 'rotate', 'layout-rotate-no-offset', async () => {
    const rotation = await rotateAndAssertNoOffset(page, artifactsDir, 'inspect-scan-rotate');
    return `${rotation.length} orientation changes, scrollX=0`;
  });
  const aria = await page.locator('body').ariaSnapshot();
  writeFileSync(join(artifactsDir, 'inspect-scan.aria.txt'), aria, 'utf8');

  const report = formatZoomReport(
    `inspect-scan zoom-mode report (Chromium ${driver.method})`,
    [
      'a idle photo touch-action allows pan-y and a vertical touch swipe on it scrolls window.scrollY',
      'b magnifier opens a full-screen portal overlay; c pinch+pan scale>1; d X/Esc/Back exit and restore styles+scroll',
      'e hold shows the reference (idle and zoom); f Italian hint below, not on, the photo',
    ],
    rows,
  );
  writeFileSync(join(artifactsDir, 'inspect-scan-zoom-report.txt'), report, 'utf8');
  const failures = rows.filter((r) => !r.pass);
  return {
    ok: failures.length === 0,
    firstCaptureComparison: true,
    checks: rows.length,
    failures: failures.map((r) => `${r.label} ${r.check}: ${r.detail}`),
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
  await saveScreenshot(page, join(artifactsDir, 'multi-shelf-2-empty-baseline.png'), { fullPage: true });
  return { shelf: 2 };
}

async function reachInspectResults(page, artifactsDir, headerSizes) {
  await waitForCameraIdle(page);
  await waitForShelfHydrated(page);
  if (await page.getByTestId('baseline-status-pill').getByText(IT.baselineNotSet).isVisible().catch(() => false)) {
    mkdirSync(join(artifactsDir, 'preflight-baseline'), { recursive: true });
    await page.getByTestId('baseline-photo-input').waitFor({ state: 'attached', timeout: 10_000 });
    await page.getByTestId('baseline-photo-input').setInputFiles(BASELINE_FIXTURE);
    await page.getByTestId('baseline-status-pill').getByText(IT.baselineEstablished).waitFor({
      timeout: 30_000,
    });
    await saveScreenshot(page, join(artifactsDir, 'preflight-baseline', 'establish-baseline-camera.png'), {
      fullPage: true,
    });
  }
  await page.getByTestId('baseline-status-pill').getByText(IT.baselineEstablished).waitFor({
    timeout: 15_000,
  });
  if (headerSizes) {
    await captureAppHeaderOrientations(
      page,
      artifactsDir,
      headerSizes.prefix,
      headerSizes.portrait,
      headerSizes.landscape,
    );
  }
  await page.getByRole('button', { name: IT.pickFromGallery }).click();
  await page.getByTestId('gallery-input').setInputFiles(CAPTURE_FIXTURE);
  await page.getByRole('button', { name: IT.finishInspection }).waitFor({
    timeout: 120_000,
  });
  await page.getByText(IT.auditResult).waitFor({ timeout: 5_000 });
}

async function driveInspectScanOnDevice(page, context, engine, artifactsDir, device) {
  mkdirSync(artifactsDir, { recursive: true });
  const slug = deviceSlug(device.name);
  const portraitSpec = devices[device.name];
  const landscapeSpec = devices[`${device.name} landscape`];
  if (!portraitSpec?.viewport || !landscapeSpec?.viewport) {
    throw new Error(`No Playwright portrait/landscape profile for ${device.name}`);
  }
  await reachInspectResults(page, artifactsDir, {
    prefix: `inspect-scan-${slug}`,
    portrait: portraitSpec.viewport,
    landscape: landscapeSpec.viewport,
  });
  const driver = await createTouchDriver(page, context, engine);
  const rows = [];
  for (const [orientation, spec] of [
    ['portrait', portraitSpec],
    ['landscape', landscapeSpec],
  ]) {
    rows.push(
      ...(await verifyZoomModeAt(
        page,
        driver,
        artifactsDir,
        `inspect-scan-${slug}-${orientation}`,
        `${device.name} ${orientation}`,
        spec.viewport,
      )),
    );
  }
  return { device: device.name, engine: device.engine, platform: device.platform, method: driver.method, rows };
}

async function driveInspectScanCrossPlatform(url, artifactsDir, { device: onlyDevice } = {}) {
  mkdirSync(artifactsDir, { recursive: true });
  const selected = onlyDevice
    ? CROSS_PLATFORM_DEVICES.filter((d) => d.name === onlyDevice)
    : CROSS_PLATFORM_DEVICES;
  if (onlyDevice && selected.length === 0) {
    throw new Error(`Unknown cross-platform device: ${onlyDevice}`);
  }
  const rows = [];
  const methods = new Map();
  const writeReport = () =>
    writeFileSync(
      join(artifactsDir, 'cross-platform-report.txt'),
      formatZoomReport(
        'inspect-scan-cross-platform zoom-mode report',
        [
          ...[...methods].map(([name, method]) => `${name}: ${method}`),
          'Chromium: pinch/pan/hold/swipe are trusted CDP touches; the idle swipe is a real compositor scroll.',
          'WebKit: SYNTHETIC — Playwright cannot inject WebKit touches except tap(); pinch/pan/hold are untrusted TouchEvents built from document.createTouch/createTouchList (PointerEvent pointerType=mouse fallback).',
          'WebKit (a) = computed touch-action allows pan-y on the photo and every ancestor AND the synthetic touchstart/touchmove swipe on the photo is not defaultPrevented by any listener AND the emulated pan-y default action (scrollBy) moves window.scrollY.',
          'Magnifier and X are pressed with trusted locator.tap() on every engine; Esc via keyboard.press; Back via page.goBack().',
        ],
        rows,
      ),
      'utf8',
    );
  for (const device of selected) {
    const dir = join(artifactsDir, deviceSlug(device.name));
    try {
      const result = await withBrowser(
        url,
        (page, context, engine) => driveInspectScanOnDevice(page, context, engine, dir, device),
        { device: device.name, engine: device.engine },
      );
      methods.set(`${device.name} (${device.engine})`, result.method);
      rows.push(...result.rows);
    } catch (err) {
      methods.set(`${device.name} (${device.engine})`, 'setup failed');
      rows.push({
        label: device.name,
        check: 'setup-reach-results',
        pass: false,
        detail: String(err?.message ?? err).replace(/[\s║╔╗╚╝═]+/g, ' ').slice(0, 400),
      });
    }
    writeReport();
  }
  const failures = rows.filter((r) => !r.pass);
  return {
    ok: failures.length === 0,
    devices: selected.map((d) => d.name),
    checks: rows.length,
    failures: failures.map((r) => `${r.label} ${r.check}: ${r.detail}`),
  };
}

async function withLocalArtifacts(destDir, fn) {
  const tmpArt = join(tmpdir(), `sg-art-${process.pid}-${Date.now()}`);
  mkdirSync(tmpArt, { recursive: true });
  mkdirSync(destDir, { recursive: true });
  let result;
  let runErr;
  try {
    result = await fn(tmpArt);
  } catch (err) {
    runErr = err;
  }
  const copied = spawnSync('cp', ['-a', `${tmpArt}/.`, destDir]);
  if (copied.status !== 0) {
    spawnSync('sleep', ['0.4']);
    spawnSync('cp', ['-a', `${tmpArt}/.`, destDir]);
  }
  spawnSync('rm', ['-rf', tmpArt]);
  if (runErr) throw runErr;
  return result;
}

async function browserDrive(featureId, { url = DEFAULT_URL, artifactsDir, engine, device }) {
  if (!artifactsDir) {
    console.error('browser drive requires --artifacts-dir');
    process.exit(2);
  }
  const result = await withLocalArtifacts(artifactsDir, async (dir) => {
    if (featureId === 'inspect-scan-cross-platform') {
      return driveInspectScanCrossPlatform(url, dir, { device });
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
    return withBrowser(url, (page, context, browserEngine) => driver(page, dir, context, browserEngine), { engine, device });
  });
  const ok = result?.ok !== false;
  console.log(JSON.stringify({ featureId, ...result, ok }, null, 2));
  if (!ok) {
    console.error(`${featureId}: FAIL (${result.failures?.length ?? 0} failing checks)`);
    process.exitCode = 1;
  }
}

async function browserSnapshot({ url = DEFAULT_URL, artifactsDir, name = 'snapshot' }) {
  if (!artifactsDir) {
    console.error('browser snapshot requires --artifacts-dir');
    process.exit(2);
  }
  mkdirSync(artifactsDir, { recursive: true });
  await withBrowser(url, async (page) => {
    await waitForCameraIdle(page);
    await saveScreenshot(page, join(artifactsDir, `${name}.png`), { fullPage: true });
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
