/**
 * MarkBenefitUsedModal Component
 *
 * Modal for marking a benefit as used with claiming validation.
 * Features:
 * - Show remaining amount after claim
 * - Display error if exceeds period limit
 * - Show success message with claiming info
 * - Integration with POST /api/benefits/usage endpoint
 * - Shows ClaimingLimitInfo subcomponent
 * - Form validation
 * - Loading states
 *
 * @example
 * <MarkBenefitUsedModal
 *   isOpen={true}
 *   onClose={() => {}}
 *   benefitId="benefit-123"
 *   benefitName="Uber Cash"
 * />
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Button from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { FormError } from '@/shared/components/forms';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import { ClaimingLimitInfo } from './ClaimingLimitInfo';
import { ClaimingLimitsInfo } from '@/lib/claiming-validation';

interface MarkBenefitUsedModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBenefitId: string;  // Changed from benefitId to match API
  userCardId: string;     // Added to match API requirements
  benefitName: string;
  cardName?: string;
  onBenefitMarked?: (result: any) => void;
}

interface ClaimingState {
  claimAmount: string;
  claimDate: string;
  notes: string;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  details?: Record<string, any>;
}

/**
 * MarkBenefitUsedModal - Main component
 */
export function MarkBenefitUsedModal({
  isOpen,
  onClose,
  userBenefitId,
  userCardId,
  benefitName,
  cardName,
  onBenefitMarked,
}: MarkBenefitUsedModalProps) {
  // Form state
  const [formData, setFormData] = useState<ClaimingState>({
    claimAmount: '',
    claimDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLimits, setLoadingLimits] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [generalError, setGeneralError] = useState('');

  // Claiming limits data
  const [claimingLimits, setClaimingLimits] = useState<ClaimingLimitsInfo | null>(null);

  /**
   * Fetch claiming limits on mount
   */
  useEffect(() => {
    if (!isOpen || !userBenefitId) return;

    const fetchLimits = async () => {
      try {
        setLoadingLimits(true);
        setGeneralError('');

        const response = await fetch(`/api/benefits/claiming-limits?userBenefitId=${userBenefitId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch claiming limits');
        }

        const data = await response.json();

        if (data.success && data.data) {
          setClaimingLimits(data.data);
        } else {
          setGeneralError(data.error || 'Failed to load claiming information');
        }
      } catch (error) {
        console.error('Error fetching claiming limits:', error);
        setGeneralError(
          error instanceof Error ? error.message : 'Failed to load benefit information'
        );
      } finally {
        setLoadingLimits(false);
      }
    };

    fetchLimits();
  }, [isOpen, userBenefitId]);

  /**
   * Handle form field changes
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  /**
   * Validate form inputs
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate claim amount
    if (!formData.claimAmount.trim()) {
      newErrors.claimAmount = 'Claim amount is required';
    } else {
      const amountNum = parseFloat(formData.claimAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        newErrors.claimAmount = 'Claim amount must be a positive number';
      } else if (amountNum > 99999.99) {
        newErrors.claimAmount = 'Claim amount is too large';
      } else if (!Number.isInteger(amountNum * 100)) {
        // Validate amount is in whole cents (e.g., 15.00, 15.25, NOT 15.333)
        newErrors.claimAmount = 'Claim amount must be in whole cents (e.g., $15.00, $15.25)';
      }

      // Check against remaining limit
      if (claimingLimits && amountNum * 100 > claimingLimits.remainingAmount) {
        newErrors.claimAmount = `Amount exceeds remaining limit of $${(claimingLimits.remainingAmount / 100).toFixed(2)}`;
      }
    }

    // Validate claim date
    if (!formData.claimDate) {
      newErrors.claimDate = 'Claim date is required';
    } else {
      const claimDate = new Date(formData.claimDate);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - claimDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 90) {
        newErrors.claimDate = 'Cannot claim benefits more than 90 days in the past';
      }
      if (daysDiff < -1) {
        newErrors.claimDate = 'Claim date cannot be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, claimingLimits]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      try {
        setIsLoading(true);
        setGeneralError('');
        setSuccessMessage('');

        // Parse claim amount as dollars (API expects dollars, converts to cents internally)
        const claimAmountDollars = parseFloat(formData.claimAmount);

        // Prepare request payload matching API expectations
        const payload = {
          userBenefitId,
          userCardId,
          usageAmount: claimAmountDollars,  // In dollars (API converts to cents)
          usageDate: new Date(formData.claimDate).toISOString(),
          notes: formData.notes || undefined,
        };

        // Call API
        const response = await fetch('/api/benefits/usage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data: ApiResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              data.details?.message ||
              'Failed to mark benefit as used'
          );
        }

        // Success
        const claimAmountCents = Math.round(claimAmountDollars * 100);
        const remainingAfter = claimingLimits
          ? claimingLimits.remainingAmount - claimAmountCents
          : 0;

        setSuccessMessage(
          `✅ Claim recorded! ${formData.claimAmount} claimed.${
            remainingAfter > 0
              ? ` $${(remainingAfter / 100).toFixed(2)} remaining for ${claimingLimits?.periodLabel || 'this period'}.`
              : ' You have fully used this period\'s limit.'
          }`
        );

        // Reset form
        setFormData({
          claimAmount: '',
          claimDate: new Date().toISOString().split('T')[0],
          notes: '',
        });

        // Call callback
        if (onBenefitMarked) {
          onBenefitMarked(data.data);
        }

        // Close after delay
        setTimeout(() => {
          onClose();
        }, 2000);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'An error occurred';
        setGeneralError(errorMsg);
        console.error('Error marking benefit as used:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [userBenefitId, userCardId, formData, claimingLimits, onClose, onBenefitMarked, validateForm]
  );

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    // Reset state
    setFormData({
      claimAmount: '',
      claimDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setErrors({});
    setSuccessMessage('');
    setGeneralError('');
    onClose();
  }, [onClose]);

  // Format cents to dollars for display
  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70" />

        <FocusTrap>
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white dark:bg-gray-900 shadow-lg duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Mark Benefit Used
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {benefitName}
                {cardName && ` • ${cardName}`}
              </p>
            </div>

            <DialogPrimitive.Close asChild>
              <button
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* General error */}
            {generalError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <span className="font-semibold">Error:</span> {generalError}
                </p>
              </div>
            )}

            {/* Success message */}
            {successMessage && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-3">
                <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
              </div>
            )}

            {/* Loading state */}
            {loadingLimits ? (
              <div className="space-y-4">
                <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              </div>
            ) : claimingLimits ? (
              <>
                {/* Claiming Limits Info */}
                <ClaimingLimitInfo
                  limits={claimingLimits}
                  showBoundaries={true}
                  compact={false}
                />

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {/* Claim Amount */}
                  <div>
                    <label htmlFor="claimAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Claim Amount (USD) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <Input
                        id="claimAmount"
                        name="claimAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        max="99999.99"
                        placeholder="0.00"
                        value={formData.claimAmount}
                        onChange={handleChange}
                        className="pl-7"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.claimAmount && (
                      <FormError 
                        message={errors.claimAmount} 
                        type="error" 
                        category="validation"
                        fieldName="claimAmount"
                      />
                    )}
                    {claimingLimits && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Max available: {formatCurrency(claimingLimits.remainingAmount)}
                      </p>
                    )}
                  </div>

                  {/* Claim Date */}
                  <div>
                    <label htmlFor="claimDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Claim Date *
                    </label>
                    <Input
                      id="claimDate"
                      name="claimDate"
                      type="date"
                      value={formData.claimDate}
                      onChange={handleChange}
                      disabled={isLoading}
                    />
                    {errors.claimDate && (
                      <FormError 
                        message={errors.claimDate} 
                        type="error" 
                        category="validation"
                        fieldName="claimDate"
                      />
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Must be within 90 days
                    </p>
                  </div>

                  {/* Notes (optional) */}
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      placeholder="e.g., Paid for Uber ride on Apr 15"
                      rows={3}
                      disabled={isLoading}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                    />
                  </div>
                </form>
              </>
            ) : (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ This benefit is not configured for claiming limits. Contact support.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex gap-3 justify-end">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !claimingLimits}
              variant="primary"
              className="px-4 py-2 text-sm font-medium"
            >
              {isLoading ? 'Submitting...' : 'Mark Used'}
            </Button>
          </div>
        </DialogPrimitive.Content>
        </FocusTrap>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default MarkBenefitUsedModal;
