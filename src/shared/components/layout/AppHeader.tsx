'use client';

import React from 'react';
import Link from 'next/link';
import Button from '@/shared/components/ui/button';
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
 * - Sticky positioning with border and CSS variable theming
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
      className="sticky top-0 z-40 border-b py-2.5"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
      }}
    >
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
            <h1 className="text-lg font-bold text-[var(--color-text)]">CardTrack</h1>
          </Link>

          {/* Right: Settings or Back button + optional slot */}
          <div className="flex items-center gap-3">
            {backHref ? (
              <Link href={backHref}>
                <Button variant="outline" size="sm">
                  <ArrowLeft size={16} className="mr-2" />
                  {backLabel}
                </Button>
              </Link>
            ) : (
              <Link href="/settings">
                <Button variant="outline" size="sm">
                  <Settings size={16} className="mr-2" />
                  Settings
                </Button>
              </Link>
            )}
            {rightSlot}
          </div>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
