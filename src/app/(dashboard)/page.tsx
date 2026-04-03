'use client';

import React, { useState } from 'react';
import { SafeDarkModeToggle } from '@/components/SafeDarkModeToggle';
import Button from '@/components/ui/button';
import Link from 'next/link';
import CardSwitcher from '@/components/features/CardSwitcher';
import DashboardSummary from '@/components/features/DashboardSummary';
import BenefitsGrid from '@/components/features/BenefitsGrid';
import { AddCardModal } from '@/components/AddCardModal';
import { CreditCard, Settings, Plus } from 'lucide-react';

/**
 * Dashboard Page - Redesigned
 * 
 * Features:
 * - Welcome header with quick actions
 * - Card switcher for navigating between cards
 * - Dashboard summary statistics
 * - Benefits grid view
 * - Responsive layout
 * - Dark mode support
 */

// Mark as dynamic page to avoid SSG issues with ThemeProvider
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  // Mock data for demo
  const mockCards = [
    {
      id: '1',
      name: 'Chase Sapphire',
      type: 'visa' as const,
      lastFour: '4242',
      issuer: 'Chase',
    },
    {
      id: '2',
      name: 'Amex Platinum',
      type: 'amex' as const,
      lastFour: '0005',
      issuer: 'American Express',
    },
    {
      id: '3',
      name: 'Capital One',
      type: 'mastercard' as const,
      lastFour: '5555',
      issuer: 'Capital One',
    },
  ];

  const [selectedCardId, setSelectedCardId] = useState('1');
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);

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

  const summaryStats = [
    {
      label: 'Total Benefits',
      value: mockBenefits.length,
      icon: 'CreditCard',
      variant: 'default' as const,
    },
    {
      label: 'Total Value',
      value: `$${mockBenefits.reduce((sum, b) => sum + (b.value || 0), 0)}`,
      icon: 'DollarSign',
      variant: 'default' as const,
    },
    {
      label: 'Active Cards',
      value: mockCards.length,
      icon: 'Wallet',
      variant: 'default' as const,
    },
    {
      label: 'Expiring Soon',
      value: mockBenefits.filter((b) => b.status === 'expiring').length,
      icon: 'Clock',
      variant: 'default' as const,
    },
  ];

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
          <div className="flex items-center justify-between mb-4">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <CreditCard size={20} />
              </div>
              <h1 className="text-lg font-bold text-[var(--color-text)]">
                CardTrack
              </h1>
            </Link>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              <SafeDarkModeToggle />
              <Link href="/settings">
                <Button variant="outline" size="sm">
                  <Settings size={16} className="mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>

          {/* Welcome section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2
                className="font-semibold text-[var(--color-text)]"
                style={{ fontSize: 'var(--text-h4)' }}
              >
                Welcome, John! 👋
              </h2>
              <p
                className="text-sm mt-1 text-[var(--color-text-secondary)]"
              >
                You have {mockCards.length} cards and {mockBenefits.length} benefits tracked
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddCardModalOpen(true)}
            >
              <Plus size={16} className="mr-2" />
              Add Card
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Card Switcher */}
          <CardSwitcher
            cards={mockCards}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
          />

          {/* Dashboard Summary */}
          <DashboardSummary stats={summaryStats} />

          {/* Benefits Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3
                className="text-lg font-semibold text-[var(--color-text)]"
                style={{ fontSize: 'var(--text-h4)' }}
              >
                Benefits on {mockCards.find((c) => c.id === selectedCardId)?.name}
              </h3>
              <Button
                variant="secondary"
                size="sm"
              >
                + Add Benefit
              </Button>
            </div>

            {/* Benefits Grid */}
            <BenefitsGrid
              benefits={mockBenefits}
              onEdit={(id) => console.log('Edit benefit:', id)}
              onDelete={(id) => console.log('Delete benefit:', id)}
              onMarkUsed={(id) => console.log('Mark used:', id)}
              gridColumns={3}
            />
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
