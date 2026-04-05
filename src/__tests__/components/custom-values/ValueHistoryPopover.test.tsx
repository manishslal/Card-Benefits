/**
 * src/__tests__/components/custom-values/ValueHistoryPopover.test.tsx
 *
 * Tests for ValueHistoryPopover component.
 * Tests history display, revert functionality, and UI interactions.
 *
 * Test targets:
 * - 10+ test cases
 * - History entry display (dates, values, sources, reasons)
 * - Revert confirmation and execution
 * - Popover opening/closing
 * - Accessibility
 * - Responsive design
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ValueHistoryPopover } from '@/components/custom-values/ValueHistoryPopover';
import type { BenefitValueChange } from '@/features/custom-values/types';

describe('ValueHistoryPopover Component', () => {
  const mockHistory: BenefitValueChange[] = [
    {
      value: 25000,
      changedAt: new Date('2024-04-02T15:30:00Z'),
      changedBy: 'user_123',
      source: 'manual',
      reason: "I don't use this much",
    },
    {
      value: 30000,
      changedAt: new Date('2024-04-01T10:00:00Z'),
      changedBy: 'system',
      source: 'import',
      reason: undefined,
    },
    {
      value: 30000,
      changedAt: new Date('2024-03-15T12:00:00Z'),
      changedBy: 'system',
      source: 'system',
      reason: undefined,
    },
  ];

  const defaultProps = {
    benefitId: 'b1',
    history: mockHistory,
    currentValue: 25000,
    onRevert: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // POPOVER TRIGGER TESTS (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Popover Trigger', () => {
    it('should render history button', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
    });

    it('should open popover on click', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HISTORY DISPLAY TESTS (4 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('History Display', () => {
    it('should display history entries with dates', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      expect(screen.getByText(/Apr 2/)).toBeInTheDocument();
      expect(screen.getByText(/Apr 1/)).toBeInTheDocument();
      expect(screen.getByText(/Mar 15/)).toBeInTheDocument();
    });

    it('should display values for each entry', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      expect(screen.getByText(/\$250/)).toBeInTheDocument();
      expect(screen.getAllByText(/\$300/).length).toBeGreaterThan(0);
    });

    it('should display source for each entry', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      expect(screen.getByText(/manual/i)).toBeInTheDocument();
      expect(screen.getByText(/import/i)).toBeInTheDocument();
      expect(screen.getByText(/system/i)).toBeInTheDocument();
    });

    it('should display reason when provided', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      expect(screen.getByText(/don't use this much/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SORT ORDER TESTS (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Sort Order', () => {
    it('should sort history by date (newest first)', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      const dates = screen.getAllByText(/\d+:\d+/);
      // Verify Apr 2 comes before Apr 1
      expect(dates[0].textContent).toContain('15:30');
      expect(dates[1].textContent).toContain('10:00');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // REVERT TESTS (3 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Revert Functionality', () => {
    it('should have revert button for each entry', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      const revertButtons = screen.getAllByRole('button', { name: /revert/i });
      expect(revertButtons.length).toBeGreaterThan(0);
    });

    it('should confirm before reverting', async () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      const revertButton = screen.getAllByRole('button', { name: /revert/i })[0];
      fireEvent.click(revertButton);
      
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('should call onRevert with correct index', async () => {
      const onRevert = vi.fn().mockResolvedValue(undefined);
      render(
        <ValueHistoryPopover
          {...defaultProps}
          onRevert={onRevert}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      const revertButton = screen.getAllByRole('button', { name: /revert/i })[1];
      fireEvent.click(revertButton);
      
      fireEvent.click(screen.getByRole('button', { name: /yes|confirm/i }));
      
      await waitFor(() => {
        expect(onRevert).toHaveBeenCalledWith(1);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // EDGE CASES (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should handle empty history', () => {
      render(
        <ValueHistoryPopover
          {...defaultProps}
          history={[]}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      // Should show empty state message
      expect(screen.getByText(/no history|empty/i)).toBeInTheDocument();
    });

    it('should handle single history entry', () => {
      render(
        <ValueHistoryPopover
          {...defaultProps}
          history={mockHistory.slice(0, 1)}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      const revertButtons = screen.getAllByRole('button', { name: /revert/i });
      expect(revertButtons.length).toBeGreaterThan(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ACCESSIBILITY (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      const button = screen.getByRole('button', { name: /history/i });
      expect(button).toHaveFocus() || expect(button.tabIndex).toBeGreaterThanOrEqual(-1);
      
      fireEvent.click(button);
      fireEvent.keyDown(button, { key: 'Escape' });
      
      // Popover should close on Escape
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RESPONSIVE DESIGN (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Responsive Design', () => {
    it('should be mobile responsive', () => {
      render(<ValueHistoryPopover {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /history/i }));
      
      const popover = screen.getByRole('dialog');
      expect(popover).toHaveClass('max-h-96', 'overflow-y-auto');
    });
  });
});
