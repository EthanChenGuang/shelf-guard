#!/usr/bin/env node
/**
 * Playwright harness for ShelfGuard verification.
 * Invoked from .cursor/skills/verify-shelfguard/SKILL.md — do not run against a dev server you did not start for verification.
 */
import { chromium } from 'playwright';
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

function usage() {
  console.error(`Usage:
  control-shelfguard doctor [--url URL] [--pid-file PATH]
  control-shelfguard browser drive <feature-id> [--url URL] [--artifacts-dir DIR]
  control-shelfguard browser snapshot [--url URL] [--artifacts-dir DIR] [--name NAME]

Feature ids: establish-baseline, inspect-scan, multi-shelf
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
    else out._.push(a);
  }
  return out;
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

async function withBrowser(url, fn) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'it-IT',
      permissions: ['camera'],
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
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
  return { pill };
}

async function dispatchPinch(page, selector, fromDist, toDist) {
  await page.locator(selector).evaluate((el, { fromDist, toDist }) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const touch = (id, x, y) =>
      new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    const pair = (dist) => [
      touch(0, cx, cy - dist / 2),
      touch(1, cx, cy + dist / 2),
    ];
    const start = pair(fromDist);
    const moved = pair(toDist);
    el.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: start,
        targetTouches: start,
        changedTouches: start,
      }),
    );
    el.dispatchEvent(
      new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: moved,
        targetTouches: moved,
        changedTouches: moved,
      }),
    );
    el.dispatchEvent(
      new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        touches: [],
        targetTouches: [],
        changedTouches: moved,
      }),
    );
  }, { fromDist, toDist });
}

async function dispatchHoldStart(page, selector) {
  await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const t = new Touch({ identifier: 0, target: el, clientX: x, clientY: y });
    el.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [t],
        targetTouches: [t],
        changedTouches: [t],
      }),
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

async function pinchAndBlinkViewport(page, artifactsDir, name) {
  const selector = '[data-testid="inspect-image-viewport"]';
  const viewport = page.getByTestId('inspect-image-viewport');
  if (await page.getByTestId('inspect-image-fullscreen').count()) {
    throw new Error(`${name}: comparison fullscreen overlay is still present`);
  }
  if (await page.getByTestId('inspect-image-fullscreen-open').count()) {
    throw new Error(`${name}: fullscreen expand control is still present`);
  }
  await dispatchPinch(page, selector, 80, 220);
  const scale = await viewport.getAttribute('data-zoom-scale');
  if (!scale || Number(scale) <= 1.05) {
    throw new Error(`${name}: pinch zoom did not apply (data-zoom-scale=${scale})`);
  }
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
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [] }));
  });
  await dispatchPinch(page, selector, 400, 80);
  return Number(scale);
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
  const portrait = await measureAndShotResults(page, artifactsDir, 'inspect-scan-results-390x844');
  metrics.push(`390x844 results ${portrait.image} left=${portrait.leftGap} right=${portrait.rightGap} delta=${portrait.delta}`);
  copyFileSync(join(artifactsDir, 'inspect-scan-results-390x844.png'), join(artifactsDir, 'inspect-scan-results.png'));
  zoomScales['390x844'] = await pinchAndBlinkViewport(page, artifactsDir, 'inspect-scan-390x844');
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
    zoomScales[label] = await pinchAndBlinkViewport(page, artifactsDir, `inspect-scan-${label}`);
  }

  writeFileSync(join(artifactsDir, 'inspect-scan-center.txt'), `${metrics.join('\n')}\n`, 'utf8');
  const aria = await page.locator('body').ariaSnapshot();
  writeFileSync(join(artifactsDir, 'inspect-scan.aria.txt'), aria, 'utf8');
  return {
    hasFinish: true,
    centered: true,
    firstCaptureComparison: true,
    noFullscreen: true,
    zoomScales,
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

async function browserDrive(featureId, { url = DEFAULT_URL, artifactsDir }) {
  if (!artifactsDir) {
    console.error('browser drive requires --artifacts-dir');
    process.exit(2);
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
  const result = await withBrowser(url, (page) => driver(page, artifactsDir));
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
