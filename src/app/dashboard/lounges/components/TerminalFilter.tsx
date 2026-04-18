'use client';

import React from 'react';

interface TerminalFilterProps {
  terminals: string[];
  selected: string;
  onSelect: (terminal: string) => void;
}

/**
 * TerminalFilter — Pill bar for selecting terminal, shown when >1 terminal exists.
 */
export default function TerminalFilter({ terminals, selected, onSelect }: TerminalFilterProps) {
  if (terminals.length <= 1) return null;

  const options = ['All Terminals', ...terminals];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Terminal filter">
      {options.map((terminal) => {
        const isActive = terminal === selected;
        return (
          <button
            key={terminal}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(terminal)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
            style={{
              backgroundColor: isActive ? 'var(--color-text)' : 'transparent',
              color: isActive ? 'var(--color-bg)' : 'var(--color-text-secondary)',
              border: isActive ? 'none' : '1px solid var(--color-border)',
            }}
          >
            {terminal}
          </button>
        );
      })}
    </div>
  );
}
