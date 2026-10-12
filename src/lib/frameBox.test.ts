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
  it('covers the full viewport without max-height clipping', () => {
    const style = coverViewportStyle({ width: 1080, height: 1920 });
    expect(style.width).toContain('max(100vw');
    expect(style.height).toContain('max(100dvh');
    expect(style.maxHeight).toBe('none');
    expect(style.maxWidth).toBe('none');
  });
});
