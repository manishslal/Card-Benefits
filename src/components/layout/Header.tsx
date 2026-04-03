'use client';

import React from 'react';
import Link from 'next/link';
import { DarkModeToggle } from '@/components/ui/DarkModeToggle';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title?: string;
  showDarkModeToggle?: boolean;
}

/**
 * Header Component - Top Navigation Bar
 * Sticky header with logo, title, and dark mode toggle
 */
export function Header({ title = 'Card Benefits Tracker', showDarkModeToggle = true }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-[var(--color-border)]"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-4 md:px-6 lg:px-8"
        style={{ height: 'var(--height-header)' }}
      >
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #3968dd 100%)',
              }}
            >
              CB
            </div>
            <span
              className="hidden sm:inline font-bold text-lg"
              style={{ color: 'var(--color-text)' }}
            >
              {title}
            </span>
          </Link>
        </div>

        {/* Right section - Controls */}
        <div className="flex items-center gap-2">
          {showDarkModeToggle && <DarkModeToggle />}
          <Button variant="primary" size="sm" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export default Header;
