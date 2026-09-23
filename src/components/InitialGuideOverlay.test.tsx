import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {InitialGuideOverlay} from './InitialGuideOverlay';
import {I18N} from '../lib/constants';

describe('InitialGuideOverlay (SHLF-05, D-32)', () => {
  it('renders data-testid initial-guide with step 0 welcome copy', () => {
    render(
      <InitialGuideOverlay
        lang="cn"
        shelfIndex={1}
        onComplete={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByTestId('initial-guide')).toBeInTheDocument();
    expect(screen.getByText(I18N.cn.welcomeStep)).toBeInTheDocument();
    expect(screen.getByText(I18N.cn.guideWelcome('柜架 2'))).toBeInTheDocument();
  });

  it('skip button calls onSkip once', () => {
    const onSkip = vi.fn();
    render(
      <InitialGuideOverlay
        lang="cn"
        shelfIndex={0}
        onComplete={vi.fn()}
        onSkip={onSkip}
      />,
    );

    fireEvent.click(screen.getByTestId('skip-guide'));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('final step capture baseline button calls onComplete', () => {
    const onComplete = vi.fn();
    render(
      <InitialGuideOverlay
        lang="en"
        shelfIndex={2}
        onComplete={onComplete}
        onSkip={vi.fn()}
        initialStep={2}
      />,
    );

    fireEvent.click(screen.getByTestId('capture-baseline-cta'));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('renders translated skipGuide for cn and en lang props', () => {
    const {rerender} = render(
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
  });
});
