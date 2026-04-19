'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  ExternalLink,
  Wifi,
  Coffee,
  Wine,
  Sparkles,
  AlertTriangle,
  Clock,
  Moon,
  Monitor,
  ChevronDown,
} from 'lucide-react';
import { ShowerHead } from 'lucide-react';
import Badge from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/button';
import Skeleton from '@/shared/components/ui/Skeleton';
import AccessOptionCard from './AccessOptionCard';
import { LoungePlaceholderImage, useLoungeImage } from './loungePlaceholders';
import { isLoungeOpen, AMENITY_DEFS } from './types';
import type { LoungeData, AccessOption } from './types';
import { generateAccessSteps } from './accessSteps';

interface LoungeDetailProps {
  lounge: LoungeData;
  airportTimezone: string | null;
  onBack: () => void;
  /** On desktop the back button is hidden; set isMobile=false to control header */
  showBackButton?: boolean;
  selectedTerminal?: string;
}

// Map amenity icon names to actual components
const iconMap: Record<string, React.ReactNode> = {
  Wifi: <Wifi size={14} aria-hidden="true" />,
  ShowerHead: <ShowerHead size={14} aria-hidden="true" />,
  Coffee: <Coffee size={14} aria-hidden="true" />,
  Wine: <Wine size={14} aria-hidden="true" />,
  Sparkles: <Sparkles size={14} aria-hidden="true" />,
  Moon: <Moon size={14} aria-hidden="true" />,
  Monitor: <Monitor size={14} aria-hidden="true" />,
};

// ── Day-key display order + labels ───────────────────────────
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Normalize an operating-hours value (may be string or string[]) to a display string. */
function normalizeHoursValue(val: unknown): string | null {
  if (Array.isArray(val)) return (val[0] as string) ?? null;
  if (typeof val === 'string') return val;
  return null;
}

/**
 * HoursSection — renders the open/closed badge and an expandable "See all hours" list.
 */
function HoursSection({
  hoursStatus,
  operatingHours,
  sourceUrl,
}: {
  hoursStatus: { isOpen: boolean; statusText: string; status: import('./types').LoungeStatus };
  operatingHours: Record<string, unknown> | null;
  sourceUrl: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  // Build per-day entries from operating_hours (only if real day keys exist)
  const dayEntries: { label: string; hours: string }[] = [];
  if (operatingHours && typeof operatingHours === 'object') {
    for (const key of DAY_ORDER) {
      const raw = (operatingHours as Record<string, unknown>)[key];
      if (raw !== undefined) {
        const display = normalizeHoursValue(raw);
        if (display) dayEntries.push({ label: DAY_LABELS[key], hours: display });
      }
    }
  }

  // Determine today's key so we can highlight it
  let todayLabel = '';
  try {
    todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  } catch {
    // noop
  }

  const hasPerDayData = dayEntries.length > 0;

  return (
    <section>
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        Hours
      </h3>

      {/* Current status line */}
      <div className="flex items-center gap-2">
        <Clock size={16} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
        <span className="text-sm" style={{ color: 'var(--color-text)' }}>
          {hoursStatus.statusText}
        </span>
        {hoursStatus.status === 'open' || hoursStatus.status === 'always_open' ? (
          <Badge variant="success" appearance="soft" size="sm">Open</Badge>
        ) : hoursStatus.status === 'closed' ? (
          <Badge variant="error" appearance="soft" size="sm">Closed</Badge>
        ) : null}
      </div>

      {/* "Hours not available" fallback */}
      {hoursStatus.status === 'unknown' && sourceUrl && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Hours not available for this lounge.{' '}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline"
            style={{ color: 'var(--color-primary)' }}
          >
            View on website →
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </p>
      )}
      {hoursStatus.status === 'unknown' && !sourceUrl && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Hours not available. Contact the lounge directly for current operating hours.
        </p>
      )}

      {/* Expandable per-day hours */}
      {hasPerDayData && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-medium inline-flex items-center gap-1 transition-colors"
            style={{ color: 'var(--color-primary)' }}
            aria-expanded={expanded}
          >
            See all hours
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1 text-sm" style={{ color: 'var(--color-text)' }}>
              {dayEntries.map(({ label, hours }) => (
                <li
                  key={label}
                  className="flex justify-between pl-6"
                  style={{
                    fontWeight: label === todayLabel ? 600 : 400,
                    color: label === todayLabel ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  }}
                >
                  <span>{label}</span>
                  <span>{hours}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * HowToAccessSection — Step-by-step instructions for accessing a lounge.
 */
function HowToAccessSection({ accessOptions, loungeName }: { accessOptions: AccessOption[]; loungeName: string }) {
  // Only show free access options
  const freeOptions = accessOptions.filter((o) => o.access_type === 'free');
  const options = freeOptions.length > 0 ? freeOptions : accessOptions.slice(0, 1);
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (options.length === 0) return null;

  const selectedOption = options[selectedIdx];
  const steps = generateAccessSteps(selectedOption, loungeName);
  const displayName = selectedOption.access_method.split(' → ')[0];

  return (
    <section>
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        How to Access
      </h3>
      <div
        className="rounded-xl p-3"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Selector for multiple options */}
        {options.length > 1 ? (
          <div className="mb-3">
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Showing steps for:
            </p>
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="text-sm font-medium rounded-lg px-2 py-1.5 w-full"
              style={{
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {options.map((opt, i) => (
                <option key={i} value={i}>
                  {opt.access_method.split(' → ')[0]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Showing steps for: <span className="font-medium" style={{ color: 'var(--color-text)' }}>{displayName}</span>
          </p>
        )}

        {/* Steps */}
        <ol className="space-y-2.5">
          {steps.map((s) => (
            <li key={s.step} className="flex gap-3">
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                }}
              >
                {s.step}
              </span>
              <span className="text-sm leading-snug pt-0.5" style={{ color: 'var(--color-text)' }}>
                {s.instruction}
              </span>
            </li>
          ))}
        </ol>

        {/* Disclaimer */}
        <p
          className="text-xs mt-3 pt-2"
          style={{ color: 'var(--color-text-tertiary)', borderTop: '1px solid var(--color-border)' }}
        >
          Access policies may change. Always verify requirements at the lounge before your visit.
        </p>
      </div>
    </section>
  );
}

/**
 * LoungeDetail — View 3: Full detail view for a selected lounge.
 */
export default function LoungeDetail({
  lounge,
  airportTimezone,
  onBack,
  showBackButton = true,
  selectedTerminal,
}: LoungeDetailProps) {
  const hoursStatus = isLoungeOpen(lounge.operating_hours, airportTimezone);
  const { showPlaceholder, onError } = useLoungeImage(lounge.image_url, lounge.venue_type);

  // Single source of truth for amenities (consolidated column)
  const amenities = (
    typeof lounge.amenities === 'object' && lounge.amenities !== null
      ? lounge.amenities
      : {}
  ) as Record<string, unknown>;

  const activeAmenities = AMENITY_DEFS.filter((def) => amenities[def.key] === true);
  const hasAmenityData = activeAmenities.length > 0;
  const needsFetch = !lounge.detail_last_fetched_at && lounge.source_url;
  const hasFetched = !!lounge.detail_last_fetched_at;

  // Sort access options: free first
  const sortedOptions = [...lounge.access_options].sort((a, b) => {
    const typeOrder =
      (a.access_type === 'free' ? 0 : 1) - (b.access_type === 'free' ? 0 : 1);
    if (typeOrder !== 0) return typeOrder;
    return a.entry_cost - b.entry_cost;
  });

  // Has conditions on any option
  const anyConditions = sortedOptions.some((o) => o.has_conditions);

  return (
    <div className="flex flex-col min-h-0">
      {/* Hero image */}
      <div className="relative h-[200px] md:h-[240px] overflow-hidden flex-shrink-0">
        {showBackButton && (
          <button
            onClick={onBack}
            className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: '#fff',
            }}
            aria-label="Back to lounge list"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        {!showPlaceholder ? (
          <img
            src={lounge.image_url!}
            alt={lounge.lounge_name}
            className="w-full h-full object-cover"
            onError={onError}
          />
        ) : (
          <LoungePlaceholderImage venueType={lounge.venue_type} />
        )}
      </div>

      {/* Terminal mismatch warning */}
      {selectedTerminal && selectedTerminal !== 'All Terminals' && lounge.terminal !== selectedTerminal && (
        <div
          className="mx-4 mt-3 p-3 rounded-xl flex items-start gap-3"
          style={{
            backgroundColor: 'var(--color-warning-light)',
            border: '1px solid var(--color-warning)',
          }}
          role="alert"
        >
          <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
              Different Terminal
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text)' }}>
              This lounge is in {lounge.terminal}. You filtered by {selectedTerminal}. You may need to exit security and re-clear to access this lounge.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Verify before your visit.
            </p>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-8 space-y-5">
          {/* Title */}
          <div>
            <h2
              className="text-xl font-bold leading-snug"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}
            >
              {lounge.lounge_name}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {lounge.terminal}
            </p>
          </div>

          {/* ── ACCESS SECTION ────────────────────────────── */}
          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Your Access
            </h3>
            <div
              className="rounded-xl p-3"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {sortedOptions.map((opt, i) => (
                <AccessOptionCard key={`${opt.access_method}-${i}`} option={opt} sourceUrl={lounge.source_url} />
              ))}
            </div>

            {/* Conditions banner */}
            {anyConditions && (
              <div
                className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: 'var(--color-warning-light)',
                  color: 'var(--color-warning)',
                }}
                role="alert"
              >
                <AlertTriangle size={14} className="flex-shrink-0" aria-hidden="true" />
                Same-day flight may be required for some access methods
              </div>
            )}
          </section>

          {/* ── HOW TO ACCESS SECTION ──────────────────────── */}
          <HowToAccessSection accessOptions={sortedOptions} loungeName={lounge.lounge_name} />

          {/* ── HOURS SECTION ─────────────────────────────── */}
          <HoursSection
            hoursStatus={hoursStatus}
            operatingHours={lounge.operating_hours}
            sourceUrl={lounge.source_url}
          />

          {/* ── AMENITIES SECTION ──────────────────────────── */}
          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Amenities
            </h3>
            {hasAmenityData ? (
              <div className="flex flex-wrap gap-2">
                {activeAmenities.map((def) => (
                  <span
                    key={def.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {iconMap[def.iconName] ?? null}
                    {def.label}
                  </span>
                ))}
              </div>
            ) : needsFetch ? (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rectangular" animation="shimmer" width={80} height={28} className="rounded-full" />
                ))}
              </div>
            ) : hasFetched ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Amenity details unavailable
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Amenity details unavailable
              </p>
            )}
          </section>

          {/* ── LOCATION SECTION ───────────────────────────── */}
          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Location
            </h3>
            <div className="space-y-1 text-sm" style={{ color: 'var(--color-text)' }}>
              <p className="flex items-center gap-2">
                <MapPin size={14} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
                {lounge.terminal}
              </p>
              {lounge.is_airside !== null && (
                <p className="pl-[22px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {lounge.is_airside ? 'Airside (past security)' : 'Landside (before security)'}
                </p>
              )}
              {lounge.gate_proximity && (
                <p className="pl-[22px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {lounge.gate_proximity}
                </p>
              )}
            </div>
          </section>

          {/* ── FOOTER CTA ─────────────────────────────────── */}
          {lounge.source_url && (
            <div className="pt-2">
              <Button
                variant="outline"
                fullWidth
                rightIcon={<ExternalLink size={16} />}
                onClick={() => window.open(lounge.source_url!, '_blank', 'noopener,noreferrer')}
              >
                View full details
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
