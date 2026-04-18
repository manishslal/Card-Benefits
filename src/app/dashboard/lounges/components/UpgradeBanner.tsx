'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';

interface CardUpgrade {
  card_id: string;
  card_name: string;
  issuer: string;
  additional_lounges: number;
}

interface UpgradeBannerProps {
  airportCode: string;
}

export default function UpgradeBanner({ airportCode }: UpgradeBannerProps) {
  const [upgrades, setUpgrades] = useState<CardUpgrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setDismissed(false);

    fetch(`/api/lounges/what-if?airport=${airportCode}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.success && data.upgrades?.length > 0) {
          setUpgrades(data.upgrades);
        }
      })
      .catch(() => {/* silent — this is a nice-to-have */})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [airportCode]);

  if (isLoading || upgrades.length === 0 || dismissed) return null;

  return (
    <div
      className="mx-4 mb-4 rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-3 text-xs opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: 'var(--color-text-tertiary)' }}
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-accent)' }}
        >
          Upgrade Your Access
        </span>
      </div>

      {/* Cards list */}
      <div className="space-y-2">
        {upgrades.map((upgrade) => (
          <div
            key={upgrade.card_id}
            className="flex items-center justify-between py-1.5"
          >
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {upgrade.card_name}
              </p>
              <p
                className="text-xs"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {upgrade.issuer}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-3 shrink-0">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--color-accent)',
                  color: 'var(--color-accent-foreground, #fff)',
                }}
              >
                +{upgrade.additional_lounges}
              </span>
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                lounge{upgrade.additional_lounges !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => window.location.href = '/dashboard'}
        className="mt-3 flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-accent)' }}
      >
        Compare Cards
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
