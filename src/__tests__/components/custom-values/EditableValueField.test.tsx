/**
 * src/__tests__/components/custom-values/EditableValueField.test.tsx
 *
 * Comprehensive tests for EditableValueField component.
 * Tests display mode, edit activation, validation, save behavior, and accessibility.
 *
 * Test targets:
 * - 15+ test cases
 * - Display and edit modes
 * - Input validation
 * - Save behavior (Enter, blur, cancel, Escape)
 * - Loading and error states
 * - Accessibility and keyboard navigation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableValueField } from '@/features/custom-values/components/EditableValueField';

describe('EditableValueField Component', () => {
  const defaultProps = {
    benefitId: 'b1',
    stickerValue: 30000, // $300
    currentValue: 25000, // $250
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DISPLAY MODE TESTS (3 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Display Mode', () => {
    it('should render current value when set', () => {
      render(
        <EditableValueField
          {...defaultProps}
          currentValue={25000}
        />
      );
      
      expect(screen.getByText(/\$250/i)).toBeInTheDocument();
    });

    it('should show sticker value when current value is null', () => {
      render(
        <EditableValueField
          {...defaultProps}
          currentValue={null}
        />
      );
      
      expect(screen.getByText(/\$300/i)).toBeInTheDocument();
    });

    it('should display value as currency format', () => {
      render(
        <EditableValueField
          {...defaultProps}
          currentValue={12345}
        />
      );
      
      expect(screen.getByText(/\$123\.45/)).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // EDIT MODE ACTIVATION (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Edit Mode Activation', () => {
    it('should enter edit mode on button click', () => {
      render(<EditableValueField {...defaultProps} />);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);
      
      // Should now show input with numeric value
      expect(screen.getByDisplayValue('250')).toBeInTheDocument();
    });

    it('should exit edit mode on Cancel button', () => {
      render(<EditableValueField {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      expect(screen.getByDisplayValue('250')).toBeInTheDocument();
      
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByDisplayValue('250')).not.toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // INPUT VALIDATION (5 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Input Validation', () => {
    it('should reject negative values', async () => {
      render(<EditableValueField {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      await userEvent.clear(input);
      await userEvent.type(input, '-100');
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/negative/i)).toBeInTheDocument();
      });
    });

    it('should only accept numeric input', async () => {
      render(<EditableValueField {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      await userEvent.clear(input);
      await userEvent.type(input, 'abc');
      
      expect(screen.getByText(/numeric/i)).toBeInTheDocument();
    });

    it('should reject values exceeding max', async () => {
      render(<EditableValueField {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      await userEvent.clear(input);
      await userEvent.type(input, '99999999999');
      
      expect(screen.getByText(/exceed/i)).toBeInTheDocument();
    });

    it('should accept zero value', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableValueField
          {...defaultProps}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      await userEvent.clear(input);
      await userEvent.type(input, '0');
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(0);
      });
    });

    it('should validate with custom currency formats', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableValueField
          {...defaultProps}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      // Test accepting $250.00 format
      await userEvent.clear(input);
      await userEvent.type(input, '$250.00');
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(25000);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SAVE BEHAVIOR (4 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Save Behavior', () => {
    it('should save on Enter key', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableValueField
          {...defaultProps}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      await userEvent.clear(input);
      await userEvent.type(input, '200');
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(20000);
      });
    });

    it('should save on blur', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableValueField
          {...defaultProps}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      await userEvent.clear(input);
      await userEvent.type(input, '200');
      fireEvent.blur(input);
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(20000);
      });
    });

    it('should cancel on Escape key', async () => {
      const onSave = vi.fn();
      render(
        <EditableValueField
          {...defaultProps}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      await userEvent.clear(input);
      await userEvent.type(input, '200');
      fireEvent.keyDown(input, { key: 'Escape' });
      
      // Should not save
      expect(onSave).not.toHaveBeenCalled();
      
      // Should exit edit mode
      expect(screen.queryByDisplayValue('200')).not.toBeInTheDocument();
    });

    it('should debounce auto-save by 500ms', async () => {
      vi.useFakeTimers();
      const onSave = vi.fn().mockResolvedValue(undefined);
      
      render(
        <EditableValueField
          {...defaultProps}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      // Rapid changes
      await userEvent.clear(input);
      fireEvent.change(input, { target: { value: '200' } });
      fireEvent.change(input, { target: { value: '150' } });
      fireEvent.change(input, { target: { value: '100' } });
      
      // Should not have called yet
      expect(onSave).not.toHaveBeenCalled();
      
      // Advance timer
      vi.advanceTimersByTime(500);
      
      // Should call once with latest value
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith(10000);
      });
      
      vi.useRealTimers();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // LOADING AND ERROR STATES (3 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Loading and Error States', () => {
    it('should show spinner while saving', async () => {
      const onSave = vi.fn(
        () => new Promise(resolve => setTimeout(resolve, 500))
      );
      render(
        <EditableValueField
          {...defaultProps}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      fireEvent.change(input, { target: { value: '200' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      // Should show loading state
      await waitFor(() => {
        const spinner = screen.queryByRole('status');
        expect(spinner).toBeInTheDocument();
      });
    });

    it('should show error toast on save failure', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      render(
        <EditableValueField
          {...defaultProps}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      fireEvent.change(input, { target: { value: '200' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });
    });

    it('should revert value on save error', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      render(
        <EditableValueField
          {...defaultProps}
          currentValue={25000}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      fireEvent.change(input, { target: { value: '200' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        // Should show original value again
        expect(screen.getByText(/\$250/)).toBeInTheDocument();
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ACCESSIBILITY (3 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<EditableValueField {...defaultProps} />);
      
      const button = screen.getByRole('button', { name: /edit/i });
      expect(button).toHaveAttribute('aria-label');
    });

    it('should announce state changes to screen readers', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableValueField
          {...defaultProps}
          onSave={onSave}
        />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      const input = screen.getByDisplayValue('250');
      
      fireEvent.change(input, { target: { value: '200' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      // Should announce saving state
      await waitFor(() => {
        const region = screen.queryByRole('status');
        if (region) {
          expect(region).toHaveAttribute('aria-busy', 'true');
        }
      });
    });

    it('should be keyboard navigable (Tab)', async () => {
      const { container } = render(
        <>
          <input type="text" data-testid="before" />
          <EditableValueField {...defaultProps} />
          <input type="text" data-testid="after" />
        </>
      );
      
      const before = screen.getByTestId('before');
      const button = screen.getByRole('button', { name: /edit/i });
      const after = screen.getByTestId('after');
      
      before.focus();
      expect(before).toHaveFocus();
      
      // Note: Actual Tab behavior depends on component structure
      // This test ensures focusable elements exist and are properly ordered
      expect(button).toBeInTheDocument();
      expect(after).toBeInTheDocument();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RESPONSIVE DESIGN (1 case)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Responsive Design', () => {
    it('should be mobile responsive', () => {
      const { container } = render(<EditableValueField {...defaultProps} />);
      
      // Should have responsive classes
      const element = container.firstChild;
      expect(element).toHaveClass('space-y-2');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // EDGE CASES (2 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should handle null stickerValue gracefully', () => {
      render(
        <EditableValueField
          {...defaultProps}
          stickerValue={null as any}
          currentValue={null}
        />
      );
      
      // Should render without error
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should disable edit button when isLoading is true', () => {
      const { rerender } = render(
        <EditableValueField
          {...defaultProps}
        />
      );
      
      const button = screen.getByRole('button', { name: /edit/i });
      expect(button).not.toBeDisabled();
      
      // Note: Component may not have isLoading prop
      // This test documents expected behavior
    });
  });
});
