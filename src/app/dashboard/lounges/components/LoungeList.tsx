'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import Badge from '@/shared/components/ui/Badge';
import { SkeletonCard } from '@/shared/components/loaders';
import EmptyState from '@/shared/components/ui/EmptyState';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import FilterPills from './FilterPills';
import TerminalFilter from './TerminalFilter';
import LoungeCard from './LoungeCard';
import NoCardsPrompt from './NoCardsPrompt';
import UpgradeBanner from './UpgradeBanner';
import { VENUE_TYPES } from './types';
import type { LoungeData, EligibleResponse } from './types';

interface LoungeListProps {
  data: EligibleResponse | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onSelectLounge: (lounge: LoungeData) => void;
  onRetry: () => void;
  selectedLoungeId?: string | null;
  onAddCards?: () => void;
}

/**
 * LoungeList — View 2: Lounge results for a selected airport with filters.
 */
export default function LoungeList({
  data,
  isLoading,
  error,
  onBack,
  onSelectLounge,
  onRetry,
  selectedLoungeId,
  onAddCards,
}: LoungeListProps) {
  const [venueFilter, setVenueFilter] = useState('all');
  const [terminalFilter, setTerminalFilter] = useState('All Terminals');

  // Pull-to-refresh (mobile)
  const { isRefreshing, pullOffset, pullProgress, indicatorRef } = usePullToRefresh({
    onRefresh: async () => {
      onRetry();
      // Wait a tick for the fetch to start
      await new Promise((r) => setTimeout(r, 800));
    },
    isEnabled: !isLoading,
  });

  // Unique terminals
  const terminals = useMemo(() => {
    if (!data?.lounges) return [];
    const set = new Set(data.lounges.map((l) => l.terminal));
    return Array.from(set).sort();
  }, [data]);

  // Filtered lounges
  const filteredLounges = useMemo(() => {
    if (!data?.lounges) return [];
    return data.lounges.filter((l) => {
      if (venueFilter !== 'all' && l.venue_type !== venueFilter) return false;
      if (terminalFilter !== 'All Terminals' && l.terminal !== terminalFilter) return false;
      return true;
    });
  }, [data, venueFilter, terminalFilter]);

  const handleVenueFilter = useCallback((key: string) => setVenueFilter(key), []);
  const handleTerminalFilter = useCallback((t: string) => setTerminalFilter(t), []);

  // Determine active venue type label for empty-state message
  const activeVenueLabel =
    VENUE_TYPES.find((v) => v.key === venueFilter)?.label?.toLowerCase() ?? venueFilter;

  return (
    <div className="flex flex-col h-full">
      {/* Pull-to-refresh indicator */}
      <div
        ref={indicatorRef}
        className="flex justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullOffset > 0 ? `${pullOffset}px` : 0 }}
      >
        <div
          className="flex items-center justify-center"
          style={{ opacity: pullProgress, transform: `rotate(${pullProgress * 360}deg)` }}
        >
          <RefreshCw size={20} style={{ color: 'var(--color-primary)' }} />
        </div>
      </div>

      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 pt-3 pb-2"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-bg) 92%, transparent)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {/* Back + title */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-bg-secondary)]"
            aria-label="Back to airport search"
          >
            <ArrowLeft size={20} style={{ color: 'var(--color-text)' }} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2
                className="text-base font-bold truncate"
                style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}
              >
                {data?.airport_name ?? data?.airport ?? 'Airport'}
              </h2>
              {data?.airport && (
                <Badge variant="primary" appearance="soft" size="sm">
                  {data.airport}
                </Badge>
              )}
            </div>
            {data && !isLoading && (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {data.total_lounges} venue{data.total_lounges !== 1 ? 's' : ''} ·{' '}
                {data.free_access} free with your cards
              </p>
            )}
          </div>
          {(isLoading || isRefreshing) && (
            <Loader2
              size={18}
              className="animate-spin flex-shrink-0"
              style={{ color: 'var(--color-primary)' }}
              aria-label="Loading"
            />
          )}
        </div>

        {/* Filters */}
        {!isLoading && !error && data && (
          <div className="space-y-2">
            <FilterPills items={VENUE_TYPES} selected={venueFilter} onSelect={handleVenueFilter} />
            <TerminalFilter terminals={terminals} selected={terminalFilter} onSelect={handleTerminalFilter} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3 mt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} showImage rows={2} />
            ))}
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <EmptyState
            icon={<span className="text-2xl">⚠️</span>}
            title="Something went wrong"
            description={error}
            actionLabel="Try again"
            onAction={onRetry}
          />
        )}

        {/* No cards state */}
        {!isLoading && !error && data && data.has_cards === false && data.lounges.length === 0 && (
          <NoCardsPrompt
            airportCode={data.airport}
            airportName={data.airport_name ?? null}
            onAddCards={onAddCards || (() => { window.location.href = '/dashboard'; })}
            onBrowseAll={onRetry}
          />
        )}

        {/* Empty after filter */}
        {!isLoading && !error && data && (data.has_cards !== false || data.lounges.length > 0) && filteredLounges.length === 0 && (
          <EmptyState
            title={`No ${activeVenueLabel} venues${terminalFilter !== 'All Terminals' ? ` at ${terminalFilter}` : ''}`}
            description="Try changing your filters to see more results."
          />
        )}

        {/* Lounge cards */}
        {!isLoading && !error && filteredLounges.length > 0 && (
          <div className="space-y-3 mt-2">
            {filteredLounges.map((lounge) => (
              <LoungeCard
                key={lounge.lounge_id}
                lounge={lounge}
                airportTimezone={data?.airport_timezone ?? null}
                onSelect={() => onSelectLounge(lounge)}
                isSelected={lounge.lounge_id === selectedLoungeId}
              />
            ))}
          </div>
        )}

        {/* What-if upgrade banner — after all lounge cards */}
        {data && !isLoading && filteredLounges.length > 0 && (
          <UpgradeBanner airportCode={data.airport} />
        )}
      </div>
    </div>
  );
}
