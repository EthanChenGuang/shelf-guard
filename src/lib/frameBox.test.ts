import { describe, expect, it } from 'vitest';
import { coverViewportStyle, frameBoxStyle } from './frameBox';

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
});
