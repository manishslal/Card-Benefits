'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/shared/components/ui/use-toast';
import Button from '@/shared/components/ui/button';
import EmptyState from '@/shared/components/ui/EmptyState';
import { AppHeader } from '@/shared/components/layout';
import { CardSwitcher, DashboardSummary } from '@/shared/components/features';
import { BenefitsGrid, AddBenefitModal, EditBenefitModal, DeleteBenefitConfirmationDialog } from '@/features/benefits';
import { AddCardModal } from '@/features/cards/components/modals/AddCardModal';
import { deduplicateBenefits } from '@/lib/benefit-utils';
import { Plus, CreditCard, CheckCircle, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { SkeletonCard } from '@/shared/components/loaders';
import { type PeriodOption } from './new/components/PeriodSelector';
import { type BenefitStatus, type StatusOption } from './new/components/StatusFilters';
import { UnifiedFilterBar } from './new/components/UnifiedFilterBar';
import { MobileSummaryStats } from './new/components/MobileSummaryStats';
import {
  getCurrentMonthDisplay,
  getCurrentQuarterInfo,
} from './utils/period-helpers';

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
  productName: string; // Original card product name (never overwritten by customName)
  type: 'visa' | 'amex' | 'mastercard' | 'discover' | 'other';
  lastFour: string;
  issuer: string;
  customName?: string | null;
  benefits?: BenefitData[];
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
  isUsed?: boolean;
  createdDate?: Date | string;
  // Period-based fields (benefit engine)
  periodStart?: string | null;
  periodEnd?: string | null;
  periodStatus?: string | null;
  masterBenefitId?: string | null;
  claimingCadence?: string | null;
  claimedAt?: string | null;
}

/**
 * API response types for cards endpoint
 */
interface ApiCard {
  id: string;
  issuer: string;
  cardName: string;
  customName?: string | null;
  type?: string;
  lastFour?: string;
  benefits?: ApiBenefit[];
}

interface ApiBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue?: number | null;
  resetCadence: string;
  status?: string;
  expirationDate?: string | null;
  description?: string;
  isUsed?: boolean;
  claimedAt?: string | null;
  // Period-based fields (benefit engine)
  periodStart?: string | null;
  periodEnd?: string | null;
  periodStatus?: string | null;
  masterBenefitId?: string | null;
  claimingCadence?: string | null;
}

interface ApiCardsResponse {
  success: boolean;
  cards: ApiCard[];
  error?: string;
  benefitEngineEnabled?: boolean;
}

/**
 * Calculate yearly usage progress for a benefit based on sibling periods.
 * - MONTHLY: usedCount / 12 × 100
 * - QUARTERLY: usedCount / 4 × 100
 * - SEMI_ANNUAL: usedCount / 2 × 100
 * - ANNUAL / ONE_TIME: isUsed ? 100 : 0
 */
function calculateYearlyUsage(
  benefit: ApiBenefit,
  allBenefits: ApiBenefit[]
): number {
  const cadence = (benefit.claimingCadence || benefit.resetCadence || '').toUpperCase();

  if (cadence === 'ANNUAL' || cadence === 'ONE_TIME' || cadence === 'CALENDARYEAR' || cadence === 'CARDMEMBERYEAR') {
    return benefit.isUsed ? 100 : 0;
  }

  const totalPeriods = cadence === 'MONTHLY' ? 12
    : cadence === 'QUARTERLY' ? 4
    : cadence === 'SEMI_ANNUAL' ? 2
    : 1;

  // Find sibling benefits (same masterBenefitId, same year)
  if (!benefit.masterBenefitId) {
    return benefit.isUsed ? 100 : 0;
  }

  const currentYear = benefit.periodStart
    ? new Date(benefit.periodStart).getUTCFullYear()
    : new Date().getFullYear();

  const siblings = allBenefits.filter(b =>
    b.masterBenefitId === benefit.masterBenefitId &&
    b.periodStart &&
    new Date(b.periodStart).getUTCFullYear() === currentYear
  );

  const usedCount = siblings.filter(b => b.isUsed).length;
  return Math.round((usedCount / totalPeriods) * 100);
}

/**
 * Transform BenefitData to the format expected by BenefitsGrid component
 * Strips fields not needed by the grid and ensures type compatibility
 */
function transformBenefitForGrid(benefit: BenefitData): {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'expiring' | 'expired' | 'pending';
  expirationDate?: Date | string;
  value?: number;
  usage?: number;
  type?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  periodStatus?: string | null;
  // Enhanced period UI fields
  resetCadence?: string;
  claimingCadence?: string | null;
  isUsed?: boolean;
  masterBenefitId?: string | null;
} {
  return {
    id: benefit.id,
    name: benefit.name,
    description: benefit.description,
    status: benefit.status,
    expirationDate: benefit.expirationDate || undefined,
    value: benefit.value,
    usage: benefit.usage,
    type: benefit.type,
    // Pass period data through for display in BenefitsGrid
    periodStart: benefit.periodStart,
    periodEnd: benefit.periodEnd,
    periodStatus: benefit.periodStatus,
    // Enhanced period UI fields for banner, stripe, and period-aware actions
    resetCadence: benefit.resetCadence,
    claimingCadence: benefit.claimingCadence ?? null,
    isUsed: benefit.isUsed ?? false,
    masterBenefitId: benefit.masterBenefitId ?? null,
  };
}

/**
 * Transform BenefitData to format expected by EditBenefitModal component
 */
function transformBenefitForModal(benefit: BenefitData | null): {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  expirationDate: Date | string | null;
  masterBenefitId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  isUsed?: boolean;
  claimedAt?: string | null;
} | null {
  if (!benefit) return null;
  return {
    id: benefit.id,
    name: benefit.name,
    type: benefit.type,
    stickerValue: benefit.stickerValue,
    userDeclaredValue: benefit.userDeclaredValue,
    resetCadence: benefit.resetCadence,
    expirationDate: benefit.expirationDate || null,
    masterBenefitId: benefit.masterBenefitId ?? null,
    periodStart: benefit.periodStart ?? null,
    periodEnd: benefit.periodEnd ?? null,
    isUsed: benefit.isUsed ?? false,
    claimedAt: benefit.claimedAt ?? null,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  // ============================================================
  // State Management - Real Data Loading
  // ============================================================

  const [cards, setCards] = useState<CardData[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [userName, setUserName] = useState('User');
  // Benefit engine awareness — toggled by API response
  const [benefitEngineEnabled, setBenefitEngineEnabled] = useState(false);
  // "current" = ACTIVE period benefits, "history" = EXPIRED period benefits
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current');
  // History data loaded from /api/benefits/history
  const [historyBenefits, setHistoryBenefits] = useState<BenefitData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // ============================================================
  // State Management - Benefit Modals
  // ============================================================

  const [benefits, setBenefits] = useState<BenefitData[]>([]);
  const [isAddBenefitOpen, setIsAddBenefitOpen] = useState(false);
  const [isEditBenefitOpen, setIsEditBenefitOpen] = useState(false);
  const [isDeleteBenefitOpen, setIsDeleteBenefitOpen] = useState(false);
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitData | null>(null);

  // ============================================================
  // State Management - Filtering
  // ============================================================

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all-time');
  const [selectedStatuses, setSelectedStatuses] = useState<BenefitStatus[]>([
    'active',
    'expiring_soon',
    'used',
    'expired',
    'pending',
  ]);

  // ============================================================
  // Effect: Load user cards from API (BLOCKER #7 implementation)
  // ============================================================

  // Define retry constants at the top level
  const MAX_RETRIES = 3;

  // ============================================================
  // Filtering Configuration - Period Options
  // ============================================================

  const periodOptions: PeriodOption[] = useMemo(
    () => [
      {
        id: 'all-time',
        label: 'All Time',
        displayLabel: 'All Time',
        getDateRange: () => ({
          start: new Date(1970, 0, 1),
          end: new Date(2099, 11, 31, 23, 59, 59, 999),
        }),
      },
      {
        id: 'full-year',
        label: 'Year',
        displayLabel: `${new Date().getFullYear()}`,
        getDateRange: () => {
          const now = new Date();
          const year = now.getFullYear();
          return {
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31, 23, 59, 59, 999),
          };
        },
      },
      {
        id: 'first-half',
        label: 'Half-year',
        displayLabel: (() => {
          const now = new Date();
          const half = now.getMonth() < 6 ? 'H1' : 'H2';
          return `${half} ${now.getFullYear()}`;
        })(),
        getDateRange: () => {
          const now = new Date();
          const year = now.getFullYear();
          if (now.getMonth() < 6) {
            return {
              start: new Date(year, 0, 1),
              end: new Date(year, 5, 30, 23, 59, 59, 999),
            };
          }
          return {
            start: new Date(year, 6, 1),
            end: new Date(year, 11, 31, 23, 59, 59, 999),
          };
        },
      },
      {
        id: 'this-quarter',
        label: 'Quarter',
        displayLabel: (() => {
          const { quarter, year } = getCurrentQuarterInfo();
          return `Q${quarter} ${year}`;
        })(),
        getDateRange: () => {
          const now = new Date();
          const year = now.getFullYear();
          const quarter = Math.floor(now.getMonth() / 3);
          const quarterStart = quarter * 3;
          return {
            start: new Date(year, quarterStart, 1),
            end: new Date(year, quarterStart + 3, 0, 23, 59, 59, 999),
          };
        },
      },
      {
        id: 'this-month',
        label: 'Month',
        displayLabel: getCurrentMonthDisplay(),
        getDateRange: () => {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();
          return {
            start: new Date(year, month, 1),
            end: new Date(year, month + 1, 0, 23, 59, 59, 999),
          };
        },
      },
    ],
    []
  );

  // ============================================================
  // Filtering Configuration - Status Options
  // ============================================================

  const statusOptions: StatusOption[] = useMemo(
    () => [
      {
        id: 'active',
        label: 'Active',
        icon: <CheckCircle size={16} />,
        description: 'Currently active benefits',
        color: '--color-success',
      },
      {
        id: 'expiring_soon',
        label: 'Expiring Soon',
        icon: <AlertCircle size={16} />,
        description: 'Benefits expiring within 7 days',
        color: '--color-warning',
      },
      {
        id: 'used',
        label: 'Used',
        icon: <CheckCircle2 size={16} />,
        description: 'Benefits already used',
        color: '--color-info',
      },
      {
        id: 'expired',
        label: 'Expired',
        icon: <XCircle size={16} />,
        description: 'Benefits past expiration date',
        color: '--color-border',
      },
      {
        id: 'pending',
        label: 'Pending',
        icon: <Clock size={16} />,
        description: 'Benefits pending review',
        color: '--color-border',
      },
    ],
    []
  );

  // ============================================================
  // Filtering Logic - Apply Period and Status Filters
  // ============================================================

  const filteredBenefits = useMemo(() => {
    if (!benefits) return [];

    return benefits.filter((benefit) => {
      // Check status filter - isUsed takes priority so used benefits
      // appear under "Used" filter even when API status is still "active"
      let benefitStatus: BenefitStatus;
      const apiStatus = benefit.status?.toLowerCase() || 'pending';

      if (benefit.isUsed || apiStatus === 'used') {
        benefitStatus = 'used';
      } else if (apiStatus === 'active') {
        benefitStatus = 'active';
      } else if (apiStatus === 'expiring') {
        benefitStatus = 'expiring_soon';
      } else if (apiStatus === 'expired') {
        benefitStatus = 'expired';
      } else {
        benefitStatus = 'pending';
      }

      // Status filter check
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(benefitStatus)) {
        return false;
      }

      // Period filter check - only if not 'all-time'
      if (selectedPeriodId !== 'all-time') {
        const periodOption = periodOptions.find((p) => p.id === selectedPeriodId);
        if (periodOption) {
          const { start: rangeStart, end: rangeEnd } = periodOption.getDateRange();

          // Use createdDate if available, otherwise expirationDate, otherwise current date
          const benefitDate = benefit.createdDate
            ? new Date(benefit.createdDate)
            : benefit.expirationDate
            ? new Date(benefit.expirationDate)
            : new Date();

          // Check if benefit date falls within the selected period
          if (benefitDate < rangeStart || benefitDate > rangeEnd) {
            return false;
          }
        }
      }

      return true;
    });
  }, [benefits, selectedPeriodId, selectedStatuses, periodOptions]);

  // ============================================================
  // Deduplication — collapse multi-period rows when engine is ON
  // ============================================================

  const deduplicatedBenefits = useMemo(() => {
    return deduplicateBenefits(filteredBenefits, benefitEngineEnabled);
  }, [filteredBenefits, benefitEngineEnabled]);

  const handleRetry = () => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount(retryCount + 1);
    }
  };

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

        // Transform API response to card display format (including benefits)
        const apiResponse = data as ApiCardsResponse;

        // Track whether the benefit engine is active for this response
        setBenefitEngineEnabled(apiResponse.benefitEngineEnabled === true);

        const transformedCards: CardData[] = (apiResponse.cards || []).map((apiCard: ApiCard) => ({
          id: apiCard.id,
          name: apiCard.customName || apiCard.cardName,
          productName: apiCard.cardName,
          type: (apiCard.type || 'visa') as CardData['type'],
          lastFour: apiCard.lastFour || '0000',
          issuer: apiCard.issuer,
          customName: apiCard.customName,
          benefits: (apiCard.benefits || []).map((b: ApiBenefit) => ({
            id: b.id,
            name: b.name,
            type: b.type,
            stickerValue: b.stickerValue,
            userDeclaredValue: b.userDeclaredValue || null,
            resetCadence: b.resetCadence,
            status: b.status?.toLowerCase() === 'active' ? 'active' as const
              : b.status?.toLowerCase() === 'expired' ? 'expired' as const
              : b.status?.toLowerCase() === 'expiring' ? 'expiring' as const
              : 'pending' as const,
            expirationDate: b.expirationDate,
            description: b.description || '',
            value: (b.userDeclaredValue || b.stickerValue) / 100,
            usage: calculateYearlyUsage(b, apiCard.benefits || []),
            isUsed: b.isUsed ?? false,
            // Carry period fields through when present
            periodStart: b.periodStart ?? null,
            periodEnd: b.periodEnd ?? null,
            periodStatus: b.periodStatus ?? null,
            masterBenefitId: b.masterBenefitId ?? null,
            claimingCadence: b.claimingCadence ?? null,
          })),
        }));

        setCards(transformedCards);

        // Set first card as selected and load its benefits
        if (transformedCards.length > 0) {
          setSelectedCardId(transformedCards[0].id);
          setBenefits(transformedCards[0].benefits || []);
        }
        
        // Clear retry count on successful load
        setRetryCount(0);
      } catch (error) {
        console.error('Error loading cards:', error);
        
        // Set error message with retry information
        const remainingRetries = MAX_RETRIES - retryCount;
        if (remainingRetries > 0) {
          setCardsError(`Failed to load your cards. You have ${remainingRetries} attempt${remainingRetries > 1 ? 's' : ''} remaining.`);
        } else {
          setCardsError('Failed to load your cards. Maximum retry attempts reached. Please refresh the page.');
        }
        
        // Fallback to empty state
        setCards([]);
      } finally {
        setIsLoadingCards(false);
      }
    };

    loadUserCards();
  }, [retryCount]);

  // ============================================================
  // Effect: Load user profile for personalized greeting
  // ============================================================

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const response = await fetch('/api/user/profile', {
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
  // Effect: Update benefits when selected card changes
  // ============================================================

  useEffect(() => {
    if (selectedCardId && cards.length > 0) {
      const selectedCard = cards.find((c) => c.id === selectedCardId);
      if (selectedCard?.benefits) {
        setBenefits(selectedCard.benefits);
      } else {
        setBenefits([]);
      }
    }
  }, [selectedCardId, cards]);

  // ============================================================
  // Effect: Load history benefits when viewMode switches to "history"
  // ============================================================

  useEffect(() => {
    if (viewMode !== 'history' || !benefitEngineEnabled) return;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (selectedCardId) {
          params.set('cardId', selectedCardId);
        }
        const response = await fetch(`/api/benefits/history?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to load history');
        const data = await response.json();
        if (data.success && Array.isArray(data.benefits)) {
          const mapped: BenefitData[] = data.benefits.map((b: {
            id: string;
            name: string;
            type: string;
            stickerValue: number;
            userDeclaredValue: number | null;
            resetCadence: string;
            isUsed: boolean;
            periodStart: string | null;
            periodEnd: string | null;
            periodStatus: string;
            masterBenefitId: string | null;
            claimingCadence: string | null;
          }) => ({
            id: b.id,
            name: b.name,
            type: b.type,
            stickerValue: b.stickerValue,
            userDeclaredValue: b.userDeclaredValue,
            resetCadence: b.resetCadence,
            status: 'expired' as const,
            isUsed: b.isUsed,
            value: (b.userDeclaredValue || b.stickerValue) / 100,
            usage: b.isUsed ? 100 : 0,
            periodStart: b.periodStart,
            periodEnd: b.periodEnd,
            periodStatus: b.periodStatus,
            masterBenefitId: b.masterBenefitId,
            claimingCadence: b.claimingCadence,
          }));
          setHistoryBenefits(mapped);
        }
      } catch (error) {
        console.error('Error loading benefit history:', error);
        setHistoryBenefits([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [viewMode, benefitEngineEnabled, selectedCardId]);

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
          const apiResponse = data as ApiCardsResponse;
          setBenefitEngineEnabled(apiResponse.benefitEngineEnabled === true);

          const transformedCards: CardData[] = (apiResponse.cards || []).map((apiCard: ApiCard) => ({
            id: apiCard.id,
            name: apiCard.customName || apiCard.cardName,
            productName: apiCard.cardName,
            type: (apiCard.type || 'visa') as CardData['type'],
            lastFour: apiCard.lastFour || '0000',
            issuer: apiCard.issuer,
            customName: apiCard.customName,
            benefits: (apiCard.benefits || []).map((b: ApiBenefit) => ({
              id: b.id,
              name: b.name,
              type: b.type,
              stickerValue: b.stickerValue,
              userDeclaredValue: b.userDeclaredValue || null,
              resetCadence: b.resetCadence,
              status: b.status?.toLowerCase() === 'active' ? 'active' as const
                : b.status?.toLowerCase() === 'expired' ? 'expired' as const
                : b.status?.toLowerCase() === 'expiring' ? 'expiring' as const
                : 'pending' as const,
              expirationDate: b.expirationDate,
              description: b.description || '',
              value: (b.userDeclaredValue || b.stickerValue) / 100,
              usage: calculateYearlyUsage(b, apiCard.benefits || []),
              isUsed: b.isUsed ?? false,
              periodStart: b.periodStart ?? null,
              periodEnd: b.periodEnd ?? null,
              periodStatus: b.periodStatus ?? null,
              masterBenefitId: b.masterBenefitId ?? null,
              claimingCadence: b.claimingCadence ?? null,
            })),
          }));

          setCards(transformedCards);

          // Select the newly added card and load its benefits
          if (transformedCards.length > 0) {
            const newCard = transformedCards[transformedCards.length - 1];
            setSelectedCardId(newCard.id);
            setBenefits(newCard.benefits || []);
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
  // Handler: Mark Benefit as Used - Calls toggle-used API
  // Wave 2: One-click benefit marking
  // ============================================================

  const handleMarkUsed = async (benefitId: string) => {
    try {
      // Optimistic UI update - mark the benefit as used immediately
      // Use functional updater to avoid stale closure over `benefits`
      setBenefits(prev =>
        prev.map((b) =>
          b.id === benefitId
            ? { ...b, isUsed: true }
            : b
        )
      );

      // Call the toggle-used API endpoint
      const response = await fetch(`/api/benefits/${benefitId}/toggle-used`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isUsed: true }),
      });

      if (!response.ok) {
        // Revert optimistic update on error
        setBenefits(prev =>
          prev.map((b) =>
            b.id === benefitId
              ? { ...b, isUsed: false }
              : b
          )
        );

        const errorData = await response.json();
        console.error('Failed to mark benefit as used:', errorData);
        toast({ title: errorData.error || 'Failed to mark benefit as used', variant: 'error' });
        return;
      }

      // Success - benefit marked as used
      const data = await response.json();
      if (data.success) {
        // Update benefit with response data (includes updated timesUsed)
        setBenefits(prev =>
          prev.map((b) =>
            b.id === benefitId
              ? {
                  ...b,
                  isUsed: data.benefit.isUsed,
                  // Note: timesUsed is not in our mock BenefitData, but will be in real API
                }
              : b
          )
        );
        // Show success toast
        toast({ title: 'Benefit marked as used!', variant: 'success' });
      }
    } catch (error) {
      console.error('Error marking benefit as used:', error);
      // Revert optimistic update
      setBenefits(prev =>
        prev.map((b) =>
          b.id === benefitId
            ? { ...b, isUsed: false }
            : b
        )
      );
      toast({ title: 'Failed to mark benefit as used. Please try again.', variant: 'error' });
    }
  };

  // ============================================================
  // Handler: Benefit Updated - Updates benefits array after modal success
  // Called by EditBenefitModal onBenefitUpdated callback
  // ============================================================

  const handleBenefitUpdated = (updatedFields: Partial<BenefitData> & { id: string }) => {
    setBenefits(prev => prev.map((b) => (b.id === updatedFields.id ? { ...b, ...updatedFields } : b)));
    setIsEditBenefitOpen(false);
    setSelectedBenefit(null);
  };

  // ============================================================
  // Handler: Benefit Added - Adds new benefit to array after modal success
  // Called by AddBenefitModal onBenefitAdded callback
  // ============================================================

  const handleBenefitAdded = (newBenefit: BenefitData) => {
    setBenefits(prev => [...prev, newBenefit]);
    setIsAddBenefitOpen(false);
  };

  // ============================================================
  // Handler: Benefit Deleted - Removes benefit from array after confirmation
  // Called by DeleteBenefitConfirmationDialog onConfirm callback
  // ============================================================

  const handleBenefitDeleted = () => {
    if (selectedBenefit) {
      setBenefits(prev => prev.filter((b) => b.id !== selectedBenefit.id));
    }
    setIsDeleteBenefitOpen(false);
    setSelectedBenefit(null);
  };

  // ============================================================
  // Handler: Benefit Deleted from Edit Modal
  // Called by EditBenefitModal onBenefitDeleted callback
  // ============================================================

  const handleBenefitDeletedFromModal = (benefitId: string) => {
    setBenefits(prev => prev.filter((b) => b.id !== benefitId));
    setIsEditBenefitOpen(false);
    setSelectedBenefit(null);
  };

  // ============================================================
  // Determine which benefits to display based on viewMode
  // ============================================================

  const displayBenefits = viewMode === 'history' ? historyBenefits : deduplicatedBenefits;

  // ============================================================
  // Total benefits across ALL cards (not just selected card)
  // ============================================================

  const totalBenefitsAcrossCards = useMemo(() => {
    return cards.reduce((sum, card) =>
      sum + deduplicateBenefits(card.benefits || [], benefitEngineEnabled).length, 0);
  }, [cards, benefitEngineEnabled]);

  // ============================================================
  // Summary Statistics - Computed from filtered benefit data
  // When benefit engine is on and viewMode is "current", these
  // already only include ACTIVE-period benefits (filtered at API level).
  // ============================================================

  const summaryStats = [
    {
      label: viewMode === 'history' ? 'Past Benefits' : 'Total Benefits',
      value: displayBenefits.length,
      icon: 'CreditCard',
      variant: 'default' as const,
    },
    {
      label: viewMode === 'history' ? 'Past Value' : 'Total Value',
      value: `$${displayBenefits.reduce((sum, b) => sum + (b.value || 0), 0).toLocaleString()}`,
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
      label: viewMode === 'history' ? 'Used' : 'Expiring Soon',
      value: viewMode === 'history'
        ? displayBenefits.filter((b) => b.isUsed).length
        : displayBenefits.filter((b) => b.status === 'expiring').length,
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
        <AppHeader />

        {/* Loading Content */}
        <main className="flex-1 px-4 md:px-8 py-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Loading Header Skeleton */}
            <div className="space-y-2">
              <div className="h-8 w-48 bg-[var(--color-border)] rounded animate-pulse" />
              <div className="h-4 w-72 bg-[var(--color-border)] rounded animate-pulse" />
            </div>

            {/* Loading Card Switcher Skeleton */}
            <div className="flex gap-4">
              <div className="h-10 w-32 bg-[var(--color-border)] rounded animate-pulse" />
              <div className="h-10 w-32 bg-[var(--color-border)] rounded animate-pulse" />
              <div className="h-10 w-32 bg-[var(--color-border)] rounded animate-pulse" />
            </div>

            {/* Loading Dashboard Summary Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SkeletonCard rows={2} showImage={false} />
              <SkeletonCard rows={2} showImage={false} />
              <SkeletonCard rows={2} showImage={false} />
            </div>

            {/* Loading Benefits Grid Skeleton */}
            <div className="space-y-4">
              <div className="h-6 w-56 bg-[var(--color-border)] rounded animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SkeletonCard rows={4} showImage={true} />
                <SkeletonCard rows={4} showImage={true} />
                <SkeletonCard rows={4} showImage={true} />
              </div>
            </div>
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
        <AppHeader />

        {/* Error Content */}
        <main className="flex-1 px-4 md:px-8 py-8 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div
              className="p-4 rounded-lg mb-6"
              style={{
                backgroundColor: 'var(--color-error-light)',
              }}
            >
              <p className="text-[var(--color-error)] font-medium">{cardsError}</p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Retry Button - Disabled after MAX_RETRIES */}
              <Button
                variant="primary"
                onClick={handleRetry}
                disabled={retryCount >= MAX_RETRIES}
                className={`mx-auto ${retryCount >= MAX_RETRIES ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {retryCount >= MAX_RETRIES ? 'Max Retries Reached' : 'Retry Loading Cards'}
              </Button>

              {/* Refresh Button - Always available as fallback */}
              <Button
                variant="outline"
                onClick={() => router.refresh()}
                className="mx-auto"
              >
                Reload Dashboard
              </Button>
            </div>
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
      <AppHeader />

      {/* Welcome section below header */}
      <div
        className="border-b"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2
                className="font-semibold text-[var(--color-text)]"
                style={{ fontSize: 'var(--text-h4)' }}
              >
                Welcome, {userName}! 👋
              </h2>
              <p className="text-sm mt-1 text-[var(--color-text-secondary)]">
                You have {cards.length} card{cards.length !== 1 ? 's' : ''} and {totalBenefitsAcrossCards} benefits tracked
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
      </div>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-8 py-6">
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
              {/* Sticky Card Switcher — stays visible while scrolling, below AppHeader (64px = top-16) */}
              <div
                className="sticky top-16 z-20 -mx-4 px-4 py-2"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <CardSwitcher
                  cards={cards}
                  selectedCardId={selectedCardId}
                  onSelectCard={setSelectedCardId}
                />
              </div>

              {/* Unified Filter Bar — replaces Period / Status / ViewMode rows */}
              <div className="mt-4 mb-4">
                <UnifiedFilterBar
                  selectedPeriodId={selectedPeriodId}
                  onPeriodChange={setSelectedPeriodId}
                  periods={periodOptions}
                  selectedStatuses={selectedStatuses}
                  onStatusChange={(statuses) => setSelectedStatuses(statuses as BenefitStatus[])}
                  availableStatuses={statusOptions}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  benefitEngineEnabled={benefitEngineEnabled}
                  filteredCount={deduplicatedBenefits.length}
                  totalCount={deduplicateBenefits(benefits, benefitEngineEnabled).length}
                />
              </div>

              {/* Mobile Summary Stats — compact horizontal pills, hidden on md+ */}
              <div className="md:hidden mt-3 mb-4">
                <MobileSummaryStats
                  totalBenefits={displayBenefits.length}
                  usedBenefits={displayBenefits.filter((b) => b.isUsed).length}
                  unusedBenefits={displayBenefits.filter((b) => !b.isUsed).length}
                />
              </div>

              {/* Desktop Dashboard Summary — hidden on mobile */}
              <div className="hidden md:block">
                <DashboardSummary stats={summaryStats} />
              </div>

              {/* Benefits Section */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3
                    className="text-lg font-semibold text-[var(--color-text)]"
                    style={{ fontSize: 'var(--text-h4)' }}
                  >
                    {viewMode === 'history' ? 'Past ' : ''}Benefits on {cards.find((c) => c.id === selectedCardId)?.name || 'Selected Card'}
                    {viewMode === 'current' && deduplicatedBenefits.length !== benefits.length && (
                      <span
                        className="ml-2 text-sm font-normal"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        ({deduplicatedBenefits.length} of {deduplicateBenefits(benefits, benefitEngineEnabled).length})
                      </span>
                    )}
                    {viewMode === 'history' && (
                      <span
                        className="ml-2 text-sm font-normal"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        ({displayBenefits.length})
                      </span>
                    )}
                  </h3>
                  {viewMode === 'current' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAddBenefitOpen(true)}
                    >
                      + Add Benefit
                    </Button>
                  )}
                </div>

                {/* Loading state for history */}
                {viewMode === 'history' && isLoadingHistory && (
                  <div className="flex justify-center py-12">
                    <div
                      className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
                      style={{ borderColor: 'var(--color-border)', borderTopColor: 'transparent' }}
                    />
                  </div>
                )}

                {/* Empty State for Current Filtered Results */}
                {viewMode === 'current' && deduplicatedBenefits.length === 0 && benefits.length > 0 && (
                  <div
                    className="text-center py-12 rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <p className="text-sm">
                      No benefits match the selected period and status filters.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedPeriodId('all-time');
                        setSelectedStatuses(
                          statusOptions.map((s) => s.id)
                        );
                      }}
                      className="text-sm underline mt-2 transition-colors text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {/* Empty State for History */}
                {viewMode === 'history' && !isLoadingHistory && historyBenefits.length === 0 && (
                  <div
                    className="text-center py-12 rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <p className="text-sm">
                      No previous period benefits found for this card.
                    </p>
                  </div>
                )}

                {/* Benefits Grid — uses displayBenefits (current or history) */}
                {displayBenefits.length > 0 && !(viewMode === 'history' && isLoadingHistory) && (
                  <BenefitsGrid
                    benefits={displayBenefits.map(transformBenefitForGrid)}
                    onEdit={viewMode === 'current' ? handleEditBenefitClick : undefined}
                    onMarkUsed={viewMode === 'current' ? handleMarkUsed : undefined}
                    gridColumns={3}
                  />
                )}
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
          <p>&copy; {new Date().getFullYear()} CardTrack. Track your benefits with confidence.</p>
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
        benefit={transformBenefitForModal(selectedBenefit)}
        isOpen={isEditBenefitOpen}
        onClose={() => {
          setIsEditBenefitOpen(false);
          setSelectedBenefit(null);
        }}
        onBenefitUpdated={handleBenefitUpdated}
        onBenefitDeleted={handleBenefitDeletedFromModal}
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
