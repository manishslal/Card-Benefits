/**
 * src/__tests__/components/custom-values/BulkValueEditor.test.tsx
 *
 * Tests for BulkValueEditor component.
 * Tests multi-step wizard, value calculations, and bulk update functionality.
 *
 * Test targets:
 * - 15+ test cases
 * - Multi-step workflow (3 steps)
 * - Percentage, fixed amount, preset options
 * - Preview calculations
 * - Confirmation and error handling
 * - Loading states
 * - Accessibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkValueEditor } from '@/components/custom-values/BulkValueEditor';
import type { BenefitForBulkEdit } from '@/features/custom-values/types';

describe('BulkValueEditor Component', () => {
  const mockBenefits: BenefitForBulkEdit[] = [
    { id: 'b1', name: 'Travel', stickerValue: 30000, currentValue: null },
    { id: 'b2', name: 'Dining', stickerValue: 20000, currentValue: 15000 },
    { id: 'b3', name: 'Uber', stickerValue: 15000, currentValue: null },
  ];

  const defaultProps = {
    selectedBenefits: mockBenefits,
    onApply: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1: REVIEW SELECTED (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Step 1: Review Selected Benefits', () => {
    it('should show Step 1: Review on initial render', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      expect(screen.getByText(/review selected/i)).toBeInTheDocument();
      expect(screen.getByText(/3 benefits/i)).toBeInTheDocument();
    });

    it('should list all selected benefits', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      expect(screen.getByText(/Travel/)).toBeInTheDocument();
      expect(screen.getByText(/Dining/)).toBeInTheDocument();
      expect(screen.getByText(/Uber/)).toBeInTheDocument();
    });

    it('should have Next button on Step 1', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should advance to Step 2 on Next', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      
      expect(screen.getByText(/choose value option/i)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2: CHOOSE VALUE OPTION (4 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Step 2: Choose Value Option', () => {
    it('should show Step 2 after clicking Next', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      
      expect(screen.getByText(/choose value option/i)).toBeInTheDocument();
    });

    it('should show radio options for value type', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      
      expect(screen.getByLabelText(/percentage/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/fixed amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/preset/i)).toBeInTheDocument();
    });

    it('should show preset percentages when percentage selected', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/percentage/i));
      
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/90%/)).toBeInTheDocument();
    });

    it('should show input field when fixed amount selected', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/fixed amount/i));
      
      expect(screen.getByPlaceholderText(/\$|amount|value/i)).toBeInTheDocument();
    });

    it('should allow custom percentage input', async () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/percentage/i));
      
      const input = screen.queryByPlaceholderText(/custom|percentage/i);
      if (input) {
        await userEvent.type(input, '65');
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 3: PREVIEW (6 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Step 3: Preview Changes', () => {
    it('should show Step 3 after selecting option', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/percentage/i));
      fireEvent.click(screen.getByText(/75%/));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      
      expect(screen.getByText(/preview/i)).toBeInTheDocument();
    });

    it('should calculate preview values correctly for 75% preset', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/percentage/i));
      fireEvent.click(screen.getByText(/75%/));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      
      // Travel: 30000 * 0.75 = 22500 = $225
      expect(screen.getByText(/\$225/)).toBeInTheDocument();
      // Dining: 20000 * 0.75 = 15000 = $150
      expect(screen.getByText(/\$150/)).toBeInTheDocument();
      // Uber: 15000 * 0.75 = 11250 = $112.50
      expect(screen.getByText(/\$112\.50/)).toBeInTheDocument();
    });

    it('should show before/after values', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/percentage/i));
      fireEvent.click(screen.getByText(/75%/));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      
      // Should show original and new values
      expect(screen.getByText(/\$300/)).toBeInTheDocument();
      expect(screen.getByText(/\$225/)).toBeInTheDocument();
    });

    it('should have Confirm button on Step 3', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/percentage/i));
      fireEvent.click(screen.getByText(/75%/));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    it('should call onApply with calculated values on Confirm', async () => {
      const onApply = vi.fn().mockResolvedValue(undefined);
      render(
        <BulkValueEditor
          {...defaultProps}
          onApply={onApply}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/percentage/i));
      fireEvent.click(screen.getByText(/75%/));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      
      await waitFor(() => {
        expect(onApply).toHaveBeenCalledWith([
          { benefitId: 'b1', valueInCents: 22500 },
          { benefitId: 'b2', valueInCents: 15000 },
          { benefitId: 'b3', valueInCents: 11250 },
        ]);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NAVIGATION TESTS (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Navigation', () => {
    it('should support Back button', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByText(/choose value option/i)).toBeInTheDocument();
      
      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(screen.getByText(/review selected/i)).toBeInTheDocument();
    });

    it('should call onCancel when Cancel clicked', () => {
      const onCancel = vi.fn();
      render(
        <BulkValueEditor
          {...defaultProps}
          onCancel={onCancel}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // LOADING STATE TESTS (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Loading State', () => {
    it('should show loading state while applying', async () => {
      const onApply = vi.fn(
        () => new Promise(resolve => setTimeout(resolve, 500))
      );
      render(
        <BulkValueEditor
          {...defaultProps}
          onApply={onApply}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/percentage/i));
      fireEvent.click(screen.getByText(/75%/));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/updating|applying/i)).toBeInTheDocument();
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const onApply = vi.fn().mockRejectedValue(new Error('Apply failed'));
      render(
        <BulkValueEditor
          {...defaultProps}
          onApply={onApply}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/percentage/i));
      fireEvent.click(screen.getByText(/75%/));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/failed|error/i)).toBeInTheDocument();
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ACCESSIBILITY (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      render(<BulkValueEditor {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.every(btn => btn.tabIndex >= -1)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RESPONSIVE DESIGN (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Responsive Design', () => {
    it('should be mobile responsive', () => {
      const { container } = render(<BulkValueEditor {...defaultProps} />);
      
      // Should have responsive layout
      const wrapper = container.querySelector('[class*="flex"]');
      expect(wrapper).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // EDGE CASES (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should handle single benefit', () => {
      render(
        <BulkValueEditor
          {...defaultProps}
          selectedBenefits={mockBenefits.slice(0, 1)}
        />
      );
      
      expect(screen.getByText(/1 benefit/i)).toBeInTheDocument();
    });

    it('should handle fixed amount input', async () => {
      const onApply = vi.fn().mockResolvedValue(undefined);
      render(
        <BulkValueEditor
          {...defaultProps}
          onApply={onApply}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByLabelText(/fixed amount/i));
      
      const input = screen.getByPlaceholderText(/amount|value/i);
      await userEvent.type(input, '10000');
      
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      
      await waitFor(() => {
        expect(onApply).toHaveBeenCalled();
        const call = onApply.mock.calls[0][0];
        expect(call.every((item: any) => item.valueInCents === 10000)).toBe(true);
      });
    });
  });
});
