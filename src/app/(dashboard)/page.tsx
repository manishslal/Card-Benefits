'use client';

import React, { useState, useEffect } from 'react';
import { SafeDarkModeToggle } from '@/components/SafeDarkModeToggle';
import Button from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';
import CardSwitcher from '@/components/features/CardSwitcher';
import DashboardSummary from '@/components/features/DashboardSummary';
import BenefitsGrid from '@/components/features/BenefitsGrid';
import { AddCardModal } from '@/components/AddCardModal';
import { AddBenefitModal } from '@/components/AddBenefitModal';
import { EditBenefitModal } from '@/components/EditBenefitModal';
import { DeleteBenefitConfirmationDialog } from '@/components/DeleteBenefitConfirmationDialog';
import { CreditCard, Settings, Plus } from 'lucide-react';

/**
 * Dashboard Page - Redesigned
 *
 * Features:
 * - Welcome header with quick actions
 * - Real user cards loaded from API (BLOCKER #7 FIX)
 * - Card switcher for navigating between cards
 * - Dashboard summary statistics
 * - Benefits grid view with fully wired modals
 * - Responsive layout
 * - Dark mode support
 * - Loading and error states
 */

// Mark as dynamic page to avoid SSG issues with ThemeProvider
export const dynamic = 'force-dynamic';

/**
 * Type definitions for card and benefit display
 */
interface CardData {
  id: string;
  name: string;
  type: 'visa' | 'amex' | 'mastercard' | 'discover' | 'other';
  lastFour: string;
  issuer: string;
  customName?: string | null;
}

interface BenefitData {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  status: 'active' | 'expiring' | 'expired' | 'pending';
  expirationDate?: Date | string | null;
  description?: string;
  value?: number;
  usage?: number;
}

export default function DashboardPage() {
  // ============================================================
  // State Management - Real Data Loading
  // ============================================================

  const [cards, setCards] = useState<CardData[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [userName, setUserName] = useState('User');

  // ============================================================
  // State Management - Benefit Modals
  // ============================================================

  const [benefits, setBenefits] = useState<BenefitData[]>([]);
  const [isAddBenefitOpen, setIsAddBenefitOpen] = useState(false);
  const [isEditBenefitOpen, setIsEditBenefitOpen] = useState(false);
  const [isDeleteBenefitOpen, setIsDeleteBenefitOpen] = useState(false);
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitData | null>(null);

  // ============================================================
  // Effect: Load user cards from API (BLOCKER #7 implementation)
  // ============================================================

  useEffect(() => {
    const loadUserCards = async () => {
      setIsLoadingCards(true);
      setCardsError(null);
      try {
        const response = await fetch('/api/cards/my-cards', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load user cards');
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to load cards');
        }

        // Transform API response to card display format
        const transformedCards: CardData[] = (data.cards || []).map((apiCard: any) => ({
          id: apiCard.id,
          name: apiCard.customName || apiCard.cardName,
          type: (apiCard.type || 'visa') as CardData['type'],
          lastFour: apiCard.lastFour || '0000',
          issuer: apiCard.issuer,
          customName: apiCard.customName,
        }));

        setCards(transformedCards);

        // Set first card as selected if available
        if (transformedCards.length > 0) {
          setSelectedCardId(transformedCards[0].id);
        }
      } catch (error) {
        console.error('Error loading cards:', error);
        setCardsError('Failed to load your cards. Please refresh the page.');
        // Fallback to empty state
        setCards([]);
      } finally {
        setIsLoadingCards(false);
      }
    };

    loadUserCards();
  }, []);

  // ============================================================
  // Effect: Load user profile for personalized greeting
  // ============================================================

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const response = await fetch('/api/auth/user', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            const firstName = data.user.firstName || 'User';
            setUserName(firstName);
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadUserProfile();
  }, []);

  // ============================================================
  // Handler: Refresh cards after adding new card
  // ============================================================

  const handleCardAdded = async () => {
    // Reload cards after successful add
    try {
      const response = await fetch('/api/cards/my-cards', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.cards) {
          const transformedCards: CardData[] = (data.cards || []).map((apiCard: any) => ({
            id: apiCard.id,
            name: apiCard.customName || apiCard.cardName,
            type: (apiCard.type || 'visa') as CardData['type'],
            lastFour: apiCard.lastFour || '0000',
            issuer: apiCard.issuer,
            customName: apiCard.customName,
          }));

          setCards(transformedCards);

          // Select the newly added card
          if (transformedCards.length > 0) {
            setSelectedCardId(transformedCards[transformedCards.length - 1].id);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing cards:', error);
    }
  };

  // ============================================================
  // Handler: Edit Benefit - Opens edit modal with selected benefit
  // Following the pattern from card detail page
  // ============================================================

  const handleEditBenefitClick = (benefitId: string) => {
    const benefit = benefits.find((b) => b.id === benefitId);
    if (benefit) {
      setSelectedBenefit(benefit);
      setIsEditBenefitOpen(true);
    }
  };

  // ============================================================
  // Handler: Delete Benefit - Opens confirmation dialog
  // Following the pattern from card detail page
  // ============================================================

  const handleDeleteBenefitClick = (benefitId: string) => {
    const benefit = benefits.find((b) => b.id === benefitId);
    if (benefit) {
      setSelectedBenefit(benefit);
      setIsDeleteBenefitOpen(true);
    }
  };

  // ============================================================
  // Handler: Benefit Updated - Updates benefits array after modal success
  // Called by EditBenefitModal onBenefitUpdated callback
  // ============================================================

  const handleBenefitUpdated = (updatedBenefit: BenefitData) => {
    setBenefits(benefits.map((b) => (b.id === updatedBenefit.id ? updatedBenefit : b)));
    setIsEditBenefitOpen(false);
    setSelectedBenefit(null);
  };

  // ============================================================
  // Handler: Benefit Added - Adds new benefit to array after modal success
  // Called by AddBenefitModal onBenefitAdded callback
  // ============================================================

  const handleBenefitAdded = (newBenefit: BenefitData) => {
    setBenefits([...benefits, newBenefit]);
    setIsAddBenefitOpen(false);
  };

  // ============================================================
  // Handler: Benefit Deleted - Removes benefit from array after confirmation
  // Called by DeleteBenefitConfirmationDialog onConfirm callback
  // ============================================================

  const handleBenefitDeleted = () => {
    if (selectedBenefit) {
      setBenefits(benefits.filter((b) => b.id !== selectedBenefit.id));
    }
    setIsDeleteBenefitOpen(false);
    setSelectedBenefit(null);
  };

  // ============================================================
  // Mock Benefits (to be replaced with real benefit data in future)
  // In production, benefits would come from selected card's data
  // ============================================================

  const mockBenefits: BenefitData[] = [
    {
      id: '1',
      name: 'Travel Credit',
      description: 'Annual $300 travel statement credit',
      type: 'StatementCredit',
      stickerValue: 30000, // $300 in cents
      userDeclaredValue: null,
      resetCadence: 'CalendarYear',
      status: 'active' as const,
      expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      value: 300,
      usage: 65,
    },
    {
      id: '2',
      name: 'Airport Lounge Access',
      description: 'Unlimited airport lounge access',
      type: 'UsagePerk',
      stickerValue: 15000, // $150 in cents
      userDeclaredValue: null,
      resetCadence: 'CardmemberYear',
      status: 'active' as const,
      expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      value: 150,
      usage: 100,
    },
    {
      id: '3',
      name: 'Dining Credit',
      description: 'Annual $100 dining statement credit',
      type: 'StatementCredit',
      stickerValue: 10000, // $100 in cents
      userDeclaredValue: null,
      resetCadence: 'CalendarYear',
      status: 'expiring' as const,
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      value: 100,
      usage: 30,
    },
    {
      id: '4',
      name: 'Concierge Service',
      description: '24/7 concierge support',
      type: 'UsagePerk',
      stickerValue: 20000, // $200 in cents
      userDeclaredValue: null,
      resetCadence: 'CardmemberYear',
      status: 'active' as const,
      value: 200,
      usage: 45,
    },
    {
      id: '5',
      name: 'Statement Credit',
      description: 'Streaming services credit',
      type: 'StatementCredit',
      stickerValue: 2000, // $20 in cents
      userDeclaredValue: null,
      resetCadence: 'Monthly',
      status: 'expired' as const,
      expirationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      value: 20,
      usage: 100,
    },
    {
      id: '6',
      name: 'Insurance Coverage',
      description: 'Travel insurance coverage',
      type: 'UsagePerk',
      stickerValue: 50000, // $500 in cents
      userDeclaredValue: null,
      resetCadence: 'OneTime',
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
      value: cards.length,
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

  // ============================================================
  // Render: Loading State
  // ============================================================

  if (isLoadingCards) {
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
              <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <CreditCard size={20} />
                </div>
                <h1 className="text-lg font-bold text-[var(--color-text)]">CardTrack</h1>
              </Link>

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
          </div>
        </header>

        {/* Loading Content */}
        <main className="flex-1 px-4 md:px-8 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse mb-4">
              <div className="h-8 w-32 bg-[var(--color-border)] rounded mx-auto mb-4" />
              <div className="h-4 w-48 bg-[var(--color-border)] rounded mx-auto" />
            </div>
            <p className="text-[var(--color-text-secondary)]">Loading your cards...</p>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // Render: Error State
  // ============================================================

  if (cardsError && cards.length === 0) {
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
              <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <CreditCard size={20} />
                </div>
                <h1 className="text-lg font-bold text-[var(--color-text)]">CardTrack</h1>
              </Link>

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
          </div>
        </header>

        {/* Error Content */}
        <main className="flex-1 px-4 md:px-8 py-8 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div
              className="p-4 rounded-lg mb-6"
              style={{
                backgroundColor: 'rgba(255, 59, 48, 0.1)',
              }}
            >
              <p className="text-[var(--color-error)] font-medium">{cardsError}</p>
            </div>

            <Button
              variant="primary"
              onClick={() => window.location.reload()}
              className="mx-auto"
            >
              Reload Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // Render: Main Dashboard
  // ============================================================

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
              <h1 className="text-lg font-bold text-[var(--color-text)]">CardTrack</h1>
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
                Welcome, {userName}! 👋
              </h2>
              <p className="text-sm mt-1 text-[var(--color-text-secondary)]">
                You have {cards.length} card{cards.length !== 1 ? 's' : ''} and {mockBenefits.length} benefits tracked
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
          {/* Empty State: No Cards */}
          {cards.length === 0 ? (
            <EmptyState
              icon={<CreditCard size={32} />}
              title="No Cards Added Yet"
              description="Start tracking your credit card benefits by adding your first card to the wallet."
              actionLabel="Add Your First Card"
              onAction={() => setIsAddCardModalOpen(true)}
            />
          ) : (
            <>
              {/* Card Switcher */}
              <CardSwitcher
                cards={cards}
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
                    Benefits on {cards.find((c) => c.id === selectedCardId)?.name || 'Selected Card'}
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsAddBenefitOpen(true)}
                  >
                    + Add Benefit
                  </Button>
                </div>

                {/* Benefits Grid */}
                <BenefitsGrid
                  benefits={mockBenefits as any}
                  onEdit={handleEditBenefitClick}
                  onDelete={handleDeleteBenefitClick}
                  onMarkUsed={handleEditBenefitClick}
                  gridColumns={3}
                />
              </section>
            </>
          )}
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

      {/* Add Card Modal */}
      <AddCardModal
        isOpen={isAddCardModalOpen}
        onClose={() => setIsAddCardModalOpen(false)}
        onCardAdded={handleCardAdded}
      />

      {/* Add Benefit Modal */}
      <AddBenefitModal
        cardId={selectedCardId}
        isOpen={isAddBenefitOpen}
        onClose={() => setIsAddBenefitOpen(false)}
        onBenefitAdded={handleBenefitAdded}
      />

      {/* Edit Benefit Modal */}
      <EditBenefitModal
        benefit={selectedBenefit as any}
        isOpen={isEditBenefitOpen}
        onClose={() => {
          setIsEditBenefitOpen(false);
          setSelectedBenefit(null);
        }}
        onBenefitUpdated={handleBenefitUpdated}
      />

      {/* Delete Benefit Confirmation Dialog */}
      <DeleteBenefitConfirmationDialog
        benefit={selectedBenefit}
        isOpen={isDeleteBenefitOpen}
        onClose={() => {
          setIsDeleteBenefitOpen(false);
          setSelectedBenefit(null);
        }}
        onConfirm={handleBenefitDeleted}
      />
    </div>
  );
}
