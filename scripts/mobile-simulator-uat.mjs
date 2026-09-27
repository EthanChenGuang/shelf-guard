/**
 * Mobile phone simulator UAT (Playwright device profiles + fake camera).
 * Usage: PREVIEW_URL=http://127.0.0.1:4173 node scripts/mobile-simulator-uat.mjs
 */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const outDir = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/mobile-simulator-uat';
mkdirSync(outDir, { recursive: true });

const deviceNames = ['iPhone 14 Pro', 'Pixel 7'];
const report = { baseUrl, devices: [], passed: true };

async function runFullCaptureFlow(page, deviceDir, log) {
  await page.locator('#shutter-trigger').click({ force: true });
  await page.getByRole('button', { name: '确认并保存基准' }).waitFor({ timeout: 30_000 });
  log('roi-open');
  await page.getByRole('button', { name: '确认并保存基准' }).click();
  await page.getByText('基准图 (已建立)').waitFor({ timeout: 20_000 });
  log('baseline-saved');

  const slider = page.getByTestId('ghost-opacity-slider');
  await slider.waitFor({ timeout: 10_000 });
  const before = await slider.getAttribute('aria-valuenow');
  await page.getByRole('button', { name: 'Ghost +10' }).click({ force: true });
  await page.getByRole('button', { name: 'Ghost +10' }).click({ force: true });
  await page.waitForTimeout(150);
  const after = await slider.getAttribute('aria-valuenow');
  if (Number(after) <= Number(before)) {
    throw new Error(`Ghost slider stuck: before=${before} after=${after}`);
  }
  log('ghost-slider-moved', { before, after });

  await page.locator('#shutter-trigger').click({ force: true });
  const outcome = await Promise.race([
    page.getByText('合规度').waitFor({ timeout: 90_000 }).then(() => 'result'),
    page.getByText('分析失败，请重试拍摄').waitFor({ timeout: 90_000 }).then(() => 'analysis-fail'),
  ]);
  if (outcome !== 'result') {
    throw new Error('Second shutter did not reach compliance result');
  }
  log('second-shutter-ok');
  await page.screenshot({ path: join(deviceDir, '03-after-scan.png'), fullPage: false });
}

async function runSwitchSmoke(page, log) {
  const switchBtn = page.getByTestId('switch-camera-button');
  await switchBtn.waitFor({ timeout: 10_000 });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warn' || msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await switchBtn.click({ force: true });
  await page.waitForTimeout(800);
  await switchBtn.click({ force: true });
  await page.waitForTimeout(800);
  const overconstrained = consoleErrors.some((t) => /OverconstrainedError/i.test(t));
  log('switch-camera-smoke', {
    overconstrainedOnFakeDevice: overconstrained,
    note: overconstrained
      ? 'Chromium fake camera often lacks a front lens; real phones should still flip.'
      : 'Switch completed without constraint errors',
  });
}

async function runOnDevice(deviceName) {
  const device = devices[deviceName];
  const slug = deviceName.replace(/\s+/g, '-').toLowerCase();
  const deviceDir = join(outDir, slug);
  mkdirSync(deviceDir, { recursive: true });

  const entry = { deviceName, steps: [], ok: true };
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const context = await browser.newContext({
    ...device,
    permissions: ['camera'],
    recordVideo: { dir: deviceDir, size: device.viewport },
  });

  const page = await context.newPage();
  const log = (step, extra = {}) => {
    entry.steps.push({ step, ...extra });
    console.log(`[${deviceName}] ${step}`, extra);
  };

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('#shutter-trigger', { timeout: 25_000 });
    log('camera-live');

    const zoomCount = await page.getByTestId('zoom-level-row').count();
    if (zoomCount !== 0) {
      throw new Error(`Zoom preset row visible (count=${zoomCount})`);
    }
    log('no-zoom-preset-row');
    await page.screenshot({ path: join(deviceDir, '01-camera-idle.png'), fullPage: false });

    await runFullCaptureFlow(page, deviceDir, log);

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('#shutter-trigger', { timeout: 25_000 });
    await runSwitchSmoke(page, log);
    await page.screenshot({ path: join(deviceDir, '04-switch-smoke.png'), fullPage: false });
  } catch (err) {
    entry.ok = false;
    log('exception', { message: err.message });
    await page.screenshot({ path: join(deviceDir, 'error.png'), fullPage: true }).catch(() => {});
  }

  await context.close();
  await browser.close();
  report.devices.push(entry);
  if (!entry.ok) report.passed = false;
}

for (const name of deviceNames) {
  await runOnDevice(name);
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('\n=== SUMMARY ===', JSON.stringify(report, null, 2));
process.exit(report.passed ? 0 : 1);
