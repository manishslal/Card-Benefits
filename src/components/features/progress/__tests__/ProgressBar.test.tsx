/**
 * Component Tests for ProgressBar
 * Tests visual rendering, color coding, accessibility, and edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';
import { BenefitProgress } from '@/types/benefits';

describe('ProgressBar Component', () => {
  describe('✅ Rendering', () => {
    it('should render with correct percentage display', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 5000,
        limit: 10000,
        percentage: 50,
        status: 'active',
        unit: 'dollars',
      };

      render(<ProgressBar progress={progress} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should show "Used X of Y" text', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 7500,
        limit: 15000,
        percentage: 50,
        status: 'active',
        unit: 'dollars',
      };

      render(<ProgressBar progress={progress} />);

      expect(screen.getByText('Used $75.00 of $150.00')).toBeInTheDocument();
    });

    it('should render progress bar div with correct width', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 2500,
        limit: 10000,
        percentage: 25,
        status: 'active',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressBar = container.querySelector('[style*="width"]');

      expect(progressBar).toHaveStyle('width: 25%');
    });

    it('should cap percentage at 100% for visual display when exceeded', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 15000,
        limit: 10000,
        percentage: 150,
        status: 'exceeded',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressBar = container.querySelector('[style*="width"]');

      expect(progressBar).toHaveStyle('width: 100%');
    });
  });

  describe('🎨 Color Coding', () => {
    it('should show green color for active status (0-50%)', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 3000,
        limit: 10000,
        percentage: 30,
        status: 'active',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressDiv = container.querySelector('.bg-green-500');

      expect(progressDiv).toBeInTheDocument();
    });

    it('should show yellow color for warning status (50-80%)', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 6000,
        limit: 10000,
        percentage: 60,
        status: 'warning',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressDiv = container.querySelector('.bg-yellow-500');

      expect(progressDiv).toBeInTheDocument();
    });

    it('should show orange color for critical status (80-99%)', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 9000,
        limit: 10000,
        percentage: 90,
        status: 'critical',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressDiv = container.querySelector('.bg-orange-500');

      expect(progressDiv).toBeInTheDocument();
    });

    it('should show red color for exceeded status (100%+)', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 12000,
        limit: 10000,
        percentage: 120,
        status: 'exceeded',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressDiv = container.querySelector('.bg-red-500');

      expect(progressDiv).toBeInTheDocument();
    });

    it('should show gray color for unused status', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 0,
        limit: 10000,
        percentage: 0,
        status: 'unused',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressDiv = container.querySelector('.bg-gray-300');

      expect(progressDiv).toBeInTheDocument();
    });
  });

  describe('♿ Accessibility', () => {
    it('should have proper role="progressbar"', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 5000,
        limit: 10000,
        percentage: 50,
        status: 'active',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressBar = container.querySelector('[role="progressbar"]');

      expect(progressBar).toBeInTheDocument();
    });

    it('should have aria-valuenow attribute', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 7500,
        limit: 10000,
        percentage: 75,
        status: 'warning',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressBar = container.querySelector('[aria-valuenow="75"]');

      expect(progressBar).toBeInTheDocument();
    });

    it('should have aria-valuemin and aria-valuemax', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 5000,
        limit: 10000,
        percentage: 50,
        status: 'active',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressBar = container.querySelector('[role="progressbar"]');

      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should have descriptive aria-label', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 5000,
        limit: 10000,
        percentage: 50,
        status: 'active',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressBar = container.querySelector('[role="progressbar"]');

      expect(progressBar).toHaveAttribute(
        'aria-label',
        expect.stringContaining('50%')
      );
    });
  });

  describe('⚠️ Edge Cases', () => {
    it('should handle 0% usage', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 0,
        limit: 10000,
        percentage: 0,
        status: 'unused',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle 100% usage', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 10000,
        limit: 10000,
        percentage: 100,
        status: 'exceeded',
        unit: 'dollars',
      };

      render(<ProgressBar progress={progress} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle >100% usage with warning text', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 12000,
        limit: 10000,
        percentage: 120,
        status: 'exceeded',
        unit: 'dollars',
      };

      render(<ProgressBar progress={progress} />);
      expect(screen.getByText(/Over limit by/)).toBeInTheDocument();
      expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
    });

    it('should handle null limit', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 0,
        limit: null,
        percentage: 0,
        status: 'no_limit',
        unit: 'N/A',
      };

      render(<ProgressBar progress={progress} />);
      expect(screen.getByText('No limit set for this benefit')).toBeInTheDocument();
    });

    it('should format currency correctly', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 123,
        limit: 50000,
        percentage: 0.246,
        status: 'active',
        unit: 'dollars',
      };

      render(<ProgressBar progress={progress} />);
      expect(screen.getByText('Used $1.23 of $500.00')).toBeInTheDocument();
    });
  });

  describe('🎛️ Props Control', () => {
    it('should hide label when showLabel=false', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 5000,
        limit: 10000,
        percentage: 50,
        status: 'active',
        unit: 'dollars',
      };

      render(<ProgressBar progress={progress} showLabel={false} />);
      expect(screen.queryByText('Usage')).not.toBeInTheDocument();
    });

    it('should hide percentage when showPercentage=false', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 5000,
        limit: 10000,
        percentage: 50,
        status: 'active',
        unit: 'dollars',
      };

      render(<ProgressBar progress={progress} showPercentage={false} />);
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    it('should show both label and percentage by default', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 5000,
        limit: 10000,
        percentage: 50,
        status: 'active',
        unit: 'dollars',
      };

      render(<ProgressBar progress={progress} />);
      expect(screen.getByText('Usage')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('🌙 Dark Mode', () => {
    it('should apply dark mode classes', () => {
      const progress: BenefitProgress = {
        benefitId: 'benefit-1',
        used: 5000,
        limit: 10000,
        percentage: 50,
        status: 'active',
        unit: 'dollars',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper.className).toContain('dark:');
    });
  });
});
