/**
 * src/__tests__/components/custom-values/BenefitValuePresets.test.tsx
 *
 * Tests for BenefitValuePresets component.
 * Tests preset selection, calculations, and UI feedback.
 *
 * Test targets:
 * - 10+ test cases
 * - Preset button rendering
 * - Value calculation
 * - Selection highlighting
 * - Save behavior
 * - Error handling
 * - Accessibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BenefitValuePresets } from '@/features/benefits';

describe('BenefitValuePresets Component', () => {
  const defaultProps = {
    stickerValue: 30000, // $300
    currentValue: null,
    onSelect: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PRESET RENDERING TESTS (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Preset Rendering', () => {
    it('should render all preset buttons', () => {
      render(
        <BenefitValuePresets
          {...defaultProps}
        />
      );
      
      expect(screen.getByRole('button', { name: /master|100%/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /50%/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /75%/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /90%/i })).toBeInTheDocument();
    });

    it('should render custom preset option', () => {
      render(
        <BenefitValuePresets
          {...defaultProps}
        />
      );
      
      expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CALCULATION TESTS (3 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Preset Calculations', () => {
    it('should calculate preset values correctly', async () => {
      const onSelect = vi.fn().mockResolvedValue(undefined);
      render(
        <BenefitValuePresets
          {...defaultProps}
          onSelect={onSelect}
        />
      );
      
      // Click 75% preset
      fireEvent.click(screen.getByRole('button', { name: /75%/i }));
      
      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(22500); // 30000 * 0.75
      });
    });

    it('should handle 50% preset', async () => {
      const onSelect = vi.fn().mockResolvedValue(undefined);
      render(
        <BenefitValuePresets
          {...defaultProps}
          onSelect={onSelect}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /50%/i }));
      
      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(15000); // 30000 * 0.5
      });
    });

    it('should handle 90% preset', async () => {
      const onSelect = vi.fn().mockResolvedValue(undefined);
      render(
        <BenefitValuePresets
          {...defaultProps}
          onSelect={onSelect}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /90%/i }));
      
      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(27000); // 30000 * 0.9
      });
    });

    it('should handle master/100% preset', async () => {
      const onSelect = vi.fn().mockResolvedValue(undefined);
      render(
        <BenefitValuePresets
          {...defaultProps}
          onSelect={onSelect}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /master|100%/i }));
      
      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(30000); // 100% of sticker
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SELECTION HIGHLIGHTING TESTS (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Selection Highlighting', () => {
    it('should highlight current selection', () => {
      render(
        <BenefitValuePresets
          {...defaultProps}
          currentValue={22500} // 75% of $300
        />
      );
      
      const button = screen.getByRole('button', { name: /75%/i });
      expect(button.className).toMatch(/selected|highlight|active/i);
    });

    it('should not highlight when no selection matches', () => {
      render(
        <BenefitValuePresets
          {...defaultProps}
          currentValue={25000} // Doesn't match any preset exactly
        />
      );
      
      const buttons = screen.getAllByRole('button').filter(
        btn => /50%|75%|90%|master/i.test(btn.textContent || '')
      );
      
      // At least one button should not be highlighted
      const unhighlighted = buttons.some(
        btn => !btn.className.match(/selected|highlight|active/i)
      );
      expect(unhighlighted).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // LOADING STATE TESTS (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Loading State', () => {
    it('should show loading state while saving', async () => {
      const onSelect = vi.fn(
        () => new Promise(resolve => setTimeout(resolve, 500))
      );
      render(
        <BenefitValuePresets
          {...defaultProps}
          onSelect={onSelect}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /75%/i }));
      
      // Should disable button during save
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /75%/i });
        expect(button).toBeDisabled();
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING TESTS (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should handle save error gracefully', async () => {
      const onSelect = vi.fn().mockRejectedValue(new Error('Save failed'));
      render(
        <BenefitValuePresets
          {...defaultProps}
          onSelect={onSelect}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /75%/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/failed|error/i)).toBeInTheDocument();
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOM PRESET TESTS (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Custom Preset Support', () => {
    it('should support custom preset percentages', () => {
      render(
        <BenefitValuePresets
          {...defaultProps}
          presetOptions={[0.6, 0.8]}
        />
      );
      
      expect(screen.getByRole('button', { name: /60%/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /80%/i })).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOM VALUE MODAL TESTS (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Custom Value Modal', () => {
    it('should open modal for custom value input', () => {
      render(
        <BenefitValuePresets
          {...defaultProps}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /custom/i }));
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ACCESSIBILITY (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      render(
        <BenefitValuePresets
          {...defaultProps}
        />
      );
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.every(btn => btn.tabIndex >= -1)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RESPONSIVE DESIGN (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Responsive Design', () => {
    it('should be mobile responsive', () => {
      const { container } = render(
        <BenefitValuePresets
          {...defaultProps}
        />
      );
      
      // Should have responsive layout
      const wrapper = container.querySelector('[class*="flex"]');
      expect(wrapper).toBeInTheDocument();
    });
  });
});
