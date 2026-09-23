import React from 'react';
import { Language } from '../types';
import { getShelfLabel } from '../lib/constants';

const SHELF_INDICES = [0, 1, 2, 3, 4] as const;

interface ShelfCarouselProps {
  activeShelfId: number;
  onShelfChange: (shelfId: number) => void;
  lang: Language;
  enabled?: boolean;
}

export const ShelfCarousel: React.FC<ShelfCarouselProps> = ({
  activeShelfId,
  onShelfChange,
  lang,
  enabled = true,
}) => {
  return (
    <div
      className="flex flex-col items-center gap-1.5"
      data-testid="shelf-carousel"
    >
      <div
        role="tablist"
        aria-label={lang === 'cn' ? '展架选择' : 'Shelf selection'}
        className="flex items-center justify-center gap-2"
      >
        {SHELF_INDICES.map((index) => {
          const isActive = activeShelfId === index;
          return (
            <button
              key={index}
              type="button"
              role="tab"
              aria-label={getShelfLabel(lang, index)}
              aria-current={isActive ? 'true' : undefined}
              data-shelf-index={index}
              disabled={!enabled}
              onClick={() => enabled && onShelfChange(index)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                isActive
                  ? 'bg-sg-success scale-110'
                  : 'bg-transparent border border-sg-border'
              } ${enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-medium text-white/80 tracking-wide">
        {getShelfLabel(lang, activeShelfId)}
      </span>
    </div>
  );
};
