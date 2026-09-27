import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const outDir = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ['camera'],
  recordVideo: { dir: outDir, size: { width: 412, height: 915 } },
});

const page = await context.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

const report = { baseUrl, steps: [] };

function note(step, extra = {}) {
  const entry = { step, ...extra };
  report.steps.push(entry);
  console.log(JSON.stringify(entry));
}

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#shutter-trigger', { timeout: 20_000 });
  note('camera-ready', {
    cameraError: await page.locator('[role="alert"]').allTextContents(),
  });

  await page.locator('#shutter-trigger').click({ force: true });
  await page.getByRole('button', { name: '确认并保存基准' }).waitFor({ timeout: 20_000 });
  await page.screenshot({ path: `${outDir}/01-roi.png` });
  note('roi-open');

  await page.getByRole('button', { name: '确认并保存基准' }).click();
  await page.getByText('基准图 (已建立)').waitFor({ timeout: 15_000 });
  await page.screenshot({ path: `${outDir}/02-baseline.png` });
  note('baseline-saved');

  const slider = page.getByTestId('ghost-opacity-slider');
  await slider.waitFor({ timeout: 10_000 });
  const track = page.getByTestId('ghost-opacity-track');
  const trackBox = await track.boundingBox();
  const before = await slider.getAttribute('aria-valuenow');
  note('ghost-before-drag', { trackBox, before });
  if (!trackBox || trackBox.width < 20) {
    throw new Error(`Ghost track too narrow: ${JSON.stringify(trackBox)}`);
  }

  const x = trackBox.x + trackBox.width / 2;
  await page.mouse.move(x, trackBox.y + trackBox.height - 4);
  await page.mouse.down();
  await page.mouse.move(x, trackBox.y + 4, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  let afterDrag = await slider.getAttribute('aria-valuenow');
  note('ghost-after-drag-down', { afterDrag });

  await page.getByRole('button', { name: 'Ghost +10' }).click();
  await page.getByRole('button', { name: 'Ghost +10' }).click();
  await page.waitForTimeout(150);
  const afterUp = await slider.getAttribute('aria-valuenow');
  const overlayOpacity = await page.getByTestId('ghost-overlay').evaluate((el) => el.style.opacity);
  note('ghost-after-up-buttons', { afterUp, overlayOpacity });
  if (Number(afterUp) < 15) {
    throw new Error(`Ghost stuck at ${afterUp}% after + taps from zero`);
  }
  await page.screenshot({ path: `${outDir}/03-ghost-after-drag.png` });

  await page.locator('#shutter-trigger').click({ force: true });
  const outcome = await Promise.race([
    page.getByText('分析失败，请重试拍摄').waitFor({ timeout: 90_000 }).then(() => 'analysis-error'),
    page.getByText('合规度').waitFor({ timeout: 90_000 }).then(() => 'result'),
  ]);
  await page.screenshot({ path: `${outDir}/04-after-second-shutter.png` });
  note('second-shutter', { outcome });
  report.ok = outcome === 'result';
} catch (err) {
  report.ok = false;
  report.error = err instanceof Error ? err.message : String(err);
  await page.screenshot({ path: `${outDir}/error.png` }).catch(() => {});
  note('exception', { message: report.error });
}

report.logs = logs.filter((l) => /error|Error|opencv|OpenCV|worker/i.test(l)).slice(0, 30);
console.log(JSON.stringify(report, null, 2));
await context.close();
await browser.close();
process.exit(report.ok ? 0 : 1);
