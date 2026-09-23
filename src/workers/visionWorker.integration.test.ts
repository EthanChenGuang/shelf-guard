/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { decode } from 'jpeg-js';
import { ImageData } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SPLIT_Y } from '../lib/constants';
import { rasterFromRgba } from '../lib/vision/rasterFrame';
import { analyzeAllTiers, getCv } from './visionWorker';

globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;

const FIXTURE_DIR = path.join(process.cwd(), 'public/test-fixtures');
const IMAGE_DIMS = { width: 1080, height: 1920 };

function loadFixtureRaster(name: string) {
  const buffer = readFileSync(path.join(FIXTURE_DIR, name));
  const decoded = decode(buffer, { useTArray: true });
  const channels = decoded.data.length / (decoded.width * decoded.height);
  if (channels === 4) {
    return rasterFromRgba(decoded.width, decoded.height, decoded.data);
  }
  const rgba = new Uint8ClampedArray(decoded.width * decoded.height * 4);
  if (channels === 1) {
    for (let p = 0, j = 0; p < decoded.data.length; p += 1, j += 4) {
      const v = decoded.data[p]!;
      rgba[j] = v;
      rgba[j + 1] = v;
      rgba[j + 2] = v;
      rgba[j + 3] = 255;
    }
  } else {
    for (let i = 0, j = 0; i < decoded.data.length; i += 3, j += 4) {
      rgba[j] = decoded.data[i]!;
      rgba[j + 1] = decoded.data[i + 1]!;
      rgba[j + 2] = decoded.data[i + 2]!;
      rgba[j + 3] = 255;
    }
  }
  return rasterFromRgba(decoded.width, decoded.height, rgba);
}

async function analyzeFixtures(baselineName: string, captureName: string, toleranceValue = 50) {
  const cv = await getCv();
  const baselineFrame = loadFixtureRaster(baselineName);
  const captureFrame = loadFixtureRaster(captureName);
  return analyzeAllTiers(
    cv,
    captureFrame,
    baselineFrame,
    DEFAULT_SPLIT_Y,
    IMAGE_DIMS,
    toleranceValue,
  );
}

describe('visionWorker OpenCV pipeline', () => {
  it('detects at least one MISSING on capture-missing fixture', async () => {
    const result = await analyzeFixtures('baseline-aligned.jpg', 'capture-missing.jpg', 25);
    const missing = result.anomalies.filter((a) => a.type === 'MISSING' && !a.dismissed);
    expect(missing.length).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it('detects at least one MOVED on capture-displaced fixture', async () => {
    const result = await analyzeFixtures('baseline-aligned.jpg', 'capture-displaced.jpg', 25);
    const moved = result.anomalies.filter((a) => a.type === 'MOVED' && !a.dismissed);
    expect(moved.length).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it('returns zero anomalies when baseline compared to itself', async () => {
    const result = await analyzeFixtures('baseline-aligned.jpg', 'baseline-aligned.jpg');
    const active = result.anomalies.filter((a) => !a.dismissed);
    expect(active.length).toBe(0);
  }, 120_000);
});

describe('vision.ts production path', () => {
  it('does not reference INITIAL_MOCK_ANOMALIES', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/lib/vision.ts'), 'utf8');
    const withoutComments = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
    expect(withoutComments.includes('INITIAL_MOCK_ANOMALIES')).toBe(false);
    expect(source.includes('visionWorker')).toBe(true);
  });
});
