'use client';

import React from 'react';
import Badge from '@/shared/components/ui/Badge';
import { Check, Clock } from 'lucide-react';
import type { LoungeData } from './types';
import { isLoungeOpen } from './types';

interface LoungeCardProps {
  lounge: LoungeData;
  airportTimezone: string | null;
  onSelect: () => void;
  isSelected?: boolean;
}

/**
 * LoungeCard — Tappable card in the lounge list. Shows image, name, access info, hours.
 */
export default function LoungeCard({ lounge, airportTimezone, onSelect, isSelected }: LoungeCardProps) {
  const bestOption = lounge.access_options[0];
  const isFree = lounge.best_access_type === 'free';
  const hoursStatus = isLoungeOpen(lounge.operating_hours, airportTimezone);

  // Venue type label
  const venueLabel: Record<string, string> = {
    lounge: 'Lounge',
    spa: 'Spa',
    restaurant: 'Dining',
    gaming: 'Gaming',
    sleep_pod: 'Sleep',
    wellness: 'Wellness',
  };

  // Has conditions from any access option
  const hasConditions = lounge.access_options.some((o) => o.has_conditions);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] focus-visible:outline-offset-2"
      style={{
        backgroundColor: 'var(--color-bg)',
        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
      }}
      aria-label={`${lounge.lounge_name}, ${lounge.terminal}`}
    >
      {/* Image / placeholder */}
      <div className="relative h-[140px] overflow-hidden">
        {lounge.image_url ? (
          <img
            src={lounge.image_url}
            alt={lounge.lounge_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--color-primary-light), var(--color-bg-secondary))`,
            }}
          >
            <span
              className="text-3xl font-bold"
              style={{ color: 'var(--color-primary)', opacity: 0.6 }}
              aria-hidden="true"
            >
              {lounge.lounge_name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Name */}
        <h3
          className="text-sm font-semibold leading-snug line-clamp-1"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}
        >
          {lounge.lounge_name}
        </h3>

        {/* Terminal + Venue type */}
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {lounge.terminal} · {venueLabel[lounge.venue_type] ?? lounge.venue_type}
        </p>

        {/* Access badge */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge
            variant={isFree ? 'success' : 'neutral'}
            appearance="soft"
            size="sm"
            icon={isFree ? <Check size={12} /> : undefined}
          >
            {isFree ? 'Free' : `$${bestOption?.entry_cost ?? '—'}`}
          </Badge>
          {bestOption && (
            <span
              className="text-xs truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {bestOption.access_method.split(' → ').pop()}
            </span>
          )}
        </div>

        {/* Hours */}
        {hoursStatus.statusText !== 'Hours not available' && (
          <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
            <Clock size={12} aria-hidden="true" />
            {hoursStatus.statusText}
          </p>
        )}

        {/* Conditions warning */}
        {hasConditions && (
          <p
            className="text-xs mt-1"
            style={{ color: 'var(--color-warning)' }}
          >
            ⚠ Conditions apply
          </p>
        )}
      </div>
    </div>
  );
}
