import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShelfCarousel } from './ShelfCarousel';
import { I18N } from '../lib/constants';

describe('Phase 5 I18N coverage (D-29, D-31, I18N-01, I18N-02)', () => {
  it('ShelfCarousel tablist aria-label uses shelfCarouselLabel in both langs', () => {
    const { rerender } = render(
      <ShelfCarousel activeShelfId={0} onShelfChange={vi.fn()} lang="cn" />,
    );
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-label',
      I18N.cn.shelfCarouselLabel,
    );

    rerender(
      <ShelfCarousel activeShelfId={0} onShelfChange={vi.fn()} lang="en" />,
    );
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-label',
      I18N.en.shelfCarouselLabel,
    );
    expect(I18N.cn.shelfCarouselLabel).not.toBe(I18N.en.shelfCarouselLabel);
  });

  it('baselineNotSet cn/en pairs differ for language toggle contract', () => {
    expect(I18N.cn.baselineNotSet).not.toBe(I18N.en.baselineNotSet);
    expect(I18N.cn.baselineNotSet).toMatch(/未建立|未设置/);
    expect(I18N.en.baselineNotSet).toMatch(/Empty|Not set/i);
  });
});
