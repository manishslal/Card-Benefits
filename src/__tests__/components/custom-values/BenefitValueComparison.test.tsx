/**
 * src/__tests__/components/custom-values/BenefitValueComparison.test.tsx
 *
 * Tests for BenefitValueComparison component.
 * Tests display of sticker vs custom values, differences, and ROI metrics.
 *
 * Test targets:
 * - 10+ test cases
 * - Value display (sticker, custom, effective)
 * - Difference calculation and display
 * - Significance highlighting
 * - ROI display
 * - Accessibility
 * - Responsive design
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BenefitValueComparison } from '@/features/benefits';

describe('BenefitValueComparison Component', () => {
  const defaultProps = {
    benefitName: 'Travel Credit',
    stickerValue: 30000, // $300
    customValue: 25000, // $250
    effectiveValue: 25000,
    benefitROI: 45.45,
  };

  // ════════════════════════════════════════════════════════════════════════════
  // VALUE DISPLAY TESTS (3 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Value Display', () => {
    it('should display sticker value as master', () => {
      render(
        <BenefitValueComparison
          {...defaultProps}
          customValue={null}
        />
      );
      
      expect(screen.getByText(/master.*\$300/i)).toBeInTheDocument();
    });

    it('should display custom value when set', () => {
      render(<BenefitValueComparison {...defaultProps} />);
      
      expect(screen.getByText(/your value.*\$250/i)).toBeInTheDocument();
    });

    it('should format values as currency', () => {
      render(
        <BenefitValueComparison
          {...defaultProps}
          stickerValue={12345}
          customValue={9999}
        />
      );
      
      expect(screen.getByText(/\$123\.45/)).toBeInTheDocument();
      expect(screen.getByText(/\$99\.99/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DIFFERENCE CALCULATION TESTS (3 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Difference Calculation', () => {
    it('should display difference amount', () => {
      render(<BenefitValueComparison {...defaultProps} />);
      
      // $250 - $300 = -$50
      expect(screen.getByText(/-\$50/)).toBeInTheDocument();
    });

    it('should display difference percentage', () => {
      render(<BenefitValueComparison {...defaultProps} />);
      
      // -$50 / $300 = -16.67%
      expect(screen.getByText(/-16\.67%/)).toBeInTheDocument();
    });

    it('should highlight when difference > 10%', () => {
      const { container } = render(
        <BenefitValueComparison
          {...defaultProps}
          customValue={25000} // 16.67% different
        />
      );
      
      // Should have visual indicator for significance
      const significantElement = container.querySelector('[data-significant]');
      expect(significantElement).toBeInTheDocument();
    });

    it('should not highlight when difference <= 10%', () => {
      const { container } = render(
        <BenefitValueComparison
          {...defaultProps}
          customValue={29100} // 3% different
        />
      );
      
      const significantElement = container.querySelector('[data-significant]');
      expect(significantElement).not.toBeInTheDocument();
    });

    it('should handle positive difference (custom > sticker)', () => {
      render(
        <BenefitValueComparison
          {...defaultProps}
          customValue={35000} // $350, 16.67% higher
        />
      );
      
      expect(screen.getByText(/\+\$50/)).toBeInTheDocument();
      expect(screen.getByText(/\+16\.67%/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ROI DISPLAY TESTS (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('ROI Display', () => {
    it('should display benefit ROI', () => {
      render(
        <BenefitValueComparison
          {...defaultProps}
          benefitROI={45.45}
        />
      );
      
      expect(screen.getByText(/45\.45%/)).toBeInTheDocument();
    });

    it('should display card ROI when provided', () => {
      render(
        <BenefitValueComparison
          {...defaultProps}
          benefitROI={45.45}
          cardROI={145.45}
        />
      );
      
      expect(screen.getByText(/145\.45%/)).toBeInTheDocument();
    });

    it('should show before/after ROI when changing', () => {
      render(
        <BenefitValueComparison
          {...defaultProps}
          benefitROI={45.45}
          cardROI={145.45}
          previousCardROI={148.0}
        />
      );
      
      // Should show both values for comparison
      expect(screen.getByText(/145\.45%/)).toBeInTheDocument();
      expect(screen.getByText(/148\.0%/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ACCESSIBILITY (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Accessibility', () => {
    it('should not rely on color alone for indicators', () => {
      const { container } = render(
        <BenefitValueComparison
          {...defaultProps}
          customValue={25000}
        />
      );
      
      // Should have icons, text labels, or other non-color indicators
      const significant = container.querySelector('[data-significant]');
      expect(significant).toBeInTheDocument();
      
      // Should contain text or icon, not just color
      const text = significant?.textContent || significant?.innerHTML;
      expect(text).not.toBeEmpty();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RESPONSIVE DESIGN (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Responsive Design', () => {
    it('should be mobile responsive', () => {
      const { container } = render(
        <BenefitValueComparison {...defaultProps} />
      );
      
      // Should have responsive layout classes
      const layout = container.firstChild;
      expect(layout?.className).toMatch(/flex|grid|responsive/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // EDGE CASES (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should handle zero sticker value', () => {
      render(
        <BenefitValueComparison
          {...defaultProps}
          stickerValue={0}
          customValue={25000}
        />
      );
      
      // Should render without division by zero error
      expect(screen.getByText(/travel credit/i)).toBeInTheDocument();
    });

    it('should handle matching custom and sticker values', () => {
      render(
        <BenefitValueComparison
          {...defaultProps}
          customValue={30000}
        />
      );
      
      // Difference should be 0
      expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    });
  });
});
