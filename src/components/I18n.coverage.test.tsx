import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShelfCarousel } from './ShelfCarousel';
import { I18N } from '../lib/constants';

describe('Phase 5 I18N coverage (D-29, D-31, I18N-01, I18N-02)', () => {
  it('ShelfCarousel tablist aria-label uses shelfCarouselLabel in both langs', () => {
    const { rerender } = render(
      <ShelfCarousel activeShelfId={0} onShelfChange={vi.fn()} lang="it" />,
    );
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-label',
      I18N.it.shelfCarouselLabel,
    );

    rerender(
      <ShelfCarousel activeShelfId={0} onShelfChange={vi.fn()} lang="en" />,
    );
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-label',
      I18N.en.shelfCarouselLabel,
    );
    expect(I18N.it.shelfCarouselLabel).not.toBe(I18N.en.shelfCarouselLabel);
  });

  it('baselineNotSet it/en pairs differ for language toggle contract', () => {
    expect(I18N.it.baselineNotSet).not.toBe(I18N.en.baselineNotSet);
    expect(I18N.it.baselineNotSet).toMatch(/riferimento/i);
    expect(I18N.en.baselineNotSet).toMatch(/Empty|Not set/i);
  });

  it('Italian, English and Chinese dictionaries have the same entries', () => {
    const keys = (lang: keyof typeof I18N) => Object.keys(I18N[lang]).sort();
    expect(keys('it')).toEqual(keys('en'));
    expect(keys('cn')).toEqual(keys('en'));
  });
});
