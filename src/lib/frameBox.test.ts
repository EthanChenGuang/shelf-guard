import { describe, expect, it } from 'vitest';
import { frameBoxStyle } from './frameBox';

describe('frameBoxStyle', () => {
  it('constrains width with mx-auto-friendly min() including max height', () => {
    const style = frameBoxStyle({ width: 1080, height: 1920 }, '72vh');
    expect(style.width).toContain('min(');
    expect(style.width).toContain('28rem');
    expect(style.width).toContain('72vh');
    expect(style.aspectRatio).toBe(String(1080 / 1920));
  });
});
