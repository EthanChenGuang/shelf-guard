import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const assetsDir = process.env.DIST_ASSETS || path.join(process.cwd(), 'dist/assets');
const workerFile = readdirSync(assetsDir).find((f) => f.startsWith('visionWorker-') && f.endsWith('.js'));
if (!workerFile) {
  console.error('No visionWorker chunk in', assetsDir);
  process.exit(1);
}
const workerPath = `/assets/${workerFile}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

const result = await page.evaluate(async (wp) => {
  async function blobToDataUrl(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  const [baselineUrl, captureUrl] = await Promise.all([
    blobToDataUrl('/test-fixtures/baseline-aligned.jpg'),
    blobToDataUrl('/test-fixtures/capture-missing.jpg'),
  ]);

  const workerUrl = new URL(wp, location.origin).href;
  const worker = new Worker(workerUrl, { type: 'module' });

  function post(body, transfer) {
    return new Promise((resolve, reject) => {
      const requestId = Math.floor(Math.random() * 1e9);
      const onMessage = (event) => {
        const data = event.data;
        if (data?.requestId !== requestId) return;
        worker.removeEventListener('message', onMessage);
        if (data.type === 'error') reject(new Error(data.message || 'worker error'));
        else resolve(data);
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ ...body, requestId }, transfer || []);
    });
  }

  try {
    await post({ type: 'init' });
    const [captureBitmap, baselineBitmap] = await Promise.all([
      createImageBitmap(await (await fetch(captureUrl)).blob()),
      createImageBitmap(await (await fetch(baselineUrl)).blob()),
    ]);
    const analyze = await post(
      {
        type: 'analyze',
        captureBitmap,
        baselineBitmap,
        toleranceValue: 50,
      },
      [captureBitmap, baselineBitmap],
    );
    worker.terminate();
    return {
      ok: true,
      missing: analyze.payload?.missingCount,
      anomalies: analyze.payload?.anomalies?.length,
    };
  } catch (e) {
    worker.terminate();
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}, workerPath);

console.log(JSON.stringify({ workerPath, result }, null, 2));
await browser.close();
process.exit(result.ok ? 0 : 1);
