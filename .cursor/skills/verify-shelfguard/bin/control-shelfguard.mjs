#!/usr/bin/env node
/**
 * Playwright harness for ShelfGuard verification.
 * Invoked from .cursor/skills/verify-shelfguard/SKILL.md — do not run against a dev server you did not start for verification.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

async function driveEstablishBaseline(page, artifactsDir) {
  mkdirSync(artifactsDir, { recursive: true });
  await waitForCameraIdle(page);
  await page.getByTestId('baseline-status-pill').getByText(IT.baselineNotSet).waitFor({
    timeout: 15_000,
  });
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

async function driveInspectScan(page, artifactsDir) {
  mkdirSync(artifactsDir, { recursive: true });
  await waitForCameraIdle(page);
  if (await page.getByTestId('baseline-status-pill').getByText(IT.baselineNotSet).isVisible().catch(() => false)) {
    await driveEstablishBaseline(page, join(artifactsDir, 'preflight-baseline'));
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

  const viewportBox = await page.getByTestId('inspect-image-viewport').boundingBox();
  const pageSize = page.viewportSize();
  if (!viewportBox || !pageSize) throw new Error('Could not measure comparison image');
  const leftGap = viewportBox.x;
  const rightGap = pageSize.width - (viewportBox.x + viewportBox.width);
  const centerDelta = Math.abs(leftGap - rightGap);
  writeFileSync(
    join(artifactsDir, 'inspect-scan-center.txt'),
    `viewport=${pageSize.width}x${pageSize.height}\nimage=${Math.round(viewportBox.width)}x${Math.round(viewportBox.height)} @ ${Math.round(viewportBox.x)},${Math.round(viewportBox.y)}\nleftGap=${leftGap.toFixed(1)} rightGap=${rightGap.toFixed(1)} delta=${centerDelta.toFixed(1)}\n`,
    'utf8',
  );
  if (centerDelta > 8) {
    throw new Error(`Comparison image is not centered (left ${leftGap.toFixed(1)} vs right ${rightGap.toFixed(1)})`);
  }
  await page.screenshot({ path: join(artifactsDir, 'inspect-scan-results.png'), fullPage: false });

  await page.getByTestId('inspect-image-fullscreen-open').click();
  const overlay = page.getByTestId('inspect-image-fullscreen');
  await overlay.waitFor({ state: 'visible', timeout: 5_000 });
  const overlayBox = await overlay.boundingBox();
  if (!overlayBox) throw new Error('Fullscreen overlay has no box');
  if (Math.abs(overlayBox.width - pageSize.width) > 2 || Math.abs(overlayBox.height - pageSize.height) > 2) {
    throw new Error(
      `Fullscreen overlay does not fill the phone viewport: ${Math.round(overlayBox.width)}x${Math.round(overlayBox.height)} vs ${pageSize.width}x${pageSize.height}`,
    );
  }
  await page.screenshot({ path: join(artifactsDir, 'inspect-scan-fullscreen.png'), fullPage: false });

  await dispatchPinch(page, '[data-testid="inspect-image-fullscreen-stage"]', 80, 220);
  const scale = await page.getByTestId('inspect-image-fullscreen-stage').getAttribute('data-zoom-scale');
  if (!scale || Number(scale) <= 1.05) {
    throw new Error(`Pinch zoom did not apply (data-zoom-scale=${scale})`);
  }
  await dispatchHoldStart(page, '[data-testid="inspect-image-fullscreen-stage"]');
  await page.waitForTimeout(550);
  const blinking = await overlay.locator('[data-showing-baseline="true"]').count();
  if (blinking < 1) {
    throw new Error('Zoomed blink-compare did not show the baseline image');
  }
  await page.screenshot({ path: join(artifactsDir, 'inspect-scan-fullscreen-blink-zoomed.png'), fullPage: false });

  await page.getByTestId('inspect-image-fullscreen-close').click();
  await overlay.waitFor({ state: 'hidden', timeout: 5_000 });
  const aria = await page.locator('body').ariaSnapshot();
  writeFileSync(join(artifactsDir, 'inspect-scan.aria.txt'), aria, 'utf8');
  return { hasFinish: true, hasFullscreen: true, centered: true, zoomScale: Number(scale) };
}

async function driveMultiShelf(page, artifactsDir) {
  mkdirSync(artifactsDir, { recursive: true });
  await waitForCameraIdle(page);
  await page.getByRole('button', { name: 'Shelf 2', exact: true }).click();
  await page.getByRole('button', { name: 'Shelf 2' }).getAttribute('aria-pressed').then((v) => {
    if (v !== 'true') throw new Error('Shelf 2 not selected after click');
  });
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
