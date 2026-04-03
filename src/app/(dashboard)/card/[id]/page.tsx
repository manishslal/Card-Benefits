'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SafeDarkModeToggle } from '@/components/SafeDarkModeToggle';
import Button from '@/components/ui/button';
import Link from 'next/link';
import BenefitsList from '@/components/features/BenefitsList';
import BenefitsGrid from '@/components/features/BenefitsGrid';

/**
 * Card Detail Page - Individual Card View
 * 
 * Features:
 * - Card header with name and details
 * - Card information section
 * - Toggle between list and grid views
 * - Benefits tracking with filters
 * - Edit and delete actions
 */

// Mark as dynamic page to avoid SSG issues with ThemeProvider
export const dynamic = 'force-dynamic';

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.id as string;

  // Mock card data
  const mockCard = {
    id: cardId,
    name: 'Chase Sapphire Reserve',
    issuer: 'Chase',
    type: 'Visa Infinite',
    lastFour: '4242',
    annualFee: 550,
    rewardsRate: '3x on travel and dining',
    issuedDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    renewalDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    image: '💳',
  };

  const mockBenefits = [
    {
      id: '1',
      name: 'Travel Credit',
      description: 'Annual $300 travel statement credit',
      status: 'active' as const,
      expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      value: 300,
      usage: 65,
    },
    {
      id: '2',
      name: 'Airport Lounge Access',
      description: 'Unlimited airport lounge access',
      status: 'active' as const,
      expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      value: 150,
      usage: 100,
    },
    {
      id: '3',
      name: 'Dining Credit',
      description: 'Annual $100 dining statement credit',
      status: 'expiring' as const,
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      value: 100,
      usage: 30,
    },
    {
      id: '4',
      name: 'Concierge Service',
      description: '24/7 concierge support',
      status: 'active' as const,
      value: 200,
      usage: 45,
    },
    {
      id: '5',
      name: 'Statement Credit',
      description: 'Streaming services credit',
      status: 'expired' as const,
      expirationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      value: 20,
      usage: 100,
    },
    {
      id: '6',
      name: 'Insurance Coverage',
      description: 'Travel insurance coverage',
      status: 'pending' as const,
      value: 500,
      usage: 0,
    },
  ];

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');

  const filteredBenefits = mockBenefits.filter((benefit) => {
    if (filterStatus === 'all') return true;
    return benefit.status === filterStatus;
  });

  const daysUntilRenewal = Math.ceil(
    (mockCard.renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b py-4"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between">
            {/* Logo & Back Button */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  💳
                </div>
                <h1 className="text-lg font-bold text-[var(--color-text)]">
                  CardTrack
                </h1>
              </Link>

              <button
                onClick={() => router.back()}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                aria-label="Go back"
              >
                ← Back
              </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              <SafeDarkModeToggle />
              <Button variant="outline" size="sm">
                Edit Card
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Card Header Section */}
          <section className="mb-8">
            <div className="p-6 rounded-lg border" style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border)',
            }}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="text-4xl mb-3">{mockCard.image}</div>
                  <h2
                    className="font-bold text-[var(--color-text)] mb-2"
                    style={{ fontSize: 'var(--text-h3)' }}
                  >
                    {mockCard.name}
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {mockCard.issuer} • {mockCard.type} • •••• {mockCard.lastFour}
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end gap-2">
                  <div>
                    <span
                      className="text-xs font-semibold text-[var(--color-text-secondary)]"
                    >
                      Annual Fee
                    </span>
                    <p className="text-xl font-mono font-bold text-[var(--color-text)]">
                      ${mockCard.annualFee}
                    </p>
                  </div>

                  <div className="mt-2">
                    <span
                      className="text-xs font-semibold text-[var(--color-text-secondary)]"
                    >
                      Renews in
                    </span>
                    <p
                      className="text-base font-semibold"
                      style={{ color: daysUntilRenewal <= 90 ? 'var(--color-warning)' : 'var(--color-success)' }}
                    >
                      {daysUntilRenewal} days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Card Details Section */}
          <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
              }}>
              <span
                className="text-xs font-semibold text-[var(--color-text-secondary)]"
              >
                Issued
              </span>
              <p className="text-sm font-semibold text-[var(--color-text)] mt-1">
                {mockCard.issuedDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>

            <div className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
              }}>
              <span
                className="text-xs font-semibold text-[var(--color-text-secondary)]"
              >
                Renewal Date
              </span>
              <p className="text-sm font-semibold text-[var(--color-text)] mt-1">
                {mockCard.renewalDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>

            <div className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
              }}>
              <span
                className="text-xs font-semibold text-[var(--color-text-secondary)]"
              >
                Rewards Rate
              </span>
              <p className="text-sm font-semibold text-[var(--color-text)] mt-1">
                {mockCard.rewardsRate}
              </p>
            </div>
          </section>

          {/* Benefits Section */}
          <section>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <h3
                className="text-lg font-semibold text-[var(--color-text)]"
                style={{ fontSize: 'var(--text-h4)' }}
              >
                Card Benefits
              </h3>

              <div className="flex flex-wrap gap-2">
                {/* View toggle */}
                <div className="flex gap-1 p-1 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border)',
                  }}>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === 'list'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    Grid
                  </button>
                </div>

                {/* Add benefit button */}
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon="+"
                >
                  Add Benefit
                </Button>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(['all', 'active', 'expiring', 'expired'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    filterStatus === status
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {' '}
                  ({mockBenefits.filter((b) => b.status === status).length})
                </button>
              ))}
            </div>

            {/* Benefits view */}
            {viewMode === 'list' ? (
              <BenefitsList
                benefits={filteredBenefits}
                onEdit={(id) => console.log('Edit:', id)}
                onDelete={(id) => console.log('Delete:', id)}
                onMarkUsed={(id) => console.log('Mark used:', id)}
              />
            ) : (
              <BenefitsGrid
                benefits={filteredBenefits}
                onEdit={(id) => console.log('Edit:', id)}
                onDelete={(id) => console.log('Delete:', id)}
                onMarkUsed={(id) => console.log('Mark used:', id)}
                gridColumns={3}
              />
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t py-6 mt-auto"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center text-xs text-[var(--color-text-secondary)]">
          <p>&copy; 2024 CardTrack. Track your benefits with confidence.</p>
        </div>
      </footer>
    </div>
  );
}
