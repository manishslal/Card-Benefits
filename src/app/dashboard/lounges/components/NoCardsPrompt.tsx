'use client';

import React from 'react';
import { CreditCard, ArrowRight, Search } from 'lucide-react';

interface NoCardsPromptProps {
  airportCode: string;
  airportName: string | null;
  onAddCards: () => void;
  onBrowseAll: () => void;
}

export default function NoCardsPrompt({
  airportCode,
  airportName,
  onAddCards,
  onBrowseAll,
}: NoCardsPromptProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {/* Icon */}
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
        }}
      >
        <CreditCard
          size={28}
          style={{ color: 'var(--color-text-tertiary)' }}
        />
      </div>

      {/* Title */}
      <h3
        className="mb-2 text-lg font-semibold"
        style={{ color: 'var(--color-text-primary)' }}
      >
        No cards added yet
      </h3>

      {/* Description */}
      <p
        className="mb-8 max-w-sm text-sm leading-relaxed"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Add your credit cards to see which lounges you can access for free
        {airportName ? ` at ${airportName} (${airportCode})` : ` at ${airportCode}`}.
      </p>

      {/* Primary CTA */}
      <button
        onClick={onAddCards}
        className="mb-3 flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all hover:brightness-110 active:scale-[0.98]"
        style={{
          background: 'var(--color-accent)',
          color: 'var(--color-accent-foreground, #fff)',
        }}
      >
        <CreditCard size={16} />
        Add Your Cards
        <ArrowRight size={14} />
      </button>

      {/* Secondary CTA */}
      <button
        onClick={onBrowseAll}
        className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all hover:brightness-110 active:scale-[0.98]"
        style={{
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Search size={16} />
        Browse All Lounges
      </button>
    </div>
  );
}
