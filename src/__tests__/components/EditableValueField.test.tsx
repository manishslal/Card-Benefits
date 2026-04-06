/**
 * src/__tests__/components/EditableValueField.test.tsx
 * 
 * Comprehensive unit tests for EditableValueField component
 * Tests click-to-edit, validation, saving, keyboard navigation, and error handling
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditableValueField } from '@/features/custom-values/components';
import * as customValuesActions from '@/features/custom-values';

// Mock the useToast hook
const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('@/shared/components/ui/use-toast', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

describe('EditableValueField Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display Mode - Initial Rendering', () => {
    it('should render current and master values in display mode', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      expect(screen.getByText(/Current:/i)).toBeInTheDocument();
      expect(screen.getByText(/\$250\.00/)).toBeInTheDocument();
      expect(screen.getByText(/Master:/i)).toBeInTheDocument();
      expect(screen.getByText(/\$300\.00/)).toBeInTheDocument();
    });

    it('should show Edit Value button', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const button = screen.getByRole('button', { name: /Edit benefit value/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('should display difference when custom value differs from master', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      expect(screen.getByText(/Difference:/i)).toBeInTheDocument();
      expect(screen.getByText(/-\$50\.00/)).toBeInTheDocument();
      expect(screen.getByText(/-16\.7%/)).toBeInTheDocument();
    });

    it('should not display difference when values are equal', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={30000}
          masterValue={30000}
        />
      );

      expect(screen.queryByText(/Difference:/i)).not.toBeInTheDocument();
    });

    it('should format currency with proper precision', () => {
      const { rerender } = render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={1}
          masterValue={100}
        />
      );

      expect(screen.getByText(/\$0\.01/)).toBeInTheDocument();

      rerender(
        <EditableValueField
          benefitId="ben-123"
          currentValue={123456}
          masterValue={100}
        />
      );

      expect(screen.getByText(/\$1,234\.56/)).toBeInTheDocument();
    });

    it('should show positive difference in blue', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={40000}
          masterValue={30000}
        />
      );

      const diffElement = screen.getByText(/Difference:/i).closest('div');
      expect(diffElement).toHaveClass('text-blue-600');
    });

    it('should show negative difference in orange', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const diffElement = screen.getByText(/Difference:/i).closest('div');
      expect(diffElement).toHaveClass('text-orange-600');
    });
  });

  describe('Edit Mode Toggle', () => {
    it('should enter edit mode when Edit Value button clicked', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      expect(screen.getByRole('textbox', { name: /New benefit value/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('should focus input field automatically on edit mode entry', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      await waitFor(() => {
        const input = screen.getByRole('textbox', { name: /New benefit value/i });
        expect(input).toHaveFocus();
      });
    });

    it('should populate input with current value formatted as dollars', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i }) as HTMLInputElement;
      expect(input.value).toBe('250.00');
    });

    it('should exit edit mode when Cancel button clicked', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await userEvent.click(cancelButton);

      expect(screen.getByRole('button', { name: /Edit benefit value/i })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /New benefit value/i })).not.toBeInTheDocument();
    });

    it('should clear validation warning when exiting edit mode', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '500');  // High value warning

      await waitFor(() => {
        expect(screen.getByText(/This value seems very high/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await userEvent.click(cancelButton);

      expect(screen.queryByText(/This value seems very high/i)).not.toBeInTheDocument();
    });
  });

  describe('Input Validation', () => {
    it('should accept various currency input formats', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });

      const validFormats = ['$250', '250', '250.00', '250.5'];

      for (const format of validFormats) {
        await userEvent.clear(input);
        await userEvent.type(input, format);

        await waitFor(() => {
          expect(screen.queryByText(/invalid|Invalid/i)).not.toBeInTheDocument();
        });
      }
    });

    it('should show warning for unusually high values (>150% of master)', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '500');  // 500% of $300

      await waitFor(() => {
        expect(screen.getByText(/This value seems very high/i)).toBeInTheDocument();
      });
    });

    it('should show warning for unusually low values (<10% of master)', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '2');  // 2% of $300

      await waitFor(() => {
        expect(screen.getByText(/This value seems very low/i)).toBeInTheDocument();
      });
    });

    it('should show error and revert on invalid input blur', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, 'invalid');

      await userEvent.tab();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Invalid Value',
          expect.stringContaining('valid')
        );
        // Should revert to display mode
        expect(screen.getByRole('button', { name: /Edit benefit value/i })).toBeInTheDocument();
      });
    });

    it('should allow zero value', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '0');

      // Zero is valid, should not show invalid message
      expect(screen.queryByText(/Invalid/i)).not.toBeInTheDocument();
    });

    it('should show master value reminder in edit mode', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      expect(screen.getByText(/Master value:/i)).toBeInTheDocument();
      expect(screen.getByText(/\$300\.00/)).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should call server action with correct benefit ID and value', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockImplementation(mockUpdate);

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '350');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith('ben-123', 35000);
      });
    });

    it('should update display value after successful save', async () => {
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockResolvedValue({ success: true });

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '350');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/\$350\.00/)).toBeInTheDocument();
      });
    });

    it('should show success toast after save', async () => {
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockResolvedValue({ success: true });

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '350');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith('Value updated successfully');
      });
    });

    it('should revert display value if server returns error', async () => {
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '350');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        // Should revert to original value
        expect(screen.getByText(/\$250\.00/)).toBeInTheDocument();
        expect(mockError).toHaveBeenCalledWith('Update Failed', 'Database error');
      });
    });

    it('should call onSave callback after successful save', async () => {
      const mockOnSave = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockResolvedValue({ success: true });

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
          onSave={mockOnSave}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '350');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(35000);
      });
    });

    it('should disable Save button and show Saving state while saving', async () => {
      const savePromise = new Promise((resolve) =>
        setTimeout(() => resolve({ success: true }), 200)
      );

      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockReturnValue(
        savePromise as any
      );

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '350');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      expect(saveButton).toBeDisabled();
      expect(screen.getByRole('button', { name: /Saving/i })).toBeInTheDocument();
    });

    it('should prevent double-click saves', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockImplementation(mockUpdate);

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '350');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      
      // Click multiple times quickly
      fireEvent.click(saveButton);
      fireEvent.click(saveButton);
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Should only call once despite multiple clicks
        expect(mockUpdate).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should save on Enter key press', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockImplementation(mockUpdate);

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.type(input, '350');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
    });

    it('should cancel on Escape key press', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.type(input, '350');
      await userEvent.keyboard('{Escape}');

      // Should exit edit mode
      expect(screen.getByRole('button', { name: /Edit benefit value/i })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /New benefit value/i })).not.toBeInTheDocument();
    });

    it('should trigger save on blur/Tab away', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockImplementation(mockUpdate);

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.type(input, '350');
      
      // Simulate blur by tabbing away
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Confirmation Dialog for High Values', () => {
    it('should show confirmation dialog for values >150% of master', async () => {
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockResolvedValue({ success: true });

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '500');

      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/Confirm High Value/i)).toBeInTheDocument();
      });
    });

    it('should save after confirming high value', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockImplementation(mockUpdate);

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '500');

      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/Confirm High Value/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /Confirm/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith('ben-123', 50000);
      });
    });

    it('should cancel confirmation without saving', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockImplementation(mockUpdate);

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '500');

      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/Confirm High Value/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getAllByRole('button', { name: /Cancel/i })[0];
      await userEvent.click(cancelButton);

      // Dialog should close, stay in edit mode
      expect(screen.queryByText(/Confirm High Value/i)).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /New benefit value/i })).toBeInTheDocument();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable edit button when disabled prop is true', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
          disabled={true}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      expect(editButton).toBeDisabled();
    });

    it('should disable edit button when isLoading prop is true', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
          isLoading={true}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      expect(editButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      expect(editButton).toHaveAttribute('aria-label');

      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      expect(input).toHaveAttribute('aria-label');
    });

    it('should link validation warning with aria-describedby', async () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '500');  // High value

      await waitFor(() => {
        const warning = screen.getByText(/This value seems very high/i);
        expect(warning).toBeInTheDocument();
        
        // Input should have aria-describedby pointing to warning
        const warningId = warning.id;
        expect(input).toHaveAttribute('aria-describedby', warningId);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero sticker value gracefully', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={0}
          masterValue={0}
        />
      );

      expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
      expect(screen.queryByText(/Difference:/i)).not.toBeInTheDocument();
    });

    it('should handle very large values', () => {
      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={999999999}
          masterValue={999999999}
        />
      );

      expect(screen.getByText(/\$9,999,999\.99/)).toBeInTheDocument();
    });

    it('should handle null onSave callback gracefully', async () => {
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockResolvedValue({ success: true });

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
          onSave={undefined}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      await userEvent.clear(input);
      await userEvent.type(input, '350');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalled();
        // Should not throw error
      });
    });

    it('should handle no value change (same as current)', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(customValuesActions, 'updateUserDeclaredValue').mockImplementation(mockUpdate);

      render(
        <EditableValueField
          benefitId="ben-123"
          currentValue={25000}
          masterValue={30000}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit benefit value/i });
      await userEvent.click(editButton);

      const input = screen.getByRole('textbox', { name: /New benefit value/i });
      // Don't change the value, just blur/save
      fireEvent.blur(input);

      await waitFor(() => {
        // Should exit edit mode without calling server action
        expect(screen.getByRole('button', { name: /Edit benefit value/i })).toBeInTheDocument();
        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });
  });
});
