'use client';

import Link from 'next/link';

interface AdminBreadcrumbProps {
  currentPage: 'benefits' | 'users' | 'cards' | 'audit' | 'card-detail';
  cardName?: string; // For card detail page
}

/**
 * AdminBreadcrumb Component
 * 
 * Provides navigation hierarchy for admin sub-pages.
 * Displays: "← Back to Admin / [Current Page Name]"
 * 
 * Supports light and dark modes via Tailwind dark: classes
 * 
 * @param currentPage - The current admin page identifier
 * @param cardName - Optional card name for card detail page
 */
export function AdminBreadcrumb({ currentPage, cardName }: AdminBreadcrumbProps) {
  const breadcrumbs: Record<string, string> = {
    benefits: 'Benefits',
    users: 'Users',
    cards: 'Cards',
    audit: 'Audit Logs',
    'card-detail': cardName || 'Card Detail',
  };

  return (
    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-6">
      <Link
        href="/admin"
        className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
      >
        ← Back to Admin
      </Link>
      <span>/</span>
      <span className="text-slate-900 dark:text-white font-medium">
        {breadcrumbs[currentPage]}
      </span>
    </div>
  );
}
