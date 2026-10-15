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
    await context.addInitScript(installScrollProbes);
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
 *   magnifier/X buttons) and refuses `mouse.wheel` on mobile WebKit. Pinch, pan and hold are untrusted
 *   JS `TouchEvent`s (or `PointerEvent` pointerType=mouse when `new Touch()` is unavailable). Page
 *   scroll on WebKit is a static proof (see assertSwipeScrolls) — never a scripted scrollBy.
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
    method: 'synthetic JS TouchEvent/PointerEvent (untrusted) for pinch/pan/hold; scroll = static proof; trusted tap()',
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

/**
 * Installed before any app script (context.addInitScript). Records live touchstart/touchmove/wheel
 * listeners with their passive flag, and every programmatic scroll the page issues (window.scrollTo/
 * scroll/scrollBy, Element.scroll*, scrollTop/scrollLeft on html/body) with the event that caused it.
 * No layout is touched: the harness never injects height or padding.
 */
function installScrollProbes() {
  if (window.__sgProbe) return;
  const probe = { listeners: [], scrollCalls: [] };
  window.__sgProbe = probe;
  const TRACKED = new Set(['touchstart', 'touchmove', 'wheel']);
  const captureOf = (o) => (typeof o === 'object' && o !== null ? Boolean(o.capture) : Boolean(o));
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (TRACKED.has(type) && fn) {
      const passive = typeof opts === 'object' && opts !== null && 'passive' in opts ? Boolean(opts.passive) : null;
      // WebKit reports this wrapper as the top frame, so search the whole stack for a page-origin
      // frame: app listeners have one, Playwright's injected hit-target interceptor does not.
      const frames = (new Error().stack ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      const appFrame = frames.find((l) => l.includes(location.origin));
      const from = appFrame ?? frames.find((l) => !/installScrollProbes|addEventListener|^Error/.test(l)) ?? '?';
      probe.listeners.push({ target: this, type, fn, capture: captureOf(opts), passive, app: Boolean(appFrame), from: from.slice(0, 120) });
    }
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    if (TRACKED.has(type)) {
      const capture = captureOf(opts);
      const i = probe.listeners.findIndex((l) => l.target === this && l.type === type && l.fn === fn && l.capture === capture);
      if (i >= 0) probe.listeners.splice(i, 1);
    }
    return remove.call(this, type, fn, opts);
  };
  const record = (fn, args) =>
    probe.scrollCalls.push({
      fn,
      args: String(args).slice(0, 60),
      event: window.event?.type ?? null,
      t: Math.round(performance.now()),
    });
  const wrap = (obj, name, label) => {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    obj[name] = function (...args) {
      record(label, JSON.stringify(args));
      return orig.apply(this, args);
    };
  };
  for (const name of ['scrollTo', 'scroll', 'scrollBy']) {
    wrap(window, name, `window.${name}`);
    wrap(Element.prototype, name, `Element.${name}`);
  }
  for (const prop of ['scrollTop', 'scrollLeft']) {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    if (!d?.set) continue;
    Object.defineProperty(Element.prototype, prop, {
      ...d,
      set(v) {
        if (this === document.documentElement || this === document.body) record(`${this.tagName.toLowerCase()}.${prop}=`, v);
        d.set.call(this, v);
      },
    });
  }
}

/**
 * Natural scroll topology of the results page (in page). The window must be the single vertical
 * scroller: no ancestor of `startSelector`'s hit element (besides <html>, whose overflow goes to the
 * viewport) may be a scroll container, nothing else may hold overflowing vertical content, html/body
 * carry no scroll lock, and no non-passive touchstart/touchmove listener sits on window, document or
 * any ancestor of the hit element.
 */
function readScrollTopologyInPage({ imageSelector, point }) {
  const html = document.documentElement;
  const body = document.body;
  const se = document.scrollingElement;
  const image = document.querySelector(imageSelector);
  const start = point ? document.elementFromPoint(point.x, point.y) : image;
  const name = (el) =>
    el === window ? 'window' : el === document ? 'document' : el.getAttribute?.('data-testid') || (el.id ? `#${el.id}` : el.tagName?.toLowerCase());
  const hc = getComputedStyle(html);
  const htmlVisible = hc.overflowX === 'visible' && hc.overflowY === 'visible';
  // A user-scrollable box (auto/scroll on either axis — e.g. overflow-x: hidden silently forces
  // overflow-y: auto) can latch a swipe. overflow: hidden on both axes is not user-scrollable and
  // swipes chain through it, like clip/visible.
  const isScrollContainer = (el) => {
    if (el === html) return false;
    if (el === body && htmlVisible) return false; // body overflow propagates to the viewport
    const cs = getComputedStyle(el);
    return [cs.overflowX, cs.overflowY].some((v) => v === 'auto' || v === 'scroll');
  };
  const chain = [];
  for (let cur = start; cur; cur = cur.parentElement) chain.push(cur);
  const touchActionBlocked = chain
    .map((el) => ({ node: name(el), touchAction: getComputedStyle(el).touchAction }))
    .filter((c) => !(c.touchAction === 'auto' || c.touchAction === 'manipulation' || c.touchAction.includes('pan-y')));
  const nestedScrollers = chain.filter(isScrollContainer).map((el) => {
    const cs = getComputedStyle(el);
    return `${name(el)}(${cs.overflowX}/${cs.overflowY})`;
  });
  const overflowing = [...document.querySelectorAll('body, body *')]
    .filter((el) => {
      const oy = getComputedStyle(el).overflowY;
      return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el !== se;
    })
    .map((el) => `${name(el)} sh=${el.scrollHeight} ch=${el.clientHeight}`);
  const bc = getComputedStyle(body);
  const locks = [];
  if (bc.position === 'fixed') locks.push('body position:fixed');
  if (hc.overflowY === 'hidden' || hc.overflowY === 'clip') locks.push(`html overflow-y:${hc.overflowY}`);
  if (!htmlVisible && (bc.overflowY === 'hidden' || bc.overflowY === 'clip')) locks.push(`body overflow-y:${bc.overflowY}`);
  if (html.hasAttribute('data-inspect-zoom-mode')) locks.push('html[data-inspect-zoom-mode]');
  const probe = window.__sgProbe;
  const rootish = (t) => t === window || t === document || t === html || t === body;
  const onPath = probe
    ? probe.listeners
        .filter((l) => l.type === 'touchstart' || l.type === 'touchmove')
        .filter((l) => rootish(l.target) || (l.target instanceof Node && l.target.contains(start)))
        // Browsers default touch listeners on window/document/html/body to passive when unspecified.
        .filter((l) => !(l.passive ?? rootish(l.target)))
    : [];
  // Only listeners registered by the page's own scripts count. Playwright's action hit-target
  // interceptor registers from injected code (Chromium `<anonymous>`, WebKit `web-inspector://`).
  const fromApp = (l) => l.app;
  const nonPassive = probe
    ? onPath.filter(fromApp).map((l) => `${name(l.target)}:${l.type}${l.capture ? '(capture)' : ''} from ${l.from}`)
    : ['listener probe not installed'];
  const harnessListeners = onPath.filter((l) => !fromApp(l)).length;
  return {
    start: start ? name(start) : null,
    insideImage: Boolean(image && start && image.contains(start)),
    scrollingElement: se.tagName.toLowerCase(),
    scrollHeight: se.scrollHeight,
    clientHeight: se.clientHeight,
    innerHeight: window.innerHeight,
    room: se.scrollHeight - window.innerHeight,
    htmlOverflow: `${hc.overflowX}/${hc.overflowY}`,
    bodyOverflow: `${bc.overflowX}/${bc.overflowY}`,
    touchActionBlocked,
    nestedScrollers,
    overflowing,
    locks,
    nonPassive,
    harnessListeners,
  };
}

function topologyProblems(t) {
  const p = [];
  if (!(t.room > 0)) {
    p.push(`content is not taller than the viewport (scrollHeight=${t.scrollHeight} innerHeight=${t.innerHeight}) — nothing to scroll`);
  }
  if (t.scrollHeight <= t.clientHeight) p.push(`scrollingElement ${t.scrollingElement} has no vertical overflow`);
  if (t.touchActionBlocked.length) p.push(`touch-action blocks pan-y: ${JSON.stringify(t.touchActionBlocked)}`);
  if (t.nestedScrollers.length) p.push(`nested scroll containers on the touch path: ${t.nestedScrollers.join(', ')}`);
  if (t.overflowing.length) p.push(`other vertical scrollers with overflow: ${t.overflowing.join(', ')}`);
  if (t.locks.length) p.push(`scroll lock left on html/body: ${t.locks.join(', ')}`);
  if (t.nonPassive.length) p.push(`non-passive touch listeners on the scroll path: ${t.nonPassive.join(', ')}`);
  return p;
}

function describeTopology(t) {
  return `natural scrollHeight=${t.scrollHeight} innerHeight=${t.innerHeight} room=${t.room} scroller=${t.scrollingElement} html=${t.htmlOverflow} body=${t.bodyOverflow} app-non-passive-touch=${t.nonPassive.length} (harness-injected excluded=${t.harnessListeners})`;
}

/** Start point for a swipe on the page but off the photo, clear of controls (inputs/buttons). */
async function pageSwipePoint(page) {
  return page.evaluate((imageSelector) => {
    const image = document.querySelector(imageSelector);
    const header = document.querySelector('header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    for (let y = window.innerHeight - 24; y > headerBottom + 80; y -= 12) {
      for (const x of [12, window.innerWidth - 12, window.innerWidth / 2]) {
        const el = document.elementFromPoint(x, y);
        if (!el || image?.contains(el)) continue;
        if (el.closest('input, button, select, textarea, a, [role="slider"], header')) continue;
        return { x, y };
      }
    }
    return null;
  }, SEL.image);
}

async function readScrollCalls(page) {
  return page.evaluate(() => window.__sgProbe?.scrollCalls.slice() ?? null);
}

async function resetScrollCalls(page) {
  await page.evaluate(() => {
    if (window.__sgProbe) window.__sgProbe.scrollCalls.length = 0;
  });
}

/**
 * (a/g) A vertical swipe that starts on the photo (`where='image'`) or on the page off the photo
 * (`where='page'`) scrolls the window. Starts from the natural layout at scrollY=0 — no injected height.
 * - Chromium: trusted CDP Input.dispatchTouchEvent swipe; window.scrollY must move >= 20 px and
 *   the app must issue no programmatic scroll during the gesture.
 * - WebKit: Playwright cannot inject trusted touch (and refuses mouse.wheel on mobile WebKit), so this
 *   is a static proof — no scrollBy: computed touch-action allows pan-y on the whole chain to <html>,
 *   no nested scroll container, no non-passive touchstart/touchmove listener on window/document/any
 *   ancestor, no scroll lock on html/body, the window has natural vertical overflow, and an untrusted
 *   swipe there is not defaultPrevented.
 */
async function assertSwipeScrolls(page, driver, where) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  let point;
  if (where === 'image') point = await pressPointOn(page, SEL.image);
  else point = await pageSwipePoint(page);
  if (!point) throw new Error(`no ${where} point clear of controls to start a swipe`);
  const topo = await page.evaluate(readScrollTopologyInPage, { imageSelector: SEL.image, point: { x: point.x, y: point.y } });
  if (where === 'image' && !topo.insideImage) throw new Error(`swipe start (${point.x},${point.y}) hits ${topo.start}, not the photo`);
  if (where === 'page' && topo.insideImage) throw new Error(`swipe start (${point.x},${point.y}) is on the photo`);
  const problems = topologyProblems(topo);
  const dy = Math.round(Math.max(60, Math.min(240, point.y - 40)));
  const at = `start=${topo.start}@(${Math.round(point.x)},${Math.round(point.y)})`;
  if (!driver.trusted) {
    const synth = await syntheticGesture(page, where === 'image' ? SEL.image : 'body', dragSteps(point, 0, -dy, 6));
    const prevented = synth.results.filter((r) => r.defaultPrevented);
    if (prevented.length) problems.push(`untrusted ${synth.mode} swipe defaultPrevented: ${JSON.stringify(prevented)}`);
    const blinking = await page.locator(`${SEL.image} [data-showing-baseline="true"]`).count();
    if (blinking) problems.push('swipe left the reference photo showing (hold not cancelled by movement)');
    if (problems.length) throw new Error(problems.join('; '));
    return `STATIC(WebKit) ${at} ${describeTopology(topo)}; pan-y chain ok, no nested scroller, no non-passive touch listener, no lock, untrusted swipe not defaultPrevented`;
  }
  await resetScrollCalls(page);
  const before = await page.evaluate(() => window.scrollY);
  await runGesture(page, driver, where === 'image' ? SEL.image : 'body', dragSteps(point, 0, -dy, 12));
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.scrollY);
  const calls = await readScrollCalls(page);
  if (after - before < 20) problems.push(`trusted CDP swipe did not scroll: scrollY ${before} -> ${after}`);
  if (calls?.length) problems.push(`app issued ${calls.length} programmatic scroll(s) during the swipe: ${JSON.stringify(calls.slice(0, 3))}`);
  const blinking = await page.locator(`${SEL.image} [data-showing-baseline="true"]`).count();
  if (blinking) problems.push('swipe left the reference photo showing (hold not cancelled by movement)');
  if (problems.length) throw new Error(`${problems.join('; ')} [${describeTopology(topo)}]`);
  return `cdp-touch-swipe ${at} dy=-${dy} scrollY ${before}->${after} ${describeTopology(topo)}`;
}

/**
 * (h) No scroll fighting: mobile browsers collapse/expand the URL bar or Safari toolbars while the
 * user scrolls, which fires window `resize` and visualViewport `resize`/`scroll`. The app must not
 * answer with window.scrollTo (that kills momentum and snaps back to a stale main-thread scrollY).
 * Chromium: trusted CDP swipe with the viewport growing 4×14 px mid-gesture; WebKit: viewport
 * resizes at a non-zero scrollY. Either way: zero programmatic scroll calls, scrollY not reset.
 */
async function assertNoScrollFight(page, driver, size) {
  const steps = [14, 28, 42, 56];
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  let detail;
  if (driver.trusted) {
    const point = await pressPointOn(page, SEL.image);
    const dy = Math.round(Math.max(80, Math.min(240, point.y - 40)));
    await resetScrollCalls(page);
    const moves = dragSteps(point, 0, -dy, 16);
    let i = 0;
    for (const s of moves) {
      if (s.type === 'start') await driver.send('touchStart', s.points);
      else if (s.type === 'move') {
        await driver.send('touchMove', s.points);
        i += 1;
        if (i >= 4 && i < 4 + steps.length) await page.setViewportSize({ width: size.width, height: size.height + steps[i - 4] });
      } else await driver.send('touchEnd', []);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => window.scrollY);
    detail = `cdp swipe dy=-${dy} with viewport +${steps.join('/+')}px mid-gesture: scrollY 0->${after}`;
    if (after < 20) {
      await page.setViewportSize(size);
      throw new Error(`swipe with toolbar collapse did not scroll (${detail})`);
    }
  } else {
    await page.evaluate(() => window.scrollTo(0, 120));
    await page.waitForTimeout(200);
    await resetScrollCalls(page);
    const before = await page.evaluate(() => window.scrollY);
    for (const s of steps) {
      await page.setViewportSize({ width: size.width, height: size.height + s });
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => window.scrollY);
    detail = `viewport +${steps.join('/+')}px (toolbar collapse) at scrollY ${before}: after=${after}`;
  }
  const calls = await readScrollCalls(page);
  await page.setViewportSize(size);
  await page.waitForTimeout(300);
  if (calls === null) throw new Error('scroll probe not installed');
  if (calls.length) {
    const byEvent = {};
    for (const c of calls) byEvent[`${c.fn}@${c.event ?? 'timer/raf'}`] = (byEvent[`${c.fn}@${c.event ?? 'timer/raf'}`] ?? 0) + 1;
    throw new Error(`app issued ${calls.length} programmatic scroll(s) while the user scrolled: ${JSON.stringify(byEvent)} (${detail})`);
  }
  return `0 programmatic scrolls; ${detail}`;
}

/** Playwright WebKit refuses mouse.wheel on mobile; record the attempt so the report says so. */
async function tryWheelScroll(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const c = await centerOf(page, SEL.image);
  try {
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(400);
    return `mouse.wheel over photo: scrollY 0->${await page.evaluate(() => window.scrollY)}`;
  } catch (err) {
    return `mouse.wheel unavailable: ${String(err?.message ?? err).split('\n')[0]}`;
  }
}

/** Chromium only: CDP Input.synthesizeScrollGesture (touch). Informational — headless builds may no-op it. */
async function trySynthesizedScroll(page, context) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const p = await pageSwipePoint(page);
  if (!p) return 'synthesizeScrollGesture: no start point';
  const cdp = await context.newCDPSession(page);
  const done = await Promise.race([
    cdp
      .send('Input.synthesizeScrollGesture', { x: p.x, y: p.y, yDistance: -Math.round(Math.min(240, p.y - 40)), gestureSourceType: 'touch', speed: 1200 })
      .then(() => 'completed'),
    new Promise((r) => setTimeout(() => r('timed out'), 8_000)),
  ]);
  await page.waitForTimeout(300);
  return `synthesizeScrollGesture(touch) ${done}: scrollY 0->${await page.evaluate(() => window.scrollY)}`;
}

/**
 * Scroll as a user would to look at the photo: stay at the initial position when photo + hint
 * already fit in the viewport, else put the photo's top at the viewport top (clamped to max scroll).
 */
async function scrollPhotoIntoView(page) {
  const y = await page.evaluate(() => {
    window.scrollTo(0, 0);
    const img = document.querySelector('[data-testid="inspect-image-viewport"]').getBoundingClientRect();
    const hint = document.querySelector('[data-testid="inspect-hold-hint"]')?.getBoundingClientRect();
    const bottom = Math.max(img.bottom, hint?.bottom ?? img.bottom);
    if (img.top >= 0 && bottom <= window.innerHeight) return 0;
    const max = document.scrollingElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.max(0, Math.min(Math.round(img.top), max)));
    return window.scrollY;
  });
  await page.waitForTimeout(150);
  return y;
}

/** (i) Photo size vs viewport (recorded metric) and no horizontal overflow, at the initial scroll. */
async function assertImageSize(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="inspect-image-viewport"]').getBoundingClientRect();
    return {
      w: r.width,
      h: r.height,
      left: r.left,
      right: r.right,
      vw: window.innerWidth,
      vh: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  const metric = {
    image: `${Math.round(m.w)}x${Math.round(m.h)}`,
    viewport: `${m.vw}x${m.vh}`,
    area: ((m.w * m.h) / (m.vw * m.vh)) * 100,
  };
  const detail = `image ${metric.image} viewport ${metric.viewport} area ${metric.area.toFixed(1)}% left=${m.left.toFixed(1)} right=${m.right.toFixed(1)} scrollWidth=${m.scrollWidth}/${m.vw}`;
  const problems = [];
  if (m.scrollWidth > m.vw) problems.push(`document scrollWidth ${m.scrollWidth} > innerWidth ${m.vw}`);
  if (m.right > m.vw + 0.5) problems.push(`image right ${m.right.toFixed(1)} > innerWidth ${m.vw}`);
  if (m.left < -0.5) problems.push(`image left ${m.left.toFixed(1)} < 0`);
  if (problems.length) throw new Error(`${problems.join('; ')} (${detail})`);
  return { detail, metric };
}

/** Rounded `inspect-image-viewport` rect size (not position) plus the viewport, read in page. */
async function readImageRect(page) {
  return page.evaluate(() => {
    const r = document.querySelector('[data-testid="inspect-image-viewport"]').getBoundingClientRect();
    return { w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight, scrollY: window.scrollY };
  });
}

const fmtRect = (r) => `${Math.round(r.w)}x${Math.round(r.h)}`;
const sameSize = (a, b, slop = 0.5) => Math.abs(a.w - b.w) <= slop && Math.abs(a.h - b.h) <= slop;

/**
 * (j) The photo keeps its size while the mobile URL bar collapses/expands and the page scrolls:
 * (1) viewport +70px tall, same width (toolbar collapse); (2) scroll — Chromium trusted CDP swipe
 * (rect read mid-gesture), WebKit window.scrollTo steps (size-only check) — and after it settles;
 * (3) viewport back to its size. Every rect must equal the initial one (±0.5px).
 */
async function assertSizeStable(page, driver, size) {
  const GROW = 70;
  await page.setViewportSize(size);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const initial = await readImageRect(page);
  const sizes = { initial: fmtRect(initial) };
  const problems = [];
  const expect = (key, r) => {
    sizes[key] = fmtRect(r);
    if (!sameSize(initial, r)) problems.push(`${key} ${r.w.toFixed(1)}x${r.h.toFixed(1)} != initial ${initial.w.toFixed(1)}x${initial.h.toFixed(1)} (viewport ${r.vw}x${r.vh})`);
  };
  try {
    await page.setViewportSize({ width: size.width, height: size.height + GROW });
    await page.waitForTimeout(300);
    expect('plus70', await readImageRect(page));

    let during = null;
    if (driver.trusted) {
      const point = await pressPointOn(page, SEL.image);
      const dy = Math.round(Math.max(80, Math.min(240, point.y - 40)));
      const moves = dragSteps(point, 0, -dy, 12);
      let i = 0;
      for (const s of moves) {
        if (s.type === 'start') await driver.send('touchStart', s.points);
        else if (s.type === 'move') {
          await driver.send('touchMove', s.points);
          i += 1;
          if (i === 8) during = await readImageRect(page);
        } else await driver.send('touchEnd', []);
        await page.waitForTimeout(16);
      }
    } else {
      for (const y of [40, 80, 120, 160]) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(30);
        if (y === 120) during = await readImageRect(page);
      }
    }
    expect('during', during);
    await page.waitForTimeout(500);
    const after = await readImageRect(page);
    expect('afterScroll', after);
    if (driver.trusted && after.scrollY < 20) problems.push(`swipe did not scroll (scrollY ${after.scrollY})`);
    sizes.scrollY = after.scrollY;

    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    expect('minus70', await readImageRect(page));
  } finally {
    await page.setViewportSize(size);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
  }
  const detail = `initial ${sizes.initial} | +${GROW}px ${sizes.plus70} | during scroll ${sizes.during} | after scroll ${sizes.afterScroll} (scrollY ${sizes.scrollY}) | -${GROW}px ${sizes.minus70} [${driver.trusted ? 'cdp swipe' : 'window.scrollTo'}]`;
  if (problems.length) {
    const err = new Error(`${problems.join('; ')} (${detail})`);
    err.sizes = sizes;
    throw err;
  }
  return { detail, sizes };
}

/**
 * (k) Rotation recomputes the size: from `from` to `to` (the other orientation's viewport) the photo
 * must take the size it has when that orientation is laid out on its own (`expectTo`, the `size`
 * row), and rotating back must restore `expectFrom`.
 */
async function assertSizeRotation(page, from, to, expectFrom, expectTo) {
  await page.setViewportSize(from);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const start = await readImageRect(page);
  await page.setViewportSize(to);
  await page.waitForTimeout(400);
  const rotated = await readImageRect(page);
  await page.setViewportSize(from);
  await page.waitForTimeout(400);
  const back = await readImageRect(page);
  const detail = `${from.width}x${from.height} ${fmtRect(start)} -> ${to.width}x${to.height} ${fmtRect(rotated)} (expect ${expectTo ?? '?'}) -> back ${fmtRect(back)} (expect ${expectFrom ?? '?'})`;
  const problems = [];
  if (expectFrom && fmtRect(start) !== expectFrom) problems.push(`start ${fmtRect(start)} != ${expectFrom}`);
  if (expectTo && fmtRect(rotated) !== expectTo) problems.push(`rotated ${fmtRect(rotated)} != ${expectTo}`);
  if (sameSize(start, rotated)) problems.push('size stuck at the pre-rotation value');
  if (!sameSize(start, back)) problems.push(`rotating back ${fmtRect(back)} != original ${fmtRect(start)}`);
  if (problems.length) throw new Error(`${problems.join('; ')} (${detail})`);
  return { detail, rotated: fmtRect(rotated), back: fmtRect(back) };
}

/** (f) Italian one-line hint directly below the photo, never on it, visible with the photo in view. */
async function assertItalianHint(page, artifactsDir, name) {
  await scrollPhotoIntoView(page);
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
  if (!zoom) await scrollPhotoIntoView(page);
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
  'a-scroll-image-before-zoom': 'a-img',
  'a-scroll-page-before-zoom': 'a-page',
  'h-no-scroll-fight': 'h-fight',
  'b-magnifier-enters-overlay': 'b',
  'c-pinch-pan-scale': 'c',
  'c2-no-blink-flicker-in-zoom': 'c2',
  'd-x-exits-restores': 'd-x',
  'g-scroll-image-after-exit': 'g-img',
  'g-scroll-page-after-exit': 'g-page',
  'd-esc-exits-restores': 'd-esc',
  'd-back-exits-restores': 'd-back',
  'e-hold-reference-idle': 'e-idle',
  'e-hold-reference-zoom': 'e-zoom',
  'f-hint-italian-below-image': 'f',
  'i-image-size-no-hoverflow': 'size',
  'j-size-stable': 'j-size',
  'k-size-rotation': 'k-rot',
  'layout-centered': 'center',
  'layout-rotate-no-offset': 'rotate',
  'setup-reach-results': 'setup',
};

const ZOOM_CHECKS = [
  'a-scroll-image-before-zoom',
  'a-scroll-page-before-zoom',
  'h-no-scroll-fight',
  'b-magnifier-enters-overlay',
  'c-pinch-pan-scale',
  'd-x-exits-restores',
  'g-scroll-image-after-exit',
  'g-scroll-page-after-exit',
  'd-esc-exits-restores',
  'd-back-exits-restores',
  'e-hold-reference-idle',
  'e-hold-reference-zoom',
  'f-hint-italian-below-image',
  'i-image-size-no-hoverflow',
  'j-size-stable',
  'k-size-rotation',
];

/** k-size-rotation both ways between two labelled viewports, expecting each one's `size` row. */
async function runRotationChecks(page, rows, a, b) {
  const sizeOf = (label) => rows.find((r) => r.label === label && r.metric)?.metric.image ?? null;
  for (const [from, to] of [
    [a, b],
    [b, a],
  ]) {
    let rotated = null;
    await runCheck(rows, from.label, 'k-size-rotation', async () => {
      const r = await assertSizeRotation(page, from.size, to.size, sizeOf(from.label), sizeOf(to.label));
      rotated = r.rotated;
      return r.detail;
    });
    if (rotated) rows[rows.length - 1].rotated = rotated;
  }
}

/** Run the scroll + zoom checks at one viewport size. Never throws; returns PASS/FAIL rows. */
async function verifyZoomModeAt(page, driver, artifactsDir, name, label, size) {
  const rows = [];
  await page.setViewportSize(size);
  await page.waitForTimeout(300);
  await resetZoomUi(page);
  await runCheck(rows, label, 'layout-centered', async () => {
    const m = await measureAndShotResults(page, artifactsDir, `${name}-results`);
    return `image ${m.image} left=${m.leftGap} right=${m.rightGap}`;
  });
  let sizeMetric = null;
  await runCheck(rows, label, 'i-image-size-no-hoverflow', async () => {
    const r = await assertImageSize(page);
    sizeMetric = r.metric;
    return r.detail;
  });
  if (sizeMetric) rows[rows.length - 1].metric = sizeMetric;
  await runCheck(rows, label, 'f-hint-italian-below-image', () => assertItalianHint(page, artifactsDir, name));
  await runCheck(rows, label, 'e-hold-reference-idle', () =>
    assertHoldShowsReference(page, driver, artifactsDir, name, { zoom: false }),
  );
  await runCheck(rows, label, 'a-scroll-image-before-zoom', () => assertSwipeScrolls(page, driver, 'image'));
  await runCheck(rows, label, 'a-scroll-page-before-zoom', () => assertSwipeScrolls(page, driver, 'page'));
  await runCheck(rows, label, 'h-no-scroll-fight', () => assertNoScrollFight(page, driver, size));
  let stable = null;
  await runCheck(rows, label, 'j-size-stable', async () => {
    try {
      const r = await assertSizeStable(page, driver, size);
      stable = r.sizes;
      return r.detail;
    } catch (err) {
      stable = err.sizes ?? null;
      throw err;
    }
  });
  if (stable) rows[rows.length - 1].stable = stable;

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
    const exited = await runCheck(rows, label, 'd-x-exits-restores', async () => {
      const restored = await exitAndAssertRestored(page, pre, 'x');
      await saveScreenshot(page, join(artifactsDir, `${name}-after-exit.png`), { fullPage: false });
      return restored;
    });
    if (exited) {
      await runCheck(rows, label, 'g-scroll-image-after-exit', () => assertSwipeScrolls(page, driver, 'image'));
      await runCheck(rows, label, 'g-scroll-page-after-exit', () => assertSwipeScrolls(page, driver, 'page'));
    } else {
      for (const check of ['g-scroll-image-after-exit', 'g-scroll-page-after-exit']) {
        rows.push({ label, check, pass: false, detail: 'skipped: X did not exit zoom mode' });
      }
    }
  } else {
    for (const check of [
      'c-pinch-pan-scale',
      'e-hold-reference-zoom',
      'd-x-exits-restores',
      'g-scroll-image-after-exit',
      'g-scroll-page-after-exit',
    ]) {
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
  const sized = rows.filter((r) => r.metric);
  const sizeTable = sized.length
    ? [
        'image size (inspect-image-viewport at initial scroll):',
        `${'device / orientation'.padEnd(width)}  ${'image'.padEnd(9)}  ${'viewport'.padEnd(9)}  area`,
        ...sized.map(
          (r) =>
            `${r.label.padEnd(width)}  ${r.metric.image.padEnd(9)}  ${r.metric.viewport.padEnd(9)}  ${r.metric.area.toFixed(1)}%`,
        ),
        '',
      ]
    : [];
  const stableRows = rows.filter((r) => r.stable);
  const rotatedBy = (label) => rows.find((r) => r.label === label && r.rotated)?.rotated ?? '-';
  const stableTable = stableRows.length
    ? [
        'size stability (j-size-stable / k-size-rotation):',
        `${'device / orientation'.padEnd(width)}  ${['initial', '+70px', 'during', 'after', '-70px', 'rotated'].map((h) => h.padEnd(9)).join('  ')}`,
        ...stableRows.map((r) => {
          const s = r.stable;
          return `${r.label.padEnd(width)}  ${[s.initial, s.plus70, s.during, s.afterScroll, s.minus70, rotatedBy(r.label)].map((v) => String(v ?? '-').padEnd(9)).join('  ')}`;
        }),
        '',
      ]
    : [];
  return [
    title,
    ...notes.map((n) => `# ${n}`),
    '',
    `checks: ${checks.join(', ')}`,
    ...matrix,
    '',
    ...sizeTable,
    ...stableTable,
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
    `intersect=${boxesIntersect(image, hold)} below=${hold.y + 1 >= image.y + image.height} gap=${Math.round(hold.y - (image.y + image.height))} inViewport=${boxInsideViewport(hold, pageSize)}`,
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
  if (hold.y - (image.y + image.height) > 32) {
    throw new Error(`${name}: hold/status is not directly below the image (gap ${Math.round(hold.y - (image.y + image.height))}px)`);
  }
  if (image.y < -2) {
    throw new Error(`${name}: image top ${Math.round(image.y)} is above the viewport with the photo scrolled into view`);
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
  const synthNote = await trySynthesizedScroll(page, context);
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
  await runRotationChecks(
    page,
    rows,
    { label: '390x844 portrait', size: { width: 390, height: 844 } },
    { label: '844x390 landscape', size: { width: 844, height: 390 } },
  );

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
      'a-img/a-page trusted CDP touch swipe on the photo / on the page off the photo moves window.scrollY from the natural layout (no injected height); g-* the same after X exit',
      'h-fight no programmatic window/html/body scroll while the user scrolls and the viewport resizes (URL bar collapse)',
      `probes: ${synthNote}`,
      'b magnifier opens a full-screen portal overlay; c pinch+pan scale>1; d X/Esc/Back exit and restore styles+scroll',
      'e hold shows the reference (idle and zoom); f Italian hint directly below, not on, the photo and in the viewport with the photo scrolled into view',
      'size: photo WxH vs viewport and area % at the initial scroll; FAIL on horizontal overflow (scrollWidth or photo right edge > innerWidth)',
      'j-size: photo WxH unchanged (±0.5px) after viewport +70px (URL bar collapse), during/after a trusted CDP swipe, and after -70px',
      'k-rot: rotating to the other viewport gives that orientation\'s size row; rotating back restores the original',
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
  const probeNote = engine === 'chromium' ? await trySynthesizedScroll(page, context) : await tryWheelScroll(page);
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
  await runRotationChecks(
    page,
    rows,
    { label: `${device.name} portrait`, size: portraitSpec.viewport },
    { label: `${device.name} landscape`, size: landscapeSpec.viewport },
  );
  return { device: device.name, engine: device.engine, platform: device.platform, method: `${driver.method}; ${probeNote}`, rows };
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
          'No height/padding is injected: every scroll row reports the natural document.scrollingElement scrollHeight vs innerHeight (room).',
          'Chromium: pinch/pan/hold/swipe are trusted CDP touches; a-*/g-* are real compositor scrolls asserted on window.scrollY; h-fight resizes the viewport mid-swipe like a collapsing URL bar.',
          'WebKit: SYNTHETIC — Playwright cannot inject WebKit touches except tap() and refuses mouse.wheel on mobile WebKit; pinch/pan/hold are untrusted TouchEvents built from document.createTouch/createTouchList (PointerEvent pointerType=mouse fallback).',
          'WebKit a-*/g-* = STATIC (no scrollBy): touch-action allows pan-y from the start element to <html>; no nested scroll container on that chain; no other overflowing vertical scroller; no non-passive touchstart/touchmove listener on window/document/ancestors (addEventListener instrumented at init); no position:fixed/overflow hidden on html/body; the window has natural vertical overflow; the untrusted swipe is not defaultPrevented.',
          'WebKit h-fight = viewport resizes (toolbar collapse) at scrollY 120 issue zero programmatic scrolls (window.scrollTo etc. instrumented at init).',
          'Magnifier and X are pressed with trusted locator.tap() on every engine; Esc via keyboard.press; Back via page.goBack().',
          'size: photo WxH vs viewport and area % at the initial scroll; FAIL if document scrollWidth > innerWidth or the photo right edge > innerWidth.',
          'j-size: photo WxH unchanged (±0.5px) after viewport +70px (URL bar collapse), during/after a scroll (Chromium trusted CDP swipe; WebKit window.scrollTo, size-only), and after -70px.',
          'k-rot: rotating portrait<->landscape (Playwright profile viewports) gives the other orientation\'s size row; rotating back restores the original.',
          'f / e-idle geometry: hint directly below the photo (gap <= 32px) and fully in the viewport with the photo scrolled into view (its top at the viewport top, or the initial scroll if photo + hint already fit).',
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
