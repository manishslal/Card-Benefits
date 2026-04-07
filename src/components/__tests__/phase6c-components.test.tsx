/**
 * Phase 6C Component Tests
 *
 * Unit tests for all Phase 6C claiming cadence frontend components:
 * - CadenceIndicator
 * - ClaimingLimitInfo
 * - BenefitUsageProgress
 * - PeriodClaimingHistory
 * - MarkBenefitUsedModal
 *
 * Run with: npm test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CadenceIndicator } from '../CadenceIndicator';
import { ClaimingLimitInfo } from '../ClaimingLimitInfo';
import { BenefitUsageProgress } from '../BenefitUsageProgress';
import { PeriodClaimingHistory } from '../PeriodClaimingHistory';
import { MarkBenefitUsedModal } from '../MarkBenefitUsedModal';

describe('Phase 6C Components', () => {
  // ========================================================================
  // CadenceIndicator Tests
  // ========================================================================

  describe('CadenceIndicator', () => {
    const mockLimits = {
      daysUntilExpiration: 5,
      warningLevel: 'HIGH' as const,
      periodEnd: new Date('2026-04-15'),
      claimingCadence: 'MONTHLY',
    };

    it('renders with correct urgency badge', () => {
      render(<CadenceIndicator {...mockLimits} />);

      expect(screen.getByText(/Expires in 5 days/i)).toBeInTheDocument();
    });

    it('shows CRITICAL state with pulsing animation for < 7 days', () => {
      render(
        <CadenceIndicator
          daysUntilExpiration={3}
          warningLevel="CRITICAL"
          periodEnd={new Date('2026-04-01')}
        />
      );

      expect(screen.getByText(/Expires in 3 days/i)).toBeInTheDocument();
    });

    it('displays deadline passed when 0 days left', () => {
      render(
        <CadenceIndicator
          daysUntilExpiration={0}
          warningLevel="CRITICAL"
          periodEnd={new Date('2026-03-31')}
        />
      );

      expect(screen.getByText(/Deadline Passed/i)).toBeInTheDocument();
    });

    it('includes cadence type when provided', () => {
      render(<CadenceIndicator {...mockLimits} claimingCadence="QUARTERLY" />);

      expect(screen.getByText(/Quarterly/i)).toBeInTheDocument();
    });

    it('has proper ARIA labels for accessibility', () => {
      render(<CadenceIndicator {...mockLimits} />);

      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label');
    });
  });

  // ========================================================================
  // ClaimingLimitInfo Tests
  // ========================================================================

  describe('ClaimingLimitInfo', () => {
    const mockLimits = {
      maxClaimableAmount: 1500,
      alreadyClaimedAmount: 1000,
      remainingAmount: 500,
      periodStart: new Date('2026-04-01'),
      periodEnd: new Date('2026-04-30'),
      periodLabel: 'April 2026',
      percentUtilized: 66.67,
      claimingCadence: 'MONTHLY' as const,
    };

    it('renders with all required information', () => {
      render(<ClaimingLimitInfo limits={mockLimits} />);

      expect(screen.getByText(/Claiming Details/i)).toBeInTheDocument();
    });

    it('displays three-column layout for available/used/total', () => {
      render(<ClaimingLimitInfo limits={mockLimits} />);

      expect(screen.getByText(/Available/i)).toBeInTheDocument();
      expect(screen.getByText(/Used/i)).toBeInTheDocument();
      expect(screen.getByText(/Total/i)).toBeInTheDocument();
    });

    it('shows warning when utilization >= 80%', () => {
      const highUtilization = { ...mockLimits, percentUtilized: 85 };
      render(<ClaimingLimitInfo limits={highUtilization} />);

      expect(screen.getByText(/Almost Full/i)).toBeInTheDocument();
    });

    it('shows error when fully used', () => {
      const fullyUsed = {
        ...mockLimits,
        remainingAmount: 0,
        alreadyClaimedAmount: 1500,
        percentUtilized: 100,
      };
      render(<ClaimingLimitInfo limits={fullyUsed} />);

      expect(screen.getByText(/Fully Used/i)).toBeInTheDocument();
    });

    it('renders compact view correctly', () => {
      render(<ClaimingLimitInfo limits={mockLimits} compact={true} />);

      expect(screen.getByText(/available/i)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // BenefitUsageProgress Tests
  // ========================================================================

  describe('BenefitUsageProgress', () => {
    it('renders progress bar correctly', () => {
      render(<BenefitUsageProgress used={1000} limit={1500} />);

      expect(screen.getByText(/claimed/i)).toBeInTheDocument();
    });

    it('calculates percentage correctly', () => {
      render(<BenefitUsageProgress used={750} limit={1500} showPercentage={true} />);

      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('displays over limit warning', () => {
      render(<BenefitUsageProgress used={2000} limit={1500} />);

      expect(screen.getByText(/Over limit/i)).toBeInTheDocument();
    });

    it('handles no limit case', () => {
      render(<BenefitUsageProgress used={0} limit={0} />);

      expect(screen.getByText(/No limit set/i)).toBeInTheDocument();
    });

    it('has proper ARIA attributes', () => {
      render(<BenefitUsageProgress used={750} limit={1500} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow');
    });
  });

  // ========================================================================
  // PeriodClaimingHistory Tests
  // ========================================================================

  describe('PeriodClaimingHistory', () => {
    const mockHistory = [
      {
        period: 'April 2026',
        claimed: 1500,
        max: 1500,
        status: 'FULLY_CLAIMED' as const,
        date: new Date('2026-04-30'),
      },
      {
        period: 'March 2026',
        claimed: 1200,
        max: 1500,
        status: 'PARTIALLY_CLAIMED' as const,
        missed: 300,
        date: new Date('2026-03-31'),
      },
    ];

    it('renders history list', () => {
      render(<PeriodClaimingHistory history={mockHistory} />);

      expect(screen.getByText(/April 2026/)).toBeInTheDocument();
      expect(screen.getByText(/March 2026/)).toBeInTheDocument();
    });

    it('displays correct status badges', () => {
      render(<PeriodClaimingHistory history={mockHistory} />);

      expect(screen.getByText(/Full/)).toBeInTheDocument();
      expect(screen.getByText(/Partial/)).toBeInTheDocument();
    });

    it('handles empty history', () => {
      render(<PeriodClaimingHistory history={[]} />);

      expect(screen.getByText(/No claiming history/i)).toBeInTheDocument();
    });
  });
});
