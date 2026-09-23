import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InitialGuideOverlay } from './InitialGuideOverlay';
import { ShelfCarousel } from './ShelfCarousel';
import { I18N } from '../lib/constants';

describe('Phase 5 I18N coverage (D-29, D-31, I18N-01, I18N-02)', () => {
  it('InitialGuideOverlay renders skipGuide per lang without reload', () => {
    const { rerender } = render(
      <InitialGuideOverlay
        lang="cn"
        shelfIndex={0}
        onComplete={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText(I18N.cn.skipGuide)).toBeInTheDocument();

    rerender(
      <InitialGuideOverlay
        lang="en"
        shelfIndex={0}
        onComplete={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText(I18N.en.skipGuide)).toBeInTheDocument();
    expect(screen.queryByText(I18N.cn.skipGuide)).not.toBeInTheDocument();
  });

  it('InitialGuideOverlay captureBaseline copy differs between cn and en', () => {
    const { rerender } = render(
      <InitialGuideOverlay
        lang="cn"
        shelfIndex={0}
        onComplete={vi.fn()}
        onSkip={vi.fn()}
        initialStep={2}
      />,
    );
    expect(screen.getByRole('heading', { name: I18N.cn.captureBaseline })).toBeInTheDocument();
    expect(screen.getByTestId('capture-baseline-cta')).toHaveTextContent(
      I18N.cn.captureBaseline,
    );

    rerender(
      <InitialGuideOverlay
        lang="en"
        shelfIndex={0}
        onComplete={vi.fn()}
        onSkip={vi.fn()}
        initialStep={2}
      />,
    );
    expect(screen.getByRole('heading', { name: I18N.en.captureBaseline })).toBeInTheDocument();
    expect(screen.getByTestId('capture-baseline-cta')).toHaveTextContent(
      I18N.en.captureBaseline,
    );
    expect(I18N.cn.captureBaseline).not.toBe(I18N.en.captureBaseline);
  });

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
