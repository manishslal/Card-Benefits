/**
 * EditBenefitModal Component (Admin)
 * 
 * Allows admins to edit benefit details (master benefits).
 * - Pre-fills form with existing benefit data
 * - Editable fields: name, type, stickerValue, resetCadence
 * - Validates form inputs
 * - API call: PATCH /api/admin/benefits/{benefitId}
 * - Handles currency conversion (dollars <-> cents)
 * - Displays errors via FormError component
 * - Closes on success
 */

'use client';

import { useState, useEffect } from 'react';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import { formatCurrency, parseCurrency } from '@/shared/lib/format-currency';
import { FormError } from '@/shared/components/forms';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { Benefit } from '@/features/admin/types/admin';

interface EditBenefitModalProps {
  benefit: Benefit | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditBenefitModal({
  benefit,
  isOpen,
  onClose,
  onSaved,
}: EditBenefitModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    stickerValue: '',
    resetCadence: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Pre-fill form when benefit data arrives
  // VALID_TYPES defines all allowed benefit type values for validation
  const VALID_TYPES = ['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER'];
  
  useEffect(() => {
    if (isOpen && benefit) {
      // Validate that benefit.type is one of the valid enum values
      // If type is invalid, default to empty string so user sees "Select a type"
      const typeValue = benefit.type && VALID_TYPES.includes(benefit.type) ? benefit.type : '';
      
      setFormData({
        name: benefit.name || '',
        type: typeValue,
        stickerValue: formatCurrency(benefit.stickerValue, false), // Display as "500.00"
        resetCadence: benefit.resetCadence || '',
      });
      setFieldErrors({});
      setFormError(null);
    }
  }, [isOpen, benefit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): Record<string, string> => {
    const VALID_TYPES = ['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER'];
    const errors: Record<string, string> = {};

    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Name is required';
    } else if (formData.name.length > 200) {
      errors.name = 'Name must be 200 characters or less';
    }

    // Validate type: must be non-empty and match one of the valid enum values
    if (!formData.type) {
      errors.type = 'Type is required';
    } else if (!VALID_TYPES.includes(formData.type)) {
      errors.type = 'Invalid type selected';
    }

    if (!formData.stickerValue) {
      errors.stickerValue = 'Sticker value is required';
    } else {
      const cents = parseCurrency(formData.stickerValue);
      if (cents < 0) {
        errors.stickerValue = 'Value cannot be negative';
      }
    }

    if (!formData.resetCadence) {
      errors.resetCadence = 'Reset cadence is required';
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      // Validate form
      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setIsSubmitting(false);
        return;
      }

      if (!benefit) {
        setFormError('Benefit not found');
        setIsSubmitting(false);
        return;
      }

      // Convert stickerValue from dollars to cents
      const stickerValueCents = parseCurrency(formData.stickerValue);

      // PATCH /api/admin/benefits/{benefit.id}
      const response = await apiClient.patch(`/benefits/${benefit.id}`, {
        name: formData.name.trim(),
        type: formData.type,
        stickerValue: stickerValueCents,
        resetCadence: formData.resetCadence,
      });

      if (response.success) {
        onSaved();
      } else {
        setFormError(response.error || 'Failed to update benefit');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !benefit) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <div className="flex items-center justify-between mb-4">
            <DialogPrimitive.Title className="text-2xl font-bold text-slate-900 dark:text-white">
              Edit Benefit
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Close dialog"
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={24} />
              </button>
            </DialogPrimitive.Close>
          </div>

          {formError && (
            <FormError message={formError} />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                maxLength={200}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                placeholder="Benefit name"
              />
              {fieldErrors.name && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.name}</p>
              )}
            </div>

            {/* Type field */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Type *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
              >
                <option value="">Select a type</option>
                <option value="INSURANCE">Insurance</option>
                <option value="CASHBACK">Cashback</option>
                <option value="TRAVEL">Travel</option>
                <option value="BANKING">Banking</option>
                <option value="POINTS">Points</option>
                <option value="OTHER">Other</option>
              </select>
              {fieldErrors.type && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.type}</p>
              )}
            </div>

            {/* Sticker Value field (in dollars) */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Sticker Value ($) *
              </label>
              <input
                type="text"
                name="stickerValue"
                value={formData.stickerValue}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                placeholder="500.00"
              />
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Enter amount in dollars (e.g., 500.00)
              </p>
              {fieldErrors.stickerValue && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.stickerValue}</p>
              )}
            </div>

            {/* Reset Cadence field */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Reset Cadence *
              </label>
              <select
                name="resetCadence"
                value={formData.resetCadence}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
              >
                <option value="">Select a cadence</option>
                <option value="ANNUAL">Annual</option>
                <option value="PER_TRANSACTION">Per Transaction</option>
                <option value="PER_DAY">Per Day</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ONE_TIME">One Time</option>
              </select>
              {fieldErrors.resetCadence && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.resetCadence}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
