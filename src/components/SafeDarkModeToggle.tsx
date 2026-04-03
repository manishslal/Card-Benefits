'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Moon } from 'lucide-react';

// Dynamically import the real DarkModeToggle to avoid SSR issues
const RealDarkModeToggle = dynamic(
  () => import('@/components/ui/DarkModeToggle').then((mod) => ({ default: mod.DarkModeToggle })),
  {
    loading: () => (
      <button
        className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors"
        aria-label="Toggle dark mode"
        disabled
      >
        <Moon size={20} className="text-slate-700" />
      </button>
    ),
    ssr: false, // Disable server-side rendering for this component
  }
);

export function SafeDarkModeToggle() {
  return (
    <Suspense
      fallback={
        <button
          className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors"
          aria-label="Toggle dark mode"
          disabled
        >
          <Moon size={20} className="text-slate-700" />
        </button>
      }
    >
      <RealDarkModeToggle />
    </Suspense>
  );
}
