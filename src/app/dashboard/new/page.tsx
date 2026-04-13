'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PeriodSelector, PeriodOption } from './components/PeriodSelector';
import { SummaryBox } from './components/SummaryBox';
import { BenefitsList } from './components/BenefitsList';
import { BenefitRowProps } from './components/BenefitRow';
import { calculatePeriodDateRange, getPeriodDisplayLabel } from '../utils/period-helpers';
import { fetchDashboardData, toggleBenefitUsed } from '../utils/api-client';
import CardSwitcher from '@/shared/components/features/CardSwitcher';
import { EditBenefitModal } from '@/features/benefits/components/modals/EditBenefitModal';
import { DeleteBenefitConfirmationDialog } from '@/features/benefits/components/modals/DeleteBenefitConfirmationDialog';

/**
 * Type definitions for card and benefit
 */
interface CardData {
  id: string;
  name: string;
  productName: string;
  type: 'visa' | 'amex' | 'mastercard' | 'discover' | 'other';
  lastFour?: string;
  issuer: string;
  customName?: string | null;
}

interface ApiCard {
  id: string;
  cardName: string;
  customName?: string | null;
  type?: string;
  lastFour?: string;
  issuer: string;
}

interface BenefitData {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  status?: string;
  expirationDate: string | null;
  description?: string;
  value?: number;
  usage?: number;
  isUsed?: boolean;
}

/**
 * Enhanced Dashboard Page - Period-First Benefits Tracker
 *
 * Features:
 * - Card switcher for selecting individual card or all cards
 * - Period selector (This Month, Quarter, Half Year, Full Year, All Time)
 * - Multi-select status filters with Lucide icons
 * - Summary statistics box with minimal styling
 * - Benefits grouped by status with expandable sections
 * - Edit, Delete, Mark Used modals fully wired
 * - Progress bars with percentage display
 * - Responsive design with dark mode support
 */
export default function EnhancedDashboardPage() {
  // ============================================================
  // State Management - Card Selection
  // ============================================================
  const [cards, setCards] = useState<CardData[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('all');
  const [isLoadingCards, setIsLoadingCards] = useState(true);

  // ============================================================
  // State Management - Filters and Benefits
  // ============================================================
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('this-month');
  const [allBenefits, setAllBenefits] = useState<BenefitRowProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // State Management - Modals
  // ============================================================
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // ============================================================
  // Period Configuration
  // ============================================================
  const periodOptions: PeriodOption[] = useMemo(
    () => [
      {
        id: 'this-month',
        label: 'This Month',
        displayLabel: getPeriodDisplayLabel('this-month'),
        getDateRange: () => calculatePeriodDateRange('this-month'),
      },
      {
        id: 'this-quarter',
        label: 'This Quarter',
        displayLabel: getPeriodDisplayLabel('this-quarter'),
        getDateRange: () => calculatePeriodDateRange('this-quarter'),
      },
      {
        id: 'first-half',
        label: 'First Half Year',
        displayLabel: getPeriodDisplayLabel('first-half'),
        getDateRange: () => calculatePeriodDateRange('first-half'),
      },
      {
        id: 'full-year',
        label: 'Full Year',
        displayLabel: getPeriodDisplayLabel('full-year'),
        getDateRange: () => calculatePeriodDateRange('full-year'),
      },
      {
        id: 'all-time',
        label: 'All Time',
        displayLabel: getPeriodDisplayLabel('all-time'),
        getDateRange: () => calculatePeriodDateRange('all-time'),
      },
    ],
    []
  );

  // ============================================================
  // Load Dashboard Data and Cards
  // ============================================================
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setIsLoadingCards(true);
        setError(null);

        // Load dashboard data
        const data = await fetchDashboardData();
        setAllBenefits(data.benefits);

        // Load cards from API
        const cardsResponse = await fetch('/api/cards/my-cards', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (cardsResponse.ok) {
          const cardsData = await cardsResponse.json();
          if (cardsData.success && cardsData.cards) {
            const transformedCards: CardData[] = cardsData.cards.map((card: ApiCard) => ({
              id: card.id,
              name: card.customName || card.cardName,
              productName: card.cardName,
              type: (card.type || 'visa') as CardData['type'],
              lastFour: card.lastFour || undefined,
              issuer: card.issuer,
              customName: card.customName,
            }));
            setCards(transformedCards);
            if (transformedCards.length > 0) {
              setSelectedCardId(transformedCards[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load dashboard. Please try again.'
        );
        // Use mock data for development
        setAllBenefits(generateMockBenefits());
      } finally {
        setIsLoading(false);
        setIsLoadingCards(false);
      }
    };

    loadDashboard();
  }, []);

  // ============================================================
  // Filter Benefits by Selected Card and Status
  // ============================================================
  const benefits = useMemo(() => {
    let filtered = allBenefits;

    // Filter by selected card
    if (selectedCardId !== 'all') {
      filtered = filtered.filter((b) => b.cardName === selectedCardId);
    }

    return filtered;
  }, [allBenefits, selectedCardId]);

  // ============================================================
  // Calculate Summary Statistics
  // ============================================================
  const summary = useMemo(() => {
    const activeBenefits = benefits.filter((b) => b.status === 'active');
    const expiringBenefits = benefits.filter((b) => b.status === 'expiring_soon');
    const usedBenefits = benefits.filter((b) => b.status === 'used');

    const totalValue = benefits.reduce((sum, b) => sum + b.available, 0);

    return {
      total: benefits.length,
      active: activeBenefits.length,
      expiring: expiringBenefits.length,
      used: usedBenefits.length,
      totalValue,
    };
  }, [benefits]);

  // ============================================================
  // Event Handlers
  // ============================================================
  const handlePeriodChange = useCallback((periodId: string) => {
    setSelectedPeriodId(periodId);
  }, []);

  const handleCardSelect = useCallback((cardId: string) => {
    setSelectedCardId(cardId);
  }, []);

  const handleMarkUsed = useCallback(
    async (benefitId: string) => {
      try {
        const result = await toggleBenefitUsed(benefitId, true);
        if (result.success) {
          setAllBenefits((prev) =>
            prev.map((b) =>
              b.id === benefitId ? { ...b, status: 'used' as const } : b
            )
          );
        }
      } catch (err) {
        console.error('Error marking benefit as used:', err);
        alert('Failed to mark benefit as used');
      }
    },
    []
  );

  const handleEdit = useCallback((benefitId: string) => {
    const benefit = allBenefits.find((b) => b.id === benefitId);
    if (benefit) {
      setSelectedBenefit({
        id: benefit.id,
        name: benefit.name,
        type: '',
        stickerValue: benefit.available,
        userDeclaredValue: benefit.available,
        resetCadence: benefit.resetCadence,
        expirationDate: null,
      } as BenefitData);
      setIsEditModalOpen(true);
    }
  }, [allBenefits]);

  const handleDelete = useCallback((benefitId: string) => {
    const benefit = allBenefits.find((b) => b.id === benefitId);
    if (benefit) {
      setSelectedBenefit({
        id: benefit.id,
        name: benefit.name,
        type: '',
        stickerValue: benefit.available,
        userDeclaredValue: benefit.available,
        resetCadence: benefit.resetCadence,
        expirationDate: null,
      } as BenefitData);
      setIsDeleteDialogOpen(true);
    }
  }, [allBenefits]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API returns partial fields, merged into state
  const handleBenefitUpdated = (updatedFields: any) => {
    setAllBenefits((prev) =>
      prev.map((b) =>
        b.id === updatedFields.id
          ? {
              ...b,
              ...(updatedFields.name != null && { name: updatedFields.name }),
              ...(updatedFields.userDeclaredValue != null && {
                available: updatedFields.userDeclaredValue / 100,
              }),
            }
          : b
      )
    );
    setIsEditModalOpen(false);
    setSelectedBenefit(null);
  };

  const handleBenefitDeleted = () => {
    if (selectedBenefit) {
      setAllBenefits((prev) => prev.filter((b) => b.id !== selectedBenefit.id));
    }
    setIsDeleteDialogOpen(false);
    setSelectedBenefit(null);
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      {/* Page Header */}
      <div 
        className="border-b sticky top-0 z-50"
        style={{ 
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 
            className="text-3xl font-bold mb-6"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
          >
            💳 My Benefits
          </h1>

          {/* Card Switcher */}
          {!isLoadingCards && cards.length > 0 && (
            <CardSwitcher
              cards={cards}
              selectedCardId={selectedCardId === 'all' ? cards[0].id : selectedCardId}
              onSelectCard={handleCardSelect}
            />
          )}

          {/* Controls Row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
            <PeriodSelector
              selectedPeriodId={selectedPeriodId}
              onPeriodChange={handlePeriodChange}
              periods={periodOptions}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div 
            className="mb-6 border rounded-lg p-4"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: 'var(--color-error)'
            }}
          >
            <p className="font-medium">{error}</p>
            <p className="text-sm mt-2" style={{ opacity: 0.8 }}>
              Using mock data for demonstration
            </p>
          </div>
        )}

        {/* Summary Box */}
        <SummaryBox
          totalBenefits={summary.total}
          activeCount={summary.active}
          expiringCount={summary.expiring}
          usedCount={summary.used}
          totalValue={summary.totalValue}
          isLoading={isLoading}
        />

        {/* Benefits List */}
        <div className="mt-8">
          <BenefitsList
            benefits={benefits}
            isLoading={isLoading}
            onMarkUsed={handleMarkUsed}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </main>

      {/* Modals */}
      {selectedBenefit && isEditModalOpen && (
        <EditBenefitModal
          benefit={selectedBenefit}
          isOpen={isEditModalOpen}
          onBenefitUpdated={handleBenefitUpdated}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedBenefit(null);
          }}
        />
      )}

      {selectedBenefit && isDeleteDialogOpen && (
        <DeleteBenefitConfirmationDialog
          benefit={selectedBenefit}
          isOpen={isDeleteDialogOpen}
          onConfirm={handleBenefitDeleted}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setSelectedBenefit(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Generate mock benefit data for development
 */
function generateMockBenefits(): BenefitRowProps[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return [
    {
      id: '1',
      name: 'Uber $15',
      issuer: 'Amex Platinum',
      cardName: 'Amex Plat',
      status: 'active',
      periodStart: monthStart,
      periodEnd: monthEnd,
      available: 15,
      used: 0,
      resetCadence: 'MONTHLY',
    },
    {
      id: '2',
      name: 'Dining $50/$100',
      issuer: 'Chase Sapphire',
      cardName: 'CSR',
      status: 'active',
      periodStart: monthStart,
      periodEnd: monthEnd,
      available: 50,
      used: 25,
      resetCadence: 'MONTHLY',
    },
    {
      id: '3',
      name: 'Lululemon $75',
      issuer: 'Amex Platinum',
      cardName: 'Amex Plat',
      status: 'expiring_soon',
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
      periodEnd: new Date(now.getFullYear(), now.getMonth(), 7),
      available: 75,
      used: 0,
      resetCadence: 'QUARTERLY',
    },
    {
      id: '4',
      name: 'Hotel Credit $250',
      issuer: 'Amex Platinum',
      cardName: 'Amex Plat',
      status: 'used',
      periodStart: monthStart,
      periodEnd: monthEnd,
      available: 250,
      used: 250,
      resetCadence: 'ANNUAL',
    },
  ];
}
