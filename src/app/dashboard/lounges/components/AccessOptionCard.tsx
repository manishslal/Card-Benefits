'use client';

import React from 'react';
import { CreditCard, Check, ExternalLink } from 'lucide-react';
import Badge from '@/shared/components/ui/Badge';
import type { AccessOption } from './types';

interface AccessOptionCardProps {
  option: AccessOption;
  /** Lounge-level source URL for linking guest policy details */
  sourceUrl?: string | null;
}

/**
 * AccessOptionCard — Displays a single access method in the lounge detail view.
 */
export default function AccessOptionCard({ option, sourceUrl }: AccessOptionCardProps) {
  const isFree = option.access_type === 'free';

  // Parse display: "Card Name → Network Name" or plain name
  const parts = option.access_method.split(' → ');
  const cardName = parts[0];
  const networkName = parts.length > 1 ? parts[1] : null;

  return (
    <div
      className="flex items-start gap-3 py-3"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      {/* Icon */}
      <div
        className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isFree ? 'var(--color-success-light)' : 'var(--color-bg-secondary)',
        }}
      >
        {isFree ? (
          <Check size={16} style={{ color: 'var(--color-success)' }} aria-hidden="true" />
        ) : (
          <CreditCard size={16} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--color-text)' }}
          >
            {cardName}
          </span>
          <Badge
            variant={isFree ? 'success' : 'neutral'}
            appearance="soft"
            size="sm"
          >
            {isFree ? 'FREE' : `$${option.entry_cost}/person`}
          </Badge>
        </div>

        {networkName && (
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Via {networkName}
          </p>
        )}

        {/* Guest policy disclaimer (no specific dollar amounts) */}
        {(option.guest_limit !== null || option.guest_fee !== null) && (
          <div className="text-xs mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
            <p>Guest access may be available.</p>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-0.5 underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Check lounge website for guest policies
                <ExternalLink size={10} aria-hidden="true" />
              </a>
            ) : (
              <p className="mt-0.5">Policies and fees vary by lounge.</p>
            )}
          </div>
        )}

        {/* Time limit */}
        {option.time_limit_hours != null && (
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Time limit: {option.time_limit_hours}h
          </p>
        )}

        {/* Notes */}
        {option.notes && (
          <p
            className="text-xs mt-0.5 italic"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {option.notes}
          </p>
        )}
      </div>
    </div>
  );
}
