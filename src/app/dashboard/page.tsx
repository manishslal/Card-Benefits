'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/shared/components/ui/use-toast';
import Button from '@/shared/components/ui/button';
import { AppHeader } from '@/shared/components/layout';
import { CardCarousel, DashboardSummary } from '@/shared/components/features';
import CompactCardChips from '@/shared/components/features/CompactCardChips';
import { BenefitsGrid, AddBenefitModal, EditBenefitModal, DeleteBenefitConfirmationDialog } from '@/features/benefits';
import { AddCardModal } from '@/features/cards/components/modals/AddCardModal';
import { CardEditModal } from '@/features/cards/components/MyCardsSection/CardEditModal';
import type { Card as EditableCard } from '@/features/cards/components/MyCardsSection/types';
import { deduplicateBenefits } from '@/lib/benefit-utils';
import { formatCurrency } from '@/shared/lib/format-currency';
import { Plus, CreditCard, AlertCircle, Sparkles } from 'lucide-react';
import { SkeletonCard } from '@/shared/components/loaders';
import { type PeriodOption } from './new/components/PeriodSelector';

import { UnifiedFilterBar } from './new/components/UnifiedFilterBar';
import { MobileSummaryStats } from './new/components/MobileSummaryStats';
import { SearchSortBar } from './new/components/SearchSortBar';
import type { SortKey } from './new/components/SearchSortBar';
import { SmartViewChips } from './new/components/SmartViewChips';
import type { SmartViewKey } from './new/components/SmartViewChips';
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
  lastFour?: string;
  issuer: string;
  customName?: string | null;
  actualAnnualFee?: number | null;
  renewalDate?: string | null;
  createdAt?: string;
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
  usage?: number | null;
  isUsed?: boolean;
  createdDate?: Date | string;
  // Period-based fields (benefit engine)
  periodStart?: string | null;
  periodEnd?: string | null;
  periodStatus?: string | null;
  masterBenefitId?: string | null;
  claimingCadence?: string | null;
  claimedAt?: string | null;
  claimingAmount?: number | null;
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
  actualAnnualFee?: number | null;
  renewalDate?: string;
  createdAt?: string;
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
  claimingAmount?: number | null;
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
  // DISC-011: API-provided summary for consistent totals across paginated results
  summary?: {
    totalCards: number;
    totalBenefits: number;
    totalAnnualFees?: number;
  };
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
): number | null {
  // Unlimited/multiplier benefits (stickerValue=0, no user override) don't track percentage usage
  const effectiveValue = benefit.userDeclaredValue ?? benefit.stickerValue;
  if (effectiveValue === 0) {
    return null;
  }

  const cadence = (benefit.claimingCadence || benefit.resetCadence || '').toUpperCase();

  if (cadence === 'ANNUAL' || cadence === 'ONE_TIME' || cadence === 'CALENDARYEAR' || cadence === 'CARDMEMBERYEAR' || cadence === 'FLEXIBLE_ANNUAL') {
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
 * Recalculate sibling usage (progress ring %) for all benefits sharing the same
 * masterBenefitId after an isUsed toggle. Falls back to per-benefit usage when
 * no masterId is present.
 *
 * C-6: Extracted from 6 duplicated inline blocks across optimistic / revert /
 * success / undo handlers.
 */
function recalcSiblingUsage(
  updated: BenefitData[],
  masterId: string | null | undefined,
  targetId: string,
): BenefitData[] {
  if (masterId) {
    return updated.map(b => {
      if (b.masterBenefitId === masterId) {
        // Preserve null for unlimited/multiplier benefits
        if (b.usage === null) return { ...b, usage: null };
        const cadence = (b.claimingCadence || b.resetCadence || '').toUpperCase();
        const totalPeriods = cadence === 'MONTHLY' ? 12
          : cadence === 'QUARTERLY' ? 4
          : cadence === 'SEMI_ANNUAL' ? 2
          : 1;
        const periodStart = b.periodStart;
        const currentYear = periodStart
          ? new Date(periodStart).getUTCFullYear()
          : new Date().getFullYear();
        const siblings = updated.filter(s =>
          s.masterBenefitId === masterId &&
          s.periodStart &&
          new Date(s.periodStart).getUTCFullYear() === currentYear
        );
        const usedCount = siblings.filter(s => s.isUsed).length;
        const usage = (cadence === 'ANNUAL' || cadence === 'ONE_TIME' || cadence === 'CALENDARYEAR' || cadence === 'CARDMEMBERYEAR' || cadence === 'FLEXIBLE_ANNUAL')
          ? (b.isUsed ? 100 : 0)
          : Math.round((usedCount / totalPeriods) * 100);
        return { ...b, usage };
      }
      return b;
    });
  }
  // Single benefit (no masterBenefitId) — set usage directly, preserving null
  return updated.map(b =>
    b.id === targetId ? { ...b, usage: b.usage === null ? null : (b.isUsed ? 100 : 0) } : b
  );
}

/**
 * Compute the per-period display value for a benefit card.
 * Returns value in DOLLARS (divided by 100).
 *
 * UserBenefit.stickerValue is set by the benefit engine to the per-period
 * claiming amount (including variable overrides, e.g. Uber December $35).
 * For non-engine benefits it holds the total value. In both cases it is the
 * correct amount to show on the individual benefit card.
 *
 * Pro-rata (remaining annual value) is intentionally NOT applied here —
 * it belongs in annual-summary / fee-offset calculations, not per-card display.
 */
function getDisplayValue(benefit: {
  stickerValue: number;
  userDeclaredValue?: number | null;
}): number {
  return (benefit.userDeclaredValue ?? benefit.stickerValue) / 100;
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
  usage?: number | null;
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
  // DISC-011: API-provided summary for accurate totals (avoids pagination mismatch)
  const [apiTotalCards, setApiTotalCards] = useState<number | null>(null);
  const [apiTotalBenefits, setApiTotalBenefits] = useState<number | null>(null);
  const [apiTotalFees, setApiTotalFees] = useState<number>(0);
  // "current" = ACTIVE period benefits, "history" = EXPIRED period benefits
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current');
  // History data loaded from /api/benefits/history
  const [historyBenefits, setHistoryBenefits] = useState<BenefitData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // ============================================================
  // State Management - Benefit Modals
  // ============================================================

  const [benefits, setBenefits] = useState<BenefitData[]>([]);
  // DISC-001: Track previous card to distinguish card-switch from benefit-mutation
  const prevSelectedCardIdRef = useRef(selectedCardId);
  const [isAddBenefitOpen, setIsAddBenefitOpen] = useState(false);
  const [isEditBenefitOpen, setIsEditBenefitOpen] = useState(false);
  const [isDeleteBenefitOpen, setIsDeleteBenefitOpen] = useState(false);
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitData | null>(null);
  // Sprint 25: Card edit modal on dashboard
  const [editingCard, setEditingCard] = useState<string | null>(null);

  // Sprint 27: Carousel collapse on scroll
  const carouselSentinelRef = useRef<HTMLDivElement>(null);
  const [isCarouselCollapsed, setIsCarouselCollapsed] = useState(false);

  // ============================================================
  // State Management - Filtering
  // ============================================================

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all-time');
  // ============================================================
  // State Management - Search, Sort, Smart Views (Sprint 8)
  // ============================================================

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState<SortKey>('default');
  const [smartView, setSmartView] = useState<SmartViewKey>('all');
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(new Set());

  // ============================================================
  // DISC-008: Shared card transformation to prevent copy-paste divergence
  // ============================================================

  const transformApiCards = (apiResponse: ApiCardsResponse): CardData[] => {
    setBenefitEngineEnabled(apiResponse.benefitEngineEnabled === true);

    return (apiResponse.cards || []).map((apiCard: ApiCard) => ({
      id: apiCard.id,
      name: apiCard.customName || apiCard.cardName,
      productName: apiCard.cardName,
      type: (apiCard.type || 'visa') as CardData['type'],
      lastFour: apiCard.lastFour || undefined,
      issuer: apiCard.issuer,
      customName: apiCard.customName,
      actualAnnualFee: apiCard.actualAnnualFee ?? null,
      renewalDate: apiCard.renewalDate ?? null,
      createdAt: apiCard.createdAt,
      benefits: (apiCard.benefits || []).map((b: ApiBenefit) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        stickerValue: b.stickerValue,
        userDeclaredValue: b.userDeclaredValue ?? null,
        resetCadence: b.resetCadence,
        status: b.status?.toLowerCase() === 'active' ? 'active' as const
          : b.status?.toLowerCase() === 'expired' ? 'expired' as const
          : b.status?.toLowerCase() === 'expiring' ? 'expiring' as const
          : 'pending' as const,
        expirationDate: b.expirationDate,
        description: b.description || '',
        value: getDisplayValue(b),
        usage: calculateYearlyUsage(b, apiCard.benefits || []),
        isUsed: b.isUsed ?? false,
        periodStart: b.periodStart ?? null,
        periodEnd: b.periodEnd ?? null,
        periodStatus: b.periodStatus ?? null,
        masterBenefitId: b.masterBenefitId ?? null,
        claimingCadence: b.claimingCadence ?? null,
        claimedAt: b.claimedAt ?? null,
        claimingAmount: b.claimingAmount ?? null,
      })),
    }));
  };

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
  // Filtering Logic - Apply Period Filter
  // ============================================================

  const filteredBenefits = useMemo(() => {
    if (!benefits) return [];

    return benefits.filter((benefit) => {
      // Period filter check - only if not 'all-time'
      if (selectedPeriodId !== 'all-time') {
        const periodOption = periodOptions.find((p) => p.id === selectedPeriodId);
        if (periodOption) {
          const { start: rangeStart, end: rangeEnd } = periodOption.getDateRange();

          // C-1: When engine is ON and period fields exist, use overlap checking
          if (benefitEngineEnabled && benefit.periodStart && benefit.periodEnd) {
            const pStart = new Date(benefit.periodStart);
            const pEnd = new Date(benefit.periodEnd);
            // Period overlaps filter range if NOT (pEnd < rangeStart || pStart > rangeEnd)
            if (pEnd < rangeStart || pStart > rangeEnd) {
              return false;
            }
          } else {
            // Legacy fallback: use createdDate for engine OFF or missing period fields
            const benefitDate = benefit.createdDate
              ? new Date(benefit.createdDate)
              : benefit.expirationDate
              ? new Date(benefit.expirationDate)
              : new Date();

            if (benefitDate < rangeStart || benefitDate > rangeEnd) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [benefits, selectedPeriodId, periodOptions, benefitEngineEnabled]);

  // ============================================================
  // Deduplication — collapse multi-period rows when engine is ON
  // ============================================================

  const deduplicatedBenefits = useMemo(() => {
    return deduplicateBenefits(filteredBenefits, benefitEngineEnabled);
  }, [filteredBenefits, benefitEngineEnabled]);

  // ============================================================
  // Search + Sort + Smart View — applied on top of deduplication
  // ============================================================

  const searchSortedBenefits = useMemo(() => {
    let result = [...deduplicatedBenefits];

    // 1. Search filter — case-insensitive name match
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(q));
    }

    // 2. Smart view filter
    if (smartView === 'expiring-soon') {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      result = result.filter((b) => {
        if (!b.periodEnd) return false;
        const end = new Date(b.periodEnd);
        return end >= now && end <= sevenDaysFromNow;
      });
    } else if (smartView === 'highest-value') {
      // Sort by value desc; show top items or all above average
      result.sort((a, b) => (b.value || 0) - (a.value || 0));
      if (result.length > 5) {
        const avg = result.reduce((sum, b) => sum + (b.value || 0), 0) / result.length;
        const aboveAvg = result.filter((b) => (b.value || 0) > avg);
        result = aboveAvg.length >= 5 ? aboveAvg : result.slice(0, 5);
      }
    } else if (smartView === 'unused') {
      result = result.filter((b) => !b.isUsed);
    }

    // 3. Sort
    if (activeSort === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (activeSort === 'value') {
      result.sort((a, b) => (b.value || 0) - (a.value || 0));
    } else if (activeSort === 'expiry') {
      result.sort((a, b) => {
        const aEnd = a.periodEnd ? new Date(a.periodEnd).getTime() : Infinity;
        const bEnd = b.periodEnd ? new Date(b.periodEnd).getTime() : Infinity;
        return aEnd - bEnd;
      });
    } else if (activeSort === 'usage') {
      result.sort((a, b) => (b.usage || 0) - (a.usage || 0));
    }

    return result;
  }, [deduplicatedBenefits, searchQuery, activeSort, smartView]);

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
        // DISC-008: Use shared transformApiCards (also sets benefitEngineEnabled)
        const apiResponse = data as ApiCardsResponse;
        const transformedCards = transformApiCards(apiResponse);

        // DISC-011: Store API summary for consistent header display
        if (apiResponse.summary) {
          setApiTotalCards(apiResponse.summary.totalCards);
          setApiTotalBenefits(apiResponse.summary.totalBenefits);
          setApiTotalFees(apiResponse.summary.totalAnnualFees ?? 0);
        }

        setCards(transformedCards);

        // Set first card as selected and load its benefits
        if (transformedCards.length > 0) {
          setSelectedCardId(transformedCards[0].id);
          setBenefits(() => transformedCards[0].benefits || []);
        }
        
        // Clear retry count on successful load
        setRetryCount(0);
      } catch {
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
      } catch {
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
        setBenefits(() => selectedCard.benefits ?? []);
      } else {
        setBenefits(() => []);
      }
    }
  }, [selectedCardId, cards]);

  // DISC-001: Sync benefits back to cards state to prevent stale data on card switch
  useEffect(() => {
    // Only sync when benefits were mutated, not when we just switched cards
    if (selectedCardId !== prevSelectedCardIdRef.current) {
      prevSelectedCardIdRef.current = selectedCardId;
      return;
    }
    if (selectedCardId) {
      setCards(prev => prev.map(card =>
        card.id === selectedCardId
          ? { ...card, benefits }
          : card
      ));
    }
  }, [benefits, selectedCardId]);

  // DISC-007: Reset search/sort/smart view filters on card switch
  useEffect(() => {
    setSearchQuery('');
    setActiveSort('default');
    setSmartView('all');
  }, [selectedCardId]);

  // Sprint 27: IntersectionObserver for carousel collapse on scroll
  // BUG FIX: The sentinel <div> is conditionally rendered (only when cards.length > 0).
  // On mount, `isLoadingCards` is true → early return renders a loading skeleton →
  // sentinel ref is null. With `[]` deps the effect never re-ran after cards loaded.
  // Fix: depend on `cards.length > 0` so the observer attaches once the sentinel exists.
  const hasCards = cards.length > 0;
  useEffect(() => {
    const sentinel = carouselSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCarouselCollapsed(!entry.isIntersecting);
      },
      {
        rootMargin: '-52px 0px 0px 0px',
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasCards]);

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
            claimedAt?: string | null;
            claimingAmount?: number | null;
          }) => ({
            id: b.id,
            name: b.name,
            type: b.type,
            stickerValue: b.stickerValue,
            userDeclaredValue: b.userDeclaredValue,
            resetCadence: b.resetCadence,
            status: 'expired' as const,
            isUsed: b.isUsed,
            value: getDisplayValue(b),
            usage: (() => {
              // H-1 fix: Preserve null for unlimited/multiplier benefits
              const effectiveValue = b.userDeclaredValue ?? b.stickerValue;
              if (effectiveValue === 0) return null;
              return b.isUsed ? 100 : 0;
            })(),
            periodStart: b.periodStart,
            periodEnd: b.periodEnd,
            periodStatus: b.periodStatus,
            masterBenefitId: b.masterBenefitId,
            claimingCadence: b.claimingCadence,
            claimedAt: b.claimedAt ?? null,
            claimingAmount: b.claimingAmount ?? null,
          }));
          setHistoryBenefits(mapped);
        }
      } catch {
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
          // DISC-008: Use shared transformApiCards (also sets benefitEngineEnabled)
          const apiResponse = data as ApiCardsResponse;
          const transformedCards = transformApiCards(apiResponse);

          // DISC-011: Update API summary after card added
          if (apiResponse.summary) {
            setApiTotalCards(apiResponse.summary.totalCards);
            setApiTotalBenefits(apiResponse.summary.totalBenefits);
            setApiTotalFees(apiResponse.summary.totalAnnualFees ?? 0);
          }

          setCards(transformedCards);
          if (transformedCards.length > 0) {
            const newCard = transformedCards[0];
            setSelectedCardId(newCard.id);
            setBenefits(() => newCard.benefits || []);
          }
        }
      }
    } catch {
    }
  };

  // ============================================================
  // Handler: Edit Card — refresh cards after CardEditModal save
  // Sprint 25: Defense-in-depth — keeps dashboard in sync
  // ============================================================

  const toEditableCard = (cd: CardData): EditableCard => ({
    id: cd.id,
    userId: '',
    name: cd.name,
    lastFourDigits: cd.lastFour || '****',
    cardNetwork: (cd.issuer === 'Amex' ? 'Amex'
      : cd.issuer === 'Mastercard' ? 'Mastercard'
      : cd.issuer === 'Discover' ? 'Discover'
      : 'Visa') as EditableCard['cardNetwork'],
    cardType: 'Credit',
    isActive: true,
    createdAt: cd.createdAt || new Date().toISOString(),
    actualAnnualFee: cd.actualAnnualFee ?? null,
    renewalDate: cd.renewalDate ?? null,
  });

  const editableCardForModal = useMemo(() => {
    if (!editingCard) return null;
    const found = cards.find((c) => c.id === editingCard);
    return found ? toEditableCard(found) : null;
  }, [editingCard, cards]);

  const handleCardEdited = async () => {
    setEditingCard(null);
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
          const transformedCards = transformApiCards(apiResponse);

          if (apiResponse.summary) {
            setApiTotalCards(apiResponse.summary.totalCards);
            setApiTotalBenefits(apiResponse.summary.totalBenefits);
            setApiTotalFees(apiResponse.summary.totalAnnualFees ?? 0);
          }

          setCards(transformedCards);
          // Re-sync benefits for the currently-selected card
          const current = transformedCards.find((c) => c.id === selectedCardId);
          if (current) {
            setBenefits(() => current.benefits || []);
          }
        }
      }
    } catch (err) {
      toast({ title: 'Card saved, but refresh failed. Reload to see changes.', variant: 'error' });
      console.warn('Card saved but failed to refresh dashboard data:', err);
    }
  };

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
    // Snapshot original values so error revert paths can fully undo the optimistic update
    const originalBenefit = benefits.find(b => b.id === benefitId);
    const originalClaimedAt = originalBenefit?.claimedAt ?? null;
    const originalValue = originalBenefit?.value;

    try {
      // Optimistic UI update - mark the benefit as used immediately
      // Use functional updater to avoid stale closure over `benefits`
      // Also recalculate sibling usage so ProgressRing updates instantly
      setBenefits(prev => {
        const updated = prev.map((b) =>
          b.id === benefitId
            ? (() => {
                const optimistic = { ...b, isUsed: true, claimedAt: b.claimedAt ?? new Date().toISOString() };
                return { ...optimistic, value: getDisplayValue(optimistic) };
              })()
            : b
        );
        const target = updated.find(b => b.id === benefitId);
        return recalcSiblingUsage(updated, target?.masterBenefitId, benefitId);
      });

      // Call the toggle-used API endpoint
      const response = await fetch(`/api/benefits/${benefitId}/toggle-used`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isUsed: true }),
      });

      if (!response.ok) {
        // Revert optimistic update on error — recalculate sibling usage
        setBenefits(prev => {
          const updated = prev.map((b) =>
            b.id === benefitId
              ? { ...b, isUsed: false, claimedAt: originalClaimedAt, value: originalValue }
              : b
          );
          const target = updated.find(b => b.id === benefitId);
          return recalcSiblingUsage(updated, target?.masterBenefitId, benefitId);
        });

        const errorData = await response.json();
        toast({ title: errorData.error || 'Failed to mark benefit as used', variant: 'error' });
        return;
      }

      // Success - benefit marked as used
      const data = await response.json();
      if (data.success) {
        // Update benefit with response data (includes updated timesUsed)
        setBenefits(prev => {
          const updated = prev.map((b) =>
            b.id === benefitId
              ? (() => {
                  const updatedClaimedAt = data.benefit.claimedAt ?? b.claimedAt ?? null;
                  const updated = {
                    ...b,
                    isUsed: data.benefit.isUsed,
                    claimedAt: updatedClaimedAt,
                    claimingAmount: data.benefit.claimingAmount ?? b.claimingAmount,
                    claimingCadence: data.benefit.claimingCadence ?? b.claimingCadence,
                    stickerValue: data.benefit.stickerValue ?? b.stickerValue,
                  };
                  return {
                    ...updated,
                    value: getDisplayValue(updated),
                  };
                })()
              : b
          );
          // Recalculate usage for sibling benefits sharing same masterBenefitId
          const changedBenefit = updated.find(b => b.id === benefitId);
          return recalcSiblingUsage(updated, changedBenefit?.masterBenefitId, benefitId);
        });
        // Trigger celebration animation
        setCelebratingIds(prev => new Set(prev).add(benefitId));
        setTimeout(() => setCelebratingIds(prev => {
          const next = new Set(prev);
          next.delete(benefitId);
          return next;
        }), 500);
        // Show success toast with Undo action
        toast({
          title: 'Benefit marked as used',
          variant: 'success',
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                const undoResponse = await fetch(`/api/benefits/${benefitId}/toggle-used`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ isUsed: false }),
                });

                if (undoResponse.ok) {
                  const undoData = await undoResponse.json();
                  setBenefits(prev => {
                    const updated = prev.map((b) =>
                      b.id === benefitId
                        ? (() => {
                            const updatedClaimedAt = undoData.benefit.claimedAt ?? b.claimedAt ?? null;
                            const updated = {
                              ...b,
                              ...undoData.benefit,
                              isUsed: false,
                              claimedAt: updatedClaimedAt,
                            };
                            return {
                              ...updated,
                              value: getDisplayValue(updated),
                            };
                          })()
                        : b
                    );
                    // Recalculate usage for sibling benefits
                    const changedBenefit = updated.find(b => b.id === benefitId);
                    return recalcSiblingUsage(updated, changedBenefit?.masterBenefitId, benefitId);
                  });
                  toast({ title: 'Undo successful', variant: 'info', duration: 2000 });
                } else {
                  toast({ title: 'Failed to undo', variant: 'error', duration: 3000 });
                }
              } catch {
                toast({ title: 'Failed to undo', variant: 'error', duration: 3000 });
              }
            },
          },
        });
      }
    } catch {
      // DISC-012: Revert optimistic update — recalculate sibling usage to match
      // the revert logic in the !response.ok handler above
      setBenefits(prev => {
        const updated = prev.map((b) =>
          b.id === benefitId
            ? { ...b, isUsed: false, claimedAt: originalClaimedAt, value: originalValue }
            : b
        );
        const target = updated.find(b => b.id === benefitId);
        return recalcSiblingUsage(updated, target?.masterBenefitId, benefitId);
      });
      toast({ title: 'Failed to mark benefit as used. Please try again.', variant: 'error' });
    }
  };

  // ============================================================
  // Handler: Benefit Updated - Updates benefits array after modal success
  // Called by EditBenefitModal onBenefitUpdated callback
  // ============================================================

  const handleBenefitUpdated = (updatedFields: Partial<BenefitData> & { id: string }) => {
    setBenefits(prev => {
      const updated = prev.map((b) => (b.id === updatedFields.id ? { ...b, ...updatedFields } : b));
      // Recalculate usage (progress ring %) for benefits sharing the same masterBenefitId
      // when isUsed changes, since calculateYearlyUsage counts sibling used states
      if ('isUsed' in updatedFields) {
        const changedBenefit = updated.find(b => b.id === updatedFields.id);
        return recalcSiblingUsage(updated, changedBenefit?.masterBenefitId, updatedFields.id);
      }
      return updated;
    });
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

  const displayBenefits = viewMode === 'history' ? historyBenefits : searchSortedBenefits;

  // ============================================================
  // Total benefits across ALL cards (not just selected card)
  // ============================================================

  const totalBenefitsAcrossCards = useMemo(() => {
    return cards.reduce((sum, card) =>
      sum + deduplicateBenefits(card.benefits || [], benefitEngineEnabled).length, 0);
  }, [cards, benefitEngineEnabled]);

  // ============================================================
  // Net Savings — total used benefit value minus total annual fees
  // ============================================================

  const totalUsedValue = useMemo(() => {
    return cards.reduce((sum, card) => {
      return sum + (card.benefits || [])
        .filter(b => b.isUsed)
        .reduce((bSum, b) => bSum + (b.value || 0), 0);
    }, 0);
  }, [cards]);

  // WARNING: totalUsedValue sums per-period amounts (not annualized).
  // Annualize before comparing against annual fees if this is re-enabled.
  const netSavings = totalUsedValue - (apiTotalFees / 100);
  void netSavings;

  // ============================================================
  // D-5: Card Annual Fee ROI — % of annual fee recovered by used benefits
  // ============================================================

  const selectedCardRoi = useMemo(() => {
    const card = cards.find((c) => c.id === selectedCardId);
    if (!card) return null;
    const annualFee = card.actualAnnualFee;
    if (!annualFee || annualFee === 0) return { type: 'free' as const };
    const usedValue = (card.benefits || [])
      .filter((b) => b.isUsed)
      .reduce((sum, b) => sum + (b.stickerValue > 0 ? (b.userDeclaredValue ?? b.stickerValue) : 0), 0);
    const pct = Math.round((usedValue / annualFee) * 100);
    return { type: 'paid' as const, pct, annualFee };
  }, [cards, selectedCardId]);

  // ============================================================
  // Benefit counts per card — for CardCarousel badges (Sprint 8)
  // ============================================================

  const benefitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    cards.forEach((card) => {
      counts[card.id] = deduplicateBenefits(card.benefits || [], benefitEngineEnabled).length;
    });
    return counts;
  }, [cards, benefitEngineEnabled]);

  // ============================================================
  // Expiring-soon benefits — within 7 days (Sprint 8 alert banner)
  // ============================================================

  const expiringBenefits = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return displayBenefits.filter((b) => {
      if (!b.periodEnd) return false;
      const end = new Date(b.periodEnd);
      return end >= now && end <= sevenDaysFromNow;
    });
  }, [displayBenefits]);

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
      label: viewMode === 'history' ? 'Past Value' : benefitEngineEnabled ? "This Period's Value" : 'Total Value',
      value: `$${displayBenefits.reduce((sum, b) => sum + (b.value || 0), 0).toLocaleString()}`,
      icon: 'DollarSign',
      variant: 'default' as const,
    },
    {
      label: 'Value Captured',
      value: `$${displayBenefits.filter(b => b.isUsed).reduce((sum, b) => sum + (b.value || 0), 0).toLocaleString()}`,
      icon: 'TrendingUp',
      variant: 'default' as const,
    },
    {
      label: viewMode === 'history' ? 'Used' : 'Expiring Soon',
      value: viewMode === 'history'
        ? displayBenefits.filter((b) => b.isUsed).length
        : displayBenefits.filter((b) => {
            if (!b.periodEnd) return false;
            const end = new Date(b.periodEnd);
            const now = new Date();
            const daysUntilExpiry = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
          }).length,
      icon: 'Clock',
      variant: 'default' as const,
    },
  ];

  // ============================================================
  // Render: Loading State
  // ============================================================

  if (isLoadingCards) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <AppHeader />

        {/* Loading Content */}
        <main id="main-content" className="flex-1 px-4 md:px-8 py-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Loading Header Skeleton */}
            <div className="space-y-2">
              <div className="h-8 w-48 rounded" style={{ background: 'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary, var(--color-bg)) 50%, var(--color-bg-secondary) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }} />
              <div className="h-4 w-72 rounded" style={{ background: 'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary, var(--color-bg)) 50%, var(--color-bg-secondary) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }} />
            </div>

            {/* Loading Card Switcher Skeleton */}
            <div className="flex gap-4">
              <div className="h-10 w-32 rounded" style={{ background: 'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary, var(--color-bg)) 50%, var(--color-bg-secondary) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }} />
              <div className="h-10 w-32 rounded" style={{ background: 'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary, var(--color-bg)) 50%, var(--color-bg-secondary) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }} />
              <div className="h-10 w-32 rounded" style={{ background: 'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary, var(--color-bg)) 50%, var(--color-bg-secondary) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }} />
            </div>

            {/* Loading Dashboard Summary Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SkeletonCard rows={2} showImage={false} />
              <SkeletonCard rows={2} showImage={false} />
              <SkeletonCard rows={2} showImage={false} />
            </div>

            {/* Loading Benefits Grid Skeleton */}
            <div className="space-y-4">
              <div className="h-6 w-56 rounded" style={{ background: 'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary, var(--color-bg)) 50%, var(--color-bg-secondary) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }} />
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
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <AppHeader />

        {/* Error Content */}
        <main id="main-content" className="flex-1 px-4 md:px-8 py-8 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div
              className="p-4 rounded-lg mb-6 bg-[var(--color-error-light)]"
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
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] safe-area-bottom">
      <AppHeader />

      {/* Welcome section below header — compact layout */}
      <div
        className="border-b bg-[var(--color-bg)] border-[var(--color-border)] animate-slide-up"
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3">
          <div className="flex flex-row items-center justify-between">
            <div>
              <h1
                className="font-bold text-[var(--color-text)] text-[length:var(--text-h4)]"
              >
                Welcome, {userName}! 👋
              </h1>
              <p className="text-sm mt-1 text-[var(--color-text-secondary)]">
                You have {apiTotalCards ?? cards.length} card{(apiTotalCards ?? cards.length) !== 1 ? 's' : ''} and {apiTotalBenefits ?? totalBenefitsAcrossCards} benefit{(apiTotalBenefits ?? totalBenefitsAcrossCards) !== 1 ? 's' : ''} tracked
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddCardModalOpen(true)}
              className="shrink-0"
            >
              <Plus size={16} className="mr-1.5" />
              Add Card
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="flex-1 px-4 md:px-8 pt-2 pb-6">
        <div className="max-w-6xl mx-auto">
          {/* Empty State: No Cards — DASH-026 Rich Onboarding */}
          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 md:py-24">
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-6"
                style={{ backgroundColor: 'var(--color-primary-light)' }}
                aria-hidden="true"
              >
                <CreditCard size={36} style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3
                className="text-xl md:text-2xl font-bold text-center mb-3"
                style={{ color: 'var(--color-text)' }}
              >
                Welcome to CardTrack!
              </h3>
              <p
                className="text-sm md:text-base max-w-md text-center mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Track your credit card benefits so you never miss a perk.
                See what each card offers, when benefits expire, and how much value you&#39;ve captured.
              </p>
              <p
                className="text-xs max-w-sm text-center mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Add your first card to get started — we&#39;ll auto-populate its benefits for you.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsAddCardModalOpen(true)}
              >
                <Plus size={18} className="mr-2" />
                Add Your First Card
              </Button>
            </div>
          ) : (
            <>
              {/* Sentinel for collapse detection — 1px tall for reliable IntersectionObserver across browsers */}
              <div ref={carouselSentinelRef} aria-hidden="true" style={{ height: '1px', marginBottom: '-1px', overflow: 'hidden' }} />

              {/* Sticky carousel container */}
              <div className="sticky z-30 -mx-4 md:-mx-8 px-0 md:px-8 relative" data-sticky-carousel style={{ top: 'calc(var(--height-header, 52px) + env(safe-area-inset-top, 0px))', backgroundColor: 'color-mix(in srgb, var(--color-bg) 80%, transparent)', backdropFilter: 'blur(12px) saturate(180%)', WebkitBackdropFilter: 'blur(12px) saturate(180%)', boxShadow: 'var(--header-shadow)' }}>
                {/* Expanded carousel */}
                <div
                  className="carousel-collapse-transition"
                  style={{
                    maxHeight: isCarouselCollapsed ? 0 : 300,
                    overflow: 'hidden',
                    opacity: isCarouselCollapsed ? 0 : 1,
                  }}
                  {...(isCarouselCollapsed ? { inert: '' } as unknown as React.HTMLAttributes<HTMLDivElement> : {})}
                >
                  <div className="py-2">
                    <CardCarousel
                      cards={cards}
                      selectedCardId={selectedCardId}
                      onSelectCard={setSelectedCardId}
                      benefitCounts={benefitCounts}
                      onEditCard={(cardId) => setEditingCard(cardId)}
                    />
                  </div>
                </div>

                {/* Collapsed compact chips */}
                <div
                  className="carousel-collapse-transition"
                  style={{
                    maxHeight: isCarouselCollapsed ? 65 /* py-1.5(6)+py-1(4)+btn(44)+py-1(4)+py-1.5(6)+border(1)=65 */ : 0, // Keep in sync with --compact-bar-height in design-tokens.css
                    overflow: 'hidden',
                    opacity: isCarouselCollapsed ? 1 : 0,
                  }}
                  {...(!isCarouselCollapsed ? { inert: '' } as unknown as React.HTMLAttributes<HTMLDivElement> : {})}
                >
                  <div className="py-1.5 border-b border-[var(--color-border)]" style={{ boxShadow: 'var(--header-shadow)' }}>
                    <CompactCardChips
                      cards={cards}
                      selectedCardId={selectedCardId}
                      onSelectCard={setSelectedCardId}
                      benefitCounts={benefitCounts}
                      onEditCard={(cardId) => setEditingCard(cardId)}
                    />
                  </div>
                </div>
              </div>

              {/* DISC-010: Filter controls landmark */}
              {benefits.length > 0 && (
              <div className="mt-6 animate-slide-up" role="search" aria-label="Filter benefits">
                <UnifiedFilterBar
                  selectedPeriodId={selectedPeriodId}
                  onPeriodChange={setSelectedPeriodId}
                  periods={periodOptions}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  benefitEngineEnabled={benefitEngineEnabled}
                  filteredCount={deduplicatedBenefits.length}
                  totalCount={deduplicateBenefits(benefits, benefitEngineEnabled).length}
                />
                {/* D-1: Screen-reader announcement of filter result count */}
                <div aria-live="polite" className="sr-only">
                  Showing {displayBenefits.length} of {deduplicateBenefits(benefits, benefitEngineEnabled).length} benefits
                </div>
              </div>
              )}

              {/* Search, Sort & Smart View Chips (Sprint 8) */}
              {viewMode === 'current' && benefits.length > 0 && (
                <div className="mt-3 space-y-3">
                  <SearchSortBar
                    searchQuery={searchQuery}
                    onSearch={setSearchQuery}
                    activeSort={activeSort}
                    onSort={setActiveSort}
                  />
                  <SmartViewChips
                    activeView={smartView}
                    onSmartView={setSmartView}
                  />
                </div>
              )}

              {/* Mobile Summary Stats — same data as desktop (DASH-041) */}
              {/* DISC-010: Region landmark with aria-label for stats */}
              <div className="md:hidden mt-4" role="region" aria-label="Summary statistics">
                <MobileSummaryStats stats={summaryStats} />
              </div>

              {/* Desktop Dashboard Summary — hidden on mobile */}
              <div className="hidden md:block mt-4" role="region" aria-label="Summary statistics">
                <DashboardSummary stats={summaryStats} />
              </div>

              {/* Benefits Section */}
              {/* DISC-010: Section landmark with aria-label */}
              <section className="mt-6" aria-label="Benefits">
                {/* Expiring-soon alert banner (Sprint 8) — D-4: clickable to filter */}
                {expiringBenefits.length > 0 && viewMode === 'current' && (
                  <button
                    type="button"
                    onClick={() => setSmartView('expiring-soon')}
                    className="w-full rounded-lg px-4 py-3 mb-4 flex items-center gap-3 cursor-pointer transition-colors hover:brightness-95"
                    style={{
                      backgroundColor: 'var(--color-alert-50)',
                      border: '1px solid var(--color-alert-500)',
                      color: 'var(--color-alert-600)',
                    }}
                    role="alert"
                  >
                    <AlertCircle size={18} aria-hidden="true" />
                    <span className="text-sm font-medium flex-1 text-left">
                      {expiringBenefits.length} benefit{expiringBenefits.length > 1 ? 's' : ''} expiring within 7 days
                    </span>
                    <span className="text-sm font-semibold whitespace-nowrap" aria-hidden="true">View them →</span>
                  </button>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2
                      className="text-lg font-semibold text-[var(--color-text)]"
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
                    </h2>
                    {/* D-5: Annual Fee ROI Badge */}
                    {viewMode === 'current' && selectedCardRoi && (
                      selectedCardRoi.type === 'free' ? (
                        <span
                          className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: 'var(--color-success-bg-muted, rgba(10,125,87,0.1))',
                            color: 'var(--color-success)',
                          }}
                        >
                          Free Card
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: selectedCardRoi.pct >= 100
                              ? 'var(--color-success-bg-muted, rgba(10,125,87,0.1))'
                              : selectedCardRoi.pct >= 50
                                ? 'var(--color-warning-bg-muted, rgba(180,83,9,0.1))'
                                : 'var(--color-error-bg-muted, rgba(239,68,68,0.1))',
                            color: selectedCardRoi.pct >= 100
                              ? 'var(--color-success)'
                              : selectedCardRoi.pct >= 50
                                ? 'var(--color-warning)'
                                : 'var(--color-error)',
                          }}
                          title={`${selectedCardRoi.pct}% of ${formatCurrency(selectedCardRoi.annualFee)} annual fee recovered`}
                        >
                          {selectedCardRoi.pct}% ROI
                        </span>
                      )
                    )}
                  </div>
                  {viewMode === 'current' && (
                    <Button
                      variant="primary"
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
                {viewMode === 'current' && displayBenefits.length === 0 && benefits.length > 0 && (
                  <div
                    className="text-center py-12 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"
                  >
                    <p className="text-sm">
                      No benefits match your current filters.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedPeriodId('all-time');
                        setSearchQuery('');
                        setActiveSort('default');
                        setSmartView('all');
                      }}
                      className="text-sm underline mt-2 transition-colors text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}

                {/* DASH-026: Onboarding empty state when card has zero benefits */}
                {viewMode === 'current' && benefits.length === 0 && (
                  <div
                    className="flex flex-col items-center justify-center py-12 px-4 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%)',
                    }}
                  >
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                      style={{ backgroundColor: 'var(--color-primary-light)' }}
                      aria-hidden="true"
                    >
                      <Sparkles size={28} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <p
                      className="text-lg font-semibold text-center mb-2"
                      style={{ color: 'var(--color-text)' }}
                    >
                      No Benefits Tracked Yet
                    </p>
                    <p
                      className="text-sm max-w-sm text-center mb-6"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Start getting more from this card! Add benefits to track their value, expiration dates, and usage throughout the year.
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setIsAddBenefitOpen(true)}
                    >
                      <Plus size={16} className="mr-2" />
                      Add Your First Benefit
                    </Button>
                  </div>
                )}

                {/* Empty State for History */}
                {viewMode === 'history' && !isLoadingHistory && historyBenefits.length === 0 && (
                  <div
                    className="text-center py-12 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"
                  >
                    <p className="text-sm">
                      No previous period benefits found for this card.
                    </p>
                  </div>
                )}

                {/* Benefits Grid — uses displayBenefits (current or history) */}
                {displayBenefits.length > 0 && !(viewMode === 'history' && isLoadingHistory) && (
                  <div key={selectedCardId} className="animate-content-reveal">
                  <BenefitsGrid
                    benefits={displayBenefits.map(transformBenefitForGrid)}
                    onEdit={viewMode === 'current' ? handleEditBenefitClick : undefined}
                    onMarkUsed={viewMode === 'current' ? handleMarkUsed : undefined}
                    gridColumns={3}
                    celebratingIds={celebratingIds}
                  />
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t py-6 mt-auto bg-[var(--color-bg-secondary)] border-[var(--color-border)]"
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

      {/* Sprint 25: Card Edit Modal on Dashboard */}
      <CardEditModal
        card={editableCardForModal}
        isOpen={!!editingCard}
        onClose={() => setEditingCard(null)}
        onCardUpdated={handleCardEdited}
      />

      {/* Sprint 28D: Mobile FAB — Add Benefit */}
      {cards.length > 0 && (
        <button
          onClick={() => setIsAddBenefitOpen(true)}
          className="fixed right-6 z-30 md:hidden w-14 h-14 rounded-full shadow-lg flex items-center justify-center press-feedback"
          style={{
            background: 'var(--color-primary)',
            bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          }}
          aria-label="Add benefit"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
}
