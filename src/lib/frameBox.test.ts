import { describe, expect, it } from 'vitest';
import { frameBoxStyle } from './frameBox';

describe('frameBoxStyle', () => {
  it('constrains width with mx-auto-friendly min() including max height', () => {
    const style = frameBoxStyle({ width: 1080, height: 1920 }, '72vh');
    expect(style.width).toBe('min(calc(100% - 0px), calc(72vh * 0.5625))');
    expect(style.aspectRatio).toBe(String(1080 / 1920));
  });

  it('subtracts the side gutter from the available width and has no fixed rem cap', () => {
    const style = frameBoxStyle({ width: 1920, height: 1080 }, 'var(--max)', 'var(--gutter)');
    expect(style.width).toBe('min(calc(100% - var(--gutter)), calc(var(--max) * 1.7778))');
    expect(style.width).not.toContain('rem');
  });
});
