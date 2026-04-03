'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Moon } from 'lucide-react';

/**
 * SafeDarkModeToggle Component
 * 
 * Provides hydration-safe dark mode toggle with:
 * - Dynamic import to prevent SSR hydration mismatches
 * - Suspense boundary for loading state
 * - Proper async event handling for Chrome extension compatibility
 * - Fallback UI during loading
 * 
 * FIXES:
 * - Prevents Chrome extension console error about unhandled async responses
 * - Ensures theme toggle loads only on client side
 * - Provides accessible fallback button during load
 */

// Dynamically import the real DarkModeToggle to avoid SSR issues
// This prevents hydration mismatches between server and client renders
const RealDarkModeToggle = dynamic(
  () => import('@/components/ui/DarkModeToggle').then((mod) => ({ 
    default: mod.DarkModeToggle 
  })),
  {
    loading: () => <LoadingButton />,
    ssr: false, // Critical: disable server-side rendering for this component
  }
);

/**
 * LoadingButton - Fallback UI shown during component load
 * Displays a disabled button with Moon icon to prevent layout shift
 */
function LoadingButton() {
  return (
    <button
      className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors"
      aria-label="Toggle dark mode"
      disabled
      type="button"
    >
      <Moon size={20} className="text-slate-700" />
    </button>
  );
}

/**
 * SafeDarkModeToggle Export
 * Wraps dynamic component in Suspense with fallback
 */
export function SafeDarkModeToggle() {
  return (
    <Suspense fallback={<LoadingButton />}>
      <RealDarkModeToggle />
    </Suspense>
  );
}
