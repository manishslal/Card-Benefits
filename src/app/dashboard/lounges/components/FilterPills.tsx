'use client';

import React from 'react';

interface FilterPillsProps {
  items: readonly { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}

/**
 * FilterPills — Horizontal scrollable pill bar for filtering venue types.
 */
export default function FilterPills({ items, selected, onSelect }: FilterPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist">
      {items.map((item) => {
        const isActive = item.key === selected;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(item.key)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
              color: isActive ? '#fff' : 'var(--color-text-secondary)',
              border: isActive ? 'none' : '1px solid var(--color-border)',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
