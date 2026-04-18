'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Plane, Clock } from 'lucide-react';
import type { Airport } from './types';
import { getRecentAirports, saveRecentAirport } from './types';

// ── Hardcoded fallback airports for instant search ──────────
const FALLBACK_AIRPORTS: Airport[] = [
  { iata_code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', timezone: 'America/New_York' },
  { iata_code: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', timezone: 'America/New_York' },
  { iata_code: 'CLT', name: 'Charlotte Douglas International Airport', city: 'Charlotte', timezone: 'America/New_York' },
  { iata_code: 'DEN', name: 'Denver International Airport', city: 'Denver', timezone: 'America/Denver' },
  { iata_code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', timezone: 'America/Chicago' },
  { iata_code: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', timezone: 'America/New_York' },
  { iata_code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', timezone: 'America/New_York' },
  { iata_code: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', timezone: 'America/Los_Angeles' },
  { iata_code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', timezone: 'America/Los_Angeles' },
  { iata_code: 'MCO', name: 'Orlando International Airport', city: 'Orlando', timezone: 'America/New_York' },
  { iata_code: 'MIA', name: 'Miami International Airport', city: 'Miami', timezone: 'America/New_York' },
  { iata_code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', timezone: 'America/Chicago' },
  { iata_code: 'PHL', name: 'Philadelphia International Airport', city: 'Philadelphia', timezone: 'America/New_York' },
  { iata_code: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', timezone: 'America/Phoenix' },
  { iata_code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', timezone: 'America/Los_Angeles' },
  { iata_code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', timezone: 'America/Los_Angeles' },
];

interface AirportSearchProps {
  onAirportSelect: (airport: Airport) => void;
}

/**
 * AirportSearch — View 1: Full-screen airport search with recent airports.
 */
export default function AirportSearch({ onAirportSelect }: AirportSearchProps) {
  const [query, setQuery] = useState('');
  const [airports, setAirports] = useState<Airport[]>(FALLBACK_AIRPORTS);
  const [recents, setRecents] = useState<Airport[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch airports from API on mount; merge with fallbacks
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/lounges/airports');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.airports) && data.airports.length > 0) {
          setAirports(data.airports);
        }
      } catch {
        // keep fallbacks
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load recent airports on mount (client only)
  useEffect(() => {
    setRecents(getRecentAirports());
  }, []);

  // Autofocus the search input
  useEffect(() => {
    // Small delay to allow layout to settle
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return airports.filter(
      (a) =>
        a.iata_code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q),
    );
  }, [query, airports]);

  const handleSelect = useCallback(
    (airport: Airport) => {
      saveRecentAirport(airport);
      onAirportSelect(airport);
    },
    [onAirportSelect],
  );

  const showRecents = query.trim().length === 0 && recents.length > 0;
  const showResults = query.trim().length > 0;
  const noResults = showResults && filtered.length === 0;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto px-4 pt-8 pb-16">
      {/* Title */}
      <h1
        className="text-2xl md:text-3xl font-bold text-center mb-1"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}
      >
        Lounge Finder
      </h1>
      <p
        className="text-sm text-center mb-6"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        See which lounges you can access with your cards
      </p>

      {/* Search input */}
      <div className="w-full relative mb-4">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Search size={18} aria-hidden="true" />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by city or airport code..."
          autoComplete="off"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            color: 'var(--color-text)',
            border: '1.5px solid var(--color-border)',
            fontFamily: 'var(--font-primary)',
          }}
          aria-label="Search airports"
        />
      </div>

      {/* Recent airports */}
      {showRecents && (
        <div className="w-full">
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Clock size={12} aria-hidden="true" />
            Recent
          </p>
          {recents.map((airport) => (
            <AirportRow key={airport.iata_code} airport={airport} onSelect={handleSelect} />
          ))}
        </div>
      )}

      {/* Search results */}
      {showResults && (
        <div className="w-full" role="listbox" aria-label="Airport search results">
          {filtered.map((airport) => (
            <AirportRow key={airport.iata_code} airport={airport} onSelect={handleSelect} />
          ))}
        </div>
      )}

      {/* No results */}
      {noResults && (
        <p
          className="text-sm mt-4 text-center"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          No airports found matching your search
        </p>
      )}

      {/* Footer */}
      <p
        className="text-xs mt-8 text-center"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        We currently cover {airports.length} US airports. More coming soon.
      </p>
    </div>
  );
}

// ── Airport Row ─────────────────────────────────────────────

function AirportRow({
  airport,
  onSelect,
}: {
  airport: Airport;
  onSelect: (a: Airport) => void;
}) {
  return (
    <button
      onClick={() => onSelect(airport)}
      className="w-full flex items-center gap-3 min-h-[56px] px-2 py-3 rounded-lg transition-colors text-left hover:bg-[var(--color-bg-secondary)]"
      style={{ borderBottom: '1px solid var(--color-border)' }}
      role="option"
      aria-label={`${airport.name}, ${airport.city}`}
    >
      <Plane
        size={18}
        className="flex-shrink-0"
        style={{ color: 'var(--color-primary)' }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium leading-snug truncate"
          style={{ color: 'var(--color-text)' }}
        >
          {airport.name}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {airport.iata_code} · {airport.city}
        </p>
      </div>
    </button>
  );
}
