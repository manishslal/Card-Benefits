'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppHeader } from '@/shared/components/layout';
import { Armchair } from 'lucide-react';
import AirportSearch from './components/AirportSearch';
import LoungeList from './components/LoungeList';
import LoungeDetail from './components/LoungeDetail';
import type { Airport, LoungeData, EligibleResponse } from './components/types';

// ────────────────────────────────────────────────────────────
// View state machine
// ────────────────────────────────────────────────────────────
type ViewState = 'search' | 'list' | 'detail';

export default function LoungesPage() {
  const [view, setView] = useState<ViewState>('search');
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [selectedLounge, setSelectedLounge] = useState<LoungeData | null>(null);
  const [loungeData, setLoungeData] = useState<EligibleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache per-airport results in session
  const cache = useRef<Map<string, EligibleResponse>>(new Map());

  // Track desktop vs mobile for layout
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // ── Fetch lounges for an airport ──────────────────────────
  const fetchLounges = useCallback(async (iataCode: string, forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh && cache.current.has(iataCode)) {
      setLoungeData(cache.current.get(iataCode)!);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lounges/eligible?airport=${iataCode}`);
      if (!res.ok) throw new Error('Failed to load lounges');
      const data: EligibleResponse = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load lounges');
      cache.current.set(iataCode, data);
      setLoungeData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lounges');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Navigation handlers ───────────────────────────────────
  const handleAirportSelect = useCallback(
    (airport: Airport) => {
      setSelectedAirport(airport);
      setSelectedLounge(null);
      setView('list');
      fetchLounges(airport.iata_code);
    },
    [fetchLounges],
  );

  const handleLoungeSelect = useCallback((lounge: LoungeData) => {
    setSelectedLounge(lounge);
    setView('detail');
  }, []);

  const handleBackToSearch = useCallback(() => {
    setView('search');
    setSelectedLounge(null);
    setLoungeData(null);
  }, []);

  const handleBackToList = useCallback(() => {
    setView('list');
    setSelectedLounge(null);
  }, []);

  const handleRetry = useCallback(() => {
    if (selectedAirport) {
      fetchLounges(selectedAirport.iata_code, true);
    }
  }, [selectedAirport, fetchLounges]);

  // ── MOBILE LAYOUT ─────────────────────────────────────────
  if (!isDesktop) {
    return (
      <div
        className="flex flex-col min-h-screen"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <AppHeader />

        <main className="flex-1 flex flex-col">
          {view === 'search' && (
            <AirportSearch onAirportSelect={handleAirportSelect} />
          )}

          {view === 'list' && (
            <LoungeList
              data={loungeData}
              isLoading={isLoading}
              error={error}
              onBack={handleBackToSearch}
              onSelectLounge={handleLoungeSelect}
              onRetry={handleRetry}
              onAddCards={() => { window.location.href = '/dashboard'; }}
            />
          )}

          {view === 'detail' && selectedLounge && (
            <LoungeDetail
              lounge={selectedLounge}
              airportTimezone={loungeData?.airport_timezone ?? null}
              onBack={handleBackToList}
              showBackButton
            />
          )}
        </main>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────────────────
  // search: centered full-width
  // list: left panel with list, right panel placeholder or detail
  // detail: left panel with list, right panel with detail

  if (view === 'search') {
    return (
      <div
        className="flex flex-col min-h-screen"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <AppHeader />
        <main className="flex-1 flex items-start justify-center pt-12">
          <AirportSearch onAirportSelect={handleAirportSelect} />
        </main>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <AppHeader />

      <main className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>
        {/* Left panel — list */}
        <div
          className="w-[380px] flex-shrink-0 flex flex-col overflow-y-auto"
          style={{ borderRight: '1px solid var(--color-border)' }}
        >
          <LoungeList
            data={loungeData}
            isLoading={isLoading}
            error={error}
            onBack={handleBackToSearch}
            onSelectLounge={handleLoungeSelect}
            onRetry={handleRetry}
            selectedLoungeId={selectedLounge?.lounge_id}
            onAddCards={() => { window.location.href = '/dashboard'; }}
          />
        </div>

        {/* Right panel — detail or placeholder */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {selectedLounge ? (
            <LoungeDetail
              lounge={selectedLounge}
              airportTimezone={loungeData?.airport_timezone ?? null}
              onBack={handleBackToList}
              showBackButton={false}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <Armchair size={28} style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
              </div>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Select a lounge to see details
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

