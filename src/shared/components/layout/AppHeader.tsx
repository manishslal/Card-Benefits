'use client';

import React from 'react';
import Link from 'next/link';
import { CreditCard, Settings, ArrowLeft } from 'lucide-react';

/**
 * AppHeader Component - Shared Header Used Across Pages
 *
 * Replaces inline header copies in dashboard, settings, and other pages.
 * Provides consistent styling and behavior for all top navigation.
 *
 * Features:
 * - Left: Logo icon + "CardTrack" text (vertically centered)
 * - Right: Settings button OR Back button (when backHref is provided)
 * - Optional rightSlot for additional controls
 * - Sticky positioning with ring outline and CSS variable theming
 * - No dark mode toggle (toggle stays in Preferences tab only)
 */

interface AppHeaderProps {
  /** If provided, renders a Back button linking to this href instead of Settings */
  backHref?: string;
  backLabel?: string;
  /** Extra JSX rendered after the primary action button (right side) */
  rightSlot?: React.ReactNode;
}

export function AppHeader({
  backHref,
  backLabel = 'Back',
  rightSlot,
}: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 safe-area-top safe-area-x"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        boxShadow: 'var(--header-shadow)',
      }}
    >
      <div className="py-2.5">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between">
            {/* Left: Logo + Title */}
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <CreditCard size={20} />
              </div>
              <span className="text-lg font-bold text-[var(--color-text)]">CardTrack</span>
            </Link>

            {/* Right: Settings or Back button + optional slot */}
            <div className="flex items-center gap-3">
              {backHref ? (
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ring-1 ring-inset ring-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                  style={{
                    color: 'var(--color-text)',
                  }}
                >
                  <ArrowLeft size={16} />
                  {backLabel}
                </Link>
              ) : (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ring-1 ring-inset ring-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                  style={{
                    color: 'var(--color-text)',
                  }}
                >
                  <Settings size={16} />
                  Settings
                </Link>
              )}
              {rightSlot}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
