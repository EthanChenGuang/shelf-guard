import React from 'react';
import {Language} from '../types';

interface ShelfSelectorProps {
  activeShelfId: number;
  onShelfChange: (shelfId: number) => void;
  lang: Language;
}

const SHELF_LABELS = ['1', '2', '3', '4', '5'] as const;

export const ShelfSelector: React.FC<ShelfSelectorProps> = ({
  activeShelfId,
  onShelfChange,
}) => {
  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label="Shelf selector"
      data-testid="shelf-selector"
    >
      {SHELF_LABELS.map((label, index) => (
        <button
          key={label}
          type="button"
          aria-label={`Shelf ${label}`}
          aria-pressed={activeShelfId === index}
          data-shelf-index={index}
          onClick={() => onShelfChange(index)}
          className={`w-7 h-7 rounded-full flex items-center justify-center font-mono-numbers text-[11px] font-bold transition-colors ${
            activeShelfId === index
              ? 'bg-[#006C49] text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
