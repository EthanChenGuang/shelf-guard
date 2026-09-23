import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShelfCarousel } from './ShelfCarousel';

describe('ShelfCarousel (D-03, D-32)', () => {
  it('renders 5 shelf dots with shelf-carousel test id', () => {
    render(
      <ShelfCarousel
        activeShelfId={0}
        onShelfChange={vi.fn()}
        lang="en"
      />,
    );

    const carousel = screen.getByTestId('shelf-carousel');
    expect(carousel).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('sets aria-current on active dot at index 2 only', () => {
    render(
      <ShelfCarousel
        activeShelfId={2}
        onShelfChange={vi.fn()}
        lang="en"
      />,
    );

    for (let index = 0; index < 5; index += 1) {
      const dot = screen.getByRole('tab', { name: `Shelf ${index + 1}` });
      if (index === 2) {
        expect(dot).toHaveAttribute('aria-current', 'true');
      } else {
        expect(dot).not.toHaveAttribute('aria-current');
      }
    }
  });

  it('calls onShelfChange with correct index when enabled dot clicked', async () => {
    const onShelfChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ShelfCarousel
        activeShelfId={0}
        onShelfChange={onShelfChange}
        lang="en"
        enabled
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Shelf 3' }));
    expect(onShelfChange).toHaveBeenCalledWith(2);
  });

  it('does not call onShelfChange when disabled', async () => {
    const onShelfChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ShelfCarousel
        activeShelfId={0}
        onShelfChange={onShelfChange}
        lang="en"
        enabled={false}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Shelf 3' }));
    expect(onShelfChange).not.toHaveBeenCalled();
  });
});
