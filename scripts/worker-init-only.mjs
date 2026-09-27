import { chromium } from 'playwright';

const workerPath = process.argv[2] || '/assets/visionWorker-kEik9zs6.js';
const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => console.log('console:', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('pageerror:', err.message));

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

const result = await page.evaluate(async (wp) => {
  const workerUrl = new URL(wp, location.origin).href;
  const worker = new Worker(workerUrl, { type: 'module' });
  return new Promise((resolve) => {
    const requestId = 1;
    const timer = setTimeout(() => resolve({ ok: false, message: 'timeout' }), 120_000);
    worker.onmessage = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: true, data: event.data });
    };
    worker.onerror = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: false, message: event.message || 'worker onerror' });
    };
    worker.postMessage({ type: 'init', requestId });
  });
}, workerPath);

console.log(JSON.stringify(result, null, 2));
await browser.close();
