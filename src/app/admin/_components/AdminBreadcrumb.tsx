'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

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
 * Uses CSS custom properties for theme-aware styling
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
    <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-6">
      <Link
        href="/admin"
        className="hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Admin
      </Link>
      <span>/</span>
      <span className="text-[var(--color-text)] font-medium">
        {breadcrumbs[currentPage]}
      </span>
    </div>
  );
}
