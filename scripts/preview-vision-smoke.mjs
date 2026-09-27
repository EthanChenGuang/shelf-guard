import { chromium } from 'playwright';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
const errors = [];
page.on('console', (msg) => {
  const text = msg.text();
  logs.push(`[${msg.type()}] ${text}`);
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 120_000 });

const result = await page.evaluate(async () => {
  const fixtures = {
    baseline: '/test-fixtures/baseline-aligned.jpg',
    capture: '/test-fixtures/capture-missing.jpg',
  };

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
    blobToDataUrl(fixtures.baseline),
    blobToDataUrl(fixtures.capture),
  ]);

  const baseline = {
    id: 'test',
    createdAt: Date.now(),
    imageDataUrl: baselineUrl,
    imageDimensions: { width: 1080, height: 1920 },
    splitYPercentages: [0.295, 0.455, 0.618, 0.782],
    tierLabels: ['T1', 'T2', 'T3', 'T4'],
  };

  // Dynamic import the app chunk's vision helper via window hook if absent — use worker directly
  const workerScript = [...document.querySelectorAll('script[type="module"]')]
    .map((s) => s.src)
    .find((src) => src.includes('/assets/index-'));

  if (!workerScript) {
    return { ok: false, step: 'no-index-script' };
  }

  // Load vision worker URL from index module graph — find visionWorker chunk
  const indexText = await (await fetch(workerScript)).text();
  const workerMatch = indexText.match(/"(\/assets\/visionWorker-[^"]+\.js)"/);
  if (!workerMatch) {
    return { ok: false, step: 'no-worker-chunk-in-index', indexSnippet: indexText.slice(0, 500) };
  }

  const workerUrl = new URL(workerMatch[1], location.origin).href;
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
      (async () => {
        const blob = await (await fetch(captureUrl)).blob();
        return createImageBitmap(blob);
      })(),
      (async () => {
        const blob = await (await fetch(baselineUrl)).blob();
        return createImageBitmap(blob);
      })(),
    ]);

    const analyze = await post(
      {
        type: 'analyze',
        captureBitmap,
        baselineBitmap,
        splitYPercentages: baseline.splitYPercentages,
        toleranceValue: 50,
      },
      [captureBitmap, baselineBitmap],
    );

    worker.terminate();
    return {
      ok: true,
      step: 'analyze-complete',
      missing: analyze.payload?.missingCount,
      anomalies: analyze.payload?.anomalies?.length,
    };
  } catch (e) {
    worker.terminate();
    return { ok: false, step: 'worker-failed', message: e instanceof Error ? e.message : String(e) };
  }
});

console.log(JSON.stringify({ baseUrl, result, errors, logs: logs.filter((l) => l.includes('error') || l.includes('Error')).slice(0, 20) }, null, 2));
await browser.close();
process.exit(result.ok ? 0 : 1);
