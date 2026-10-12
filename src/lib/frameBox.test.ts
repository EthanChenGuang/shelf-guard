import { describe, expect, it } from 'vitest';
import { containViewportStyle, coverViewportStyle, frameBoxStyle } from './frameBox';

describe('frameBoxStyle', () => {
  it('constrains width with mx-auto-friendly min() including max height', () => {
    const style = frameBoxStyle({ width: 1080, height: 1920 }, '72vh');
    expect(style.width).toContain('min(');
    expect(style.width).toContain('28rem');
    expect(style.width).toContain('72vh');
    expect(style.aspectRatio).toBe(String(1080 / 1920));
  });
});

describe('coverViewportStyle', () => {
  it('covers a landscape visual viewport using pixel sizes, not 100dvh', () => {
    const style = coverViewportStyle({ width: 1920, height: 1080 }, { width: 844, height: 390 });
    expect(style.width).toBe('844px');
    expect(style.height).toBe(`${844 / (1920 / 1080)}px`);
    expect(style.maxHeight).toBe('none');
    expect(String(style.width)).not.toContain('vw');
    expect(String(style.height)).not.toContain('dvh');
  });

  it('covers a portrait visual viewport by filling height when the photo is taller', () => {
    const style = coverViewportStyle({ width: 1080, height: 1920 }, { width: 390, height: 844 });
    expect(style.height).toBe('844px');
    expect(style.width).toBe(`${844 * (1080 / 1920)}px`);
  });

  it('still covers a portrait photo in a landscape box taller than the box', () => {
    const style = coverViewportStyle({ width: 1080, height: 1920 }, { width: 844, height: 390 });
    expect(parseFloat(String(style.height))).toBeGreaterThan(390);
  });
});

describe('containViewportStyle', () => {
  it('letterboxes a landscape photo into numeric px inside the box', () => {
    const style = containViewportStyle({ width: 1920, height: 1080 }, { width: 844, height: 334 });
    const width = parseFloat(String(style.width));
    const height = parseFloat(String(style.height));
    expect(String(style.width)).toMatch(/px$/);
    expect(String(style.height)).toMatch(/px$/);
    expect(width).toBeLessThanOrEqual(844);
    expect(height).toBeLessThanOrEqual(334);
    expect(width / height).toBeCloseTo(1920 / 1080, 5);
    expect(String(style.width)).not.toContain('vw');
    expect(String(style.height)).not.toContain('dvh');
  });

  it('letterboxes a portrait photo into a landscape padded stage', () => {
    const style = containViewportStyle({ width: 1080, height: 1920 }, { width: 844, height: 294 });
    expect(parseFloat(String(style.width))).toBeLessThanOrEqual(844);
    expect(parseFloat(String(style.height))).toBeLessThanOrEqual(294);
  });
});
