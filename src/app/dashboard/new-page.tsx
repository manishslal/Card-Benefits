'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PeriodSelector, PeriodOption } from './components/PeriodSelector';
import { StatusFilters, BenefitStatus, StatusOption } from './components/StatusFilters';
import { SummaryBox } from './components/SummaryBox';
import { BenefitsList } from './components/BenefitsList';
import { BenefitRowProps } from './components/BenefitRow';
import { calculatePeriodDateRange, getPeriodDisplayLabel } from './utils/period-helpers';
import { fetchDashboardData, toggleBenefitUsed } from './utils/api-client';

/**
 * Enhanced Dashboard Page - Period-First Benefits Tracker
 *
 * Features:
 * - Period selector (This Month, Quarter, Half Year, Full Year, All Time)
 * - Multi-select status filters (Active, Expiring, Used, Expired, Pending)
 * - Summary statistics box
 * - Benefits grouped by status with expandable sections
 * - Past periods section with expandable groups
 * - Responsive design with dark mode support
 * - Accessibility features (ARIA labels, keyboard navigation)
 *
 * Uses React 19 patterns:
 * - useCallback for memoized handlers
 * - useMemo for calculated values
 * - useState for local state
 * - No React import needed (new JSX transform)
 */
export default function EnhancedDashboardPage() {
  // ============================================================
  // State Management
  // ============================================================
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('this-month');
  const [selectedStatuses, setSelectedStatuses] = useState<BenefitStatus[]>([]);
  const [benefits, setBenefits] = useState<BenefitRowProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  // Status Filter Configuration
  // ============================================================
  const statusOptions: StatusOption[] = useMemo(
    () => [
      {
        id: 'active',
        label: 'Active',
        icon: '🟢',
        description: 'Benefits with balance remaining',
      },
      {
        id: 'expiring_soon',
        label: 'Expiring Soon',
        icon: '🟠',
        description: '7-30 days left to use',
      },
      {
        id: 'used',
        label: 'Used',
        icon: '✓',
        description: 'Already claimed this period',
      },
      {
        id: 'expired',
        label: 'Expired',
        icon: '🔴',
        description: 'Period ended',
      },
      {
        id: 'pending',
        label: 'Pending',
        icon: '⏳',
        description: 'Future periods',
      },
    ],
    []
  );

  // ============================================================
  // Load Dashboard Data
  // ============================================================
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchDashboardData();
        setBenefits(data.benefits);
      } catch (err) {
        console.error('Error loading dashboard:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load dashboard. Please try again.'
        );
        // Use mock data for development
        setBenefits(generateMockBenefits());
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

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
    // In a real app, this would re-fetch data for the new period
  }, []);

  const handleStatusChange = useCallback((statuses: BenefitStatus[]) => {
    setSelectedStatuses(statuses);
  }, []);

  const handleMarkUsed = useCallback(
    async (benefitId: string) => {
      try {
        const result = await toggleBenefitUsed(benefitId);
        if (result.success) {
          // Update local state
          setBenefits((prev) =>
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
    console.log('Edit benefit:', benefitId);
    // Open edit modal
  }, []);

  const handleDelete = useCallback((benefitId: string) => {
    console.log('Delete benefit:', benefitId);
    // Open delete confirmation
  }, []);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            💳 My Benefits
          </h1>

          {/* Controls Row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
            <PeriodSelector
              selectedPeriodId={selectedPeriodId}
              onPeriodChange={handlePeriodChange}
              periods={periodOptions}
            />
            <StatusFilters
              selectedStatuses={selectedStatuses}
              onStatusChange={handleStatusChange}
              availableStatuses={statusOptions}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-2">
              Using mock data for demonstration
            </p>
          </div>
        )}

        {/* Summary Box */}
        <SummaryBox
          totalBenefits={summary.total}
          expiringCount={summary.expiring}
          usedCount={summary.used}
          totalValue={summary.totalValue}
          isLoading={isLoading}
        />

        {/* Benefits List */}
        <div className="mt-8">
          <BenefitsList
            benefits={benefits}
            pastPeriods={[]}
            selectedStatuses={
              selectedStatuses.length > 0 ? selectedStatuses : statusOptions.map((s) => s.id)
            }
            isLoading={isLoading}
            onMarkUsed={handleMarkUsed}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </main>
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
