'use client';

/**
 * Wrapper component that safely handles useSearchParams in client components
 * This component is necessary for Next.js 15 compatibility where useSearchParams
 * needs proper Suspense boundaries during static generation
 */

import { Suspense } from 'react';

interface SortablePageWrapperProps {
  children: React.ReactNode;
}

export function SortablePageWrapper({ children }: SortablePageWrapperProps) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
