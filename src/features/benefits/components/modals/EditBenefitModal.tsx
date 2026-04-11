'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { UnifiedSelect } from '@/shared/components/ui/select-unified';
import { FormError } from '@/shared/components/forms';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Lock, Info, Trash2, Undo2 } from 'lucide-react';

/**
 * EditBenefitModal Component
 * 
 * Allows users to edit benefit details
 * 
 * When a benefit is engine-managed (has `masterBenefitId`):
 * - name, resetCadence, and expirationDate are read-only
 * - Only userDeclaredValue (personal valuation) remains editable
 * - An informational message explains why fields are locked
 * 
 * When a benefit is legacy (no `masterBenefitId`):
 * - All fields remain editable as before
 * 
 * Props:
 * - benefit: UserBenefit object with current values
 * - isOpen: boolean - whether modal is visible
 * - onClose: () => void - callback when user closes modal
 * - onBenefitUpdated: (benefit) => void - callback when benefit is successfully updated
 */

interface UserBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  expirationDate: Date | string | null;
  masterBenefitId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  isUsed?: boolean;
  claimedAt?: string | null;
}

interface EditBenefitModalProps {
  benefit: UserBenefit | null;
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Callback receives partial API response merged into state
  onBenefitUpdated?: (benefit: any) => void;
  onBenefitDeleted?: (benefitId: string) => void;
}

export function EditBenefitModal({
  benefit,
  isOpen,
  onClose,
  onBenefitUpdated,
  onBenefitDeleted,
}: EditBenefitModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    userDeclaredValue: '',
    expirationDate: '',
    resetCadence: '',
    claimedAt: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingUnused, setIsMarkingUnused] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState('');

  // Pre-fill form when benefit data arrives
  useEffect(() => {
    if (isOpen && benefit) {
      const expirationDate = benefit.expirationDate
        ? benefit.expirationDate instanceof Date
          ? benefit.expirationDate.toISOString().split('T')[0]
          : typeof benefit.expirationDate === 'string'
          ? benefit.expirationDate.split('T')[0]
          : ''
        : '';

      const userDeclaredValue = benefit.userDeclaredValue != null
        ? (benefit.userDeclaredValue / 100).toFixed(2)
        : '';

      // Pre-fill claimedAt — default to today if benefit is used and no claimedAt exists
      let claimedAt = '';
      if (benefit.claimedAt) {
        claimedAt = typeof benefit.claimedAt === 'string'
          ? benefit.claimedAt.split('T')[0]
          : '';
      } else if (benefit.isUsed) {
        claimedAt = new Date().toISOString().split('T')[0];
      }

      setFormData({
        name: benefit.name || '',
        userDeclaredValue,
        expirationDate,
        resetCadence: benefit.resetCadence || '',
        claimedAt,
      });
      setErrors({});
      setMessage('');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, benefit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const isEngineManaged = !!benefit?.masterBenefitId;

    // Name validation — skip for engine-managed benefits (read-only)
    if (!isEngineManaged) {
      if (!formData.name || formData.name.trim().length === 0) {
        newErrors.name = 'Benefit name is required';
      } else if (formData.name.length > 100) {
        newErrors.name = 'Benefit name must be 100 characters or less';
      }
    }

    if (formData.userDeclaredValue) {
      const declaredValue = parseFloat(formData.userDeclaredValue);
      if (isNaN(declaredValue) || declaredValue < 0) {
        newErrors.userDeclaredValue = 'User declared value must be a non-negative number';
      } else if (benefit && declaredValue > (benefit.stickerValue / 100)) {
        newErrors.userDeclaredValue = 'User declared value cannot exceed sticker value';
      }
    }

    // Expiration date validation — skip for engine-managed benefits (read-only)
    if (!isEngineManaged && formData.expirationDate) {
      const date = new Date(formData.expirationDate);
      if (isNaN(date.getTime())) {
        newErrors.expirationDate = 'Invalid date format';
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) {
          newErrors.expirationDate = 'Expiration date must be in the future';
        }
      }
    }

    // Reset cadence validation — skip for engine-managed benefits (read-only)
    if (!isEngineManaged && !formData.resetCadence) {
      newErrors.resetCadence = 'Reset cadence is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !benefit) return;

    setIsLoading(true);
    setMessage('');

    const isEngineManaged = !!benefit.masterBenefitId;

    try {
      // Convert values to cents
      const userDeclaredValue = formData.userDeclaredValue
        ? Math.round(parseFloat(formData.userDeclaredValue) * 100)
        : null;

      // When engine-managed, only send editable fields (userDeclaredValue + claimedAt)
      const patchBody = isEngineManaged
        ? {
            userDeclaredValue,
            claimedAt: formData.claimedAt || null,
          }
        : {
            name: formData.name.trim(),
            userDeclaredValue,
            expirationDate: formData.expirationDate || null,
            resetCadence: formData.resetCadence,
            claimedAt: formData.claimedAt || null,
          };

      const response = await fetch(`/api/benefits/${benefit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patchBody),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
        }
        setMessage(data.error || 'Failed to update benefit');
        return;
      }

      // Success
      setMessage('✓ Benefit updated successfully');
      setErrors({});

      if (onBenefitUpdated) {
        onBenefitUpdated(data.benefit);
      }

      // Close modal after 500ms to show success message
      setTimeout(onClose, 500);
    } catch (error) {
      console.error('Error updating benefit:', error);
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Delete benefit
  const handleDelete = async () => {
    if (!benefit) return;

    setIsDeleting(true);
    setMessage('');

    try {
      const response = await fetch(`/api/benefits/${benefit.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        setMessage(data.error || 'Failed to delete benefit');
        return;
      }

      if (onBenefitDeleted) {
        onBenefitDeleted(benefit.id);
      }
      onClose();
    } catch (error) {
      console.error('Error deleting benefit:', error);
      setMessage('Failed to delete benefit. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler: Mark benefit as unused
  const handleMarkUnused = async () => {
    if (!benefit) return;

    setIsMarkingUnused(true);
    setMessage('');

    try {
      const response = await fetch(`/api/benefits/${benefit.id}/toggle-used`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isUsed: false }),
      });

      if (!response.ok) {
        const data = await response.json();
        setMessage(data.error || 'Failed to mark benefit as unused');
        return;
      }

      const data = await response.json();
      setMessage('✓ Benefit marked as unused');

      if (onBenefitUpdated && data.benefit) {
        // Explicitly ensure isUsed/claimedAt are correct even if API returns partial data
        onBenefitUpdated({ ...data.benefit, isUsed: false, claimedAt: null });
      }

      setTimeout(onClose, 500);
    } catch (error) {
      console.error('Error marking benefit as unused:', error);
      setMessage('Failed to mark as unused. Please try again.');
    } finally {
      setIsMarkingUnused(false);
    }
  };

  if (!isOpen || !benefit) return null;

  const isEngineManaged = !!benefit.masterBenefitId;

  const cadenceOptions = [
    { value: 'Monthly', label: 'Monthly' },
    { value: 'CalendarYear', label: 'Calendar Year' },
    { value: 'CardmemberYear', label: 'Cardmember Year' },
    { value: 'OneTime', label: 'One Time' },
  ];

  const stickerValueInDollars = (benefit.stickerValue / 100).toFixed(2);

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[30] bg-black/50" />
        
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-[40] w-full max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <DialogPrimitive.Title className="text-2xl font-bold text-[var(--color-text)] mb-2">
            Edit Benefit
          </DialogPrimitive.Title>

          <DialogPrimitive.Description className="text-sm text-[var(--color-text-secondary)] mb-6">
            Update benefit details
          </DialogPrimitive.Description>

          {/* Close button */}
          <div className="absolute top-4 right-4">
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Close dialog"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors p-2 rounded-md hover:bg-[var(--color-bg-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <X size={24} />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Message */}
          {message && (
            <FormError
              message={message.replace(/^✓\s*/, '')}
              type={message.startsWith('✓') ? 'success' : 'error'}
            />
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Engine-managed info banner */}
            {isEngineManaged && (
              <div
                className="flex items-start gap-3 p-3 rounded-md border"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border)',
                }}
                role="note"
                aria-label="Catalog-managed benefit notice"
              >
                <Info
                  size={18}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-hidden="true"
                />
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  This benefit is managed by the card catalog. Only your personal value estimate can be edited.
                </p>
              </div>
            )}

            {/* Benefit Name — conditionally read-only for engine-managed benefits */}
            {isEngineManaged ? (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  <span className="flex items-center gap-1.5">
                    Benefit Name
                    <Lock size={14} className="opacity-60" aria-hidden="true" />
                    <span className="text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                      (managed by catalog)
                    </span>
                  </span>
                </label>
                <div
                  className="p-3 rounded-md opacity-60 cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text)',
                  }}
                  aria-disabled="true"
                  aria-label={`Benefit name: ${benefit.name}`}
                >
                  {benefit.name}
                </div>
              </div>
            ) : (
              <Input
                id="edit-benefit-field-3"
                label="Benefit Name"
                type="text"
                name="name"
                placeholder="e.g., 'Uber Cash'"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                disabled={isLoading}
                required
              />
            )}

            {/* Read-Only: Benefit Type */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Benefit Type
              </label>
              <div className="p-3 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text)]">
                {benefit.type}
              </div>
            </div>

            {/* Read-Only: Sticker Value */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Sticker Value
              </label>
              <div className="p-3 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text)]">
                ${stickerValueInDollars}
              </div>
            </div>

            {/* User Declared Value — always editable */}
            <Input
              id="edit-benefit-field-2"
              label="Your Estimated Value (Optional, in dollars)"
              type="number"
              name="userDeclaredValue"
              placeholder="Leave blank to use sticker value"
              step="0.01"
              value={formData.userDeclaredValue}
              onChange={handleChange}
              error={errors.userDeclaredValue}
              disabled={isLoading}
            />

            {/* Reset Cadence — conditionally read-only for engine-managed benefits */}
            {isEngineManaged ? (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  <span className="flex items-center gap-1.5">
                    Reset Cadence
                    <Lock size={14} className="opacity-60" aria-hidden="true" />
                    <span className="text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                      (managed by catalog)
                    </span>
                  </span>
                </label>
                <div
                  className="p-3 rounded-md opacity-60 cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text)',
                  }}
                  aria-disabled="true"
                  aria-label={`Reset cadence: ${cadenceOptions.find((o) => o.value === benefit.resetCadence)?.label || benefit.resetCadence}`}
                >
                  {cadenceOptions.find((o) => o.value === benefit.resetCadence)?.label || benefit.resetCadence}
                </div>
              </div>
            ) : (
              <UnifiedSelect
                options={cadenceOptions}
                value={formData.resetCadence}
                onChange={(value) => handleSelectChange('resetCadence', value)}
                placeholder="Choose a cadence..."
                label="Reset Cadence"
                error={errors.resetCadence}
                required
                disabled={isLoading}
              />
            )}

            {/* Expiration Date — conditionally read-only for engine-managed benefits */}
            {isEngineManaged ? (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  <span className="flex items-center gap-1.5">
                    Period End
                    <Lock size={14} className="opacity-60" aria-hidden="true" />
                  </span>
                </label>
                <div
                  className="p-3 rounded-md opacity-60 cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text)',
                  }}
                  aria-disabled="true"
                  aria-label={`Period end: ${benefit.expirationDate ? new Date(benefit.expirationDate).toLocaleDateString() : 'No expiration'}`}
                >
                  {benefit.expirationDate
                    ? new Date(benefit.expirationDate).toLocaleDateString()
                    : 'No expiration'}
                </div>
              </div>
            ) : (
              <Input
                id="edit-benefit-field-1"
                label="Expiration Date (Optional)"
                type="date"
                name="expirationDate"
                value={formData.expirationDate}
                onChange={handleChange}
                error={errors.expirationDate}
                disabled={isLoading}
              />
            )}

            {/* Claimed Date — only when period data exists */}
            {(benefit.periodStart || benefit.periodEnd) && (
              <div>
                <label
                  htmlFor="edit-benefit-claimed-at"
                  className="block text-sm font-medium text-[var(--color-text)] mb-2"
                >
                  Claimed Date
                </label>
                <input
                  id="edit-benefit-claimed-at"
                  type="date"
                  name="claimedAt"
                  value={formData.claimedAt}
                  onChange={handleChange}
                  min={benefit.periodStart ? benefit.periodStart.split('T')[0] : undefined}
                  max={benefit.periodEnd ? benefit.periodEnd.split('T')[0] : undefined}
                  disabled={isLoading}
                  className="w-full p-3 rounded-md border text-sm"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {benefit.periodStart && benefit.periodEnd
                    ? `Must be between ${new Date(benefit.periodStart).toLocaleDateString()} and ${new Date(benefit.periodEnd).toLocaleDateString()}`
                    : benefit.periodStart
                    ? `Must be on or after ${new Date(benefit.periodStart).toLocaleDateString()}`
                    : benefit.periodEnd
                    ? `Must be on or before ${new Date(benefit.periodEnd).toLocaleDateString()}`
                    : 'Date when you claimed this benefit'}
                </p>
              </div>
            )}

            {/* Mark as Unused — only when benefit is currently used */}
            {benefit.isUsed && (
              <div
                className="flex items-center justify-between p-3 rounded-md border"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    This benefit is marked as used
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Undo if you marked it by mistake
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMarkUnused}
                  disabled={isMarkingUnused || isLoading}
                  aria-label="Mark benefit as unused"
                >
                  <Undo2 size={14} className="mr-1.5" aria-hidden="true" />
                  {isMarkingUnused ? 'Updating...' : 'Mark as Unused'}
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isLoading}
                disabled={isLoading || isDeleting || isMarkingUnused}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  disabled={isLoading || isDeleting || isMarkingUnused}
                >
                  Cancel
                </Button>
              </DialogPrimitive.Close>
            </div>

            {/* Delete Benefit — destructive action at bottom */}
            <div
              className="pt-4 mt-2"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              {showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-[var(--color-error)]">
                    Are you sure you want to delete this benefit? This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      fullWidth
                      onClick={handleDelete}
                      disabled={isDeleting || isLoading || isMarkingUnused}
                      aria-label="Confirm delete this benefit permanently"
                    >
                      <Trash2 size={14} className="mr-1.5" aria-hidden="true" />
                      {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      fullWidth
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting || isLoading || isMarkingUnused}
                  className="!text-[var(--color-error)] !border-[var(--color-error)] hover:!bg-[var(--color-error-light)]"
                  aria-label="Delete this benefit permanently"
                >
                  <Trash2 size={14} className="mr-1.5" aria-hidden="true" />
                  Delete Benefit
                </Button>
              )}
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
