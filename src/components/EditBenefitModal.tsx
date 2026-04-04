'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/Input';
import { UnifiedSelect } from '@/components/ui/select-unified';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/**
 * EditBenefitModal Component
 * 
 * Allows users to edit benefit details
 * 
 * Editable fields:
 * - name
 * - userDeclaredValue
 * - expirationDate
 * - resetCadence
 * 
 * Read-only fields:
 * - stickerValue
 * - type
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
}

interface EditBenefitModalProps {
  benefit: UserBenefit | null;
  isOpen: boolean;
  onClose: () => void;
  onBenefitUpdated?: (benefit: any) => void;
}

export function EditBenefitModal({
  benefit,
  isOpen,
  onClose,
  onBenefitUpdated,
}: EditBenefitModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    userDeclaredValue: '',
    expirationDate: '',
    resetCadence: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
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

      const userDeclaredValue = benefit.userDeclaredValue
        ? (benefit.userDeclaredValue / 100).toFixed(2)
        : '';

      setFormData({
        name: benefit.name || '',
        userDeclaredValue,
        expirationDate,
        resetCadence: benefit.resetCadence || '',
      });
      setErrors({});
      setMessage('');
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

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = 'Benefit name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Benefit name must be 100 characters or less';
    }

    if (formData.userDeclaredValue) {
      const declaredValue = parseFloat(formData.userDeclaredValue);
      if (isNaN(declaredValue) || declaredValue < 0) {
        newErrors.userDeclaredValue = 'User declared value must be a non-negative number';
      } else if (benefit && declaredValue > (benefit.stickerValue / 100)) {
        newErrors.userDeclaredValue = 'User declared value cannot exceed sticker value';
      }
    }

    if (formData.expirationDate) {
      const date = new Date(formData.expirationDate);
      if (isNaN(date.getTime())) {
        newErrors.expirationDate = 'Invalid date format';
      } else if (date < new Date()) {
        newErrors.expirationDate = 'Expiration date must be in the future';
      }
    }

    if (!formData.resetCadence) {
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

    try {
      // Convert values to cents
      const userDeclaredValue = formData.userDeclaredValue
        ? Math.round(parseFloat(formData.userDeclaredValue) * 100)
        : undefined;

      const response = await fetch(`/api/benefits/${benefit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          userDeclaredValue,
          expirationDate: formData.expirationDate || undefined,
          resetCadence: formData.resetCadence,
        }),
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

  if (!isOpen || !benefit) return null;

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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200 p-6 mx-4 max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          {/* Header with title and close button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <DialogPrimitive.Title
                id="edit-benefit-modal-title"
                className="text-2xl font-bold text-[var(--color-text)]"
              >
                Edit Benefit
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="edit-benefit-modal-description"
                className="text-sm text-[var(--color-text-secondary)] mt-1"
              >
                Update benefit details
              </DialogPrimitive.Description>
            </div>
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
            <div
              className={`p-4 rounded-lg mb-6 text-sm ${
                message.startsWith('✓')
                  ? 'bg-[var(--color-success)] bg-opacity-10 text-[var(--color-success)]'
                  : 'bg-[var(--color-error)] bg-opacity-10 text-[var(--color-error)]'
              }`}
              role="status"
              aria-live="polite"
            >
              {message}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Benefit Name */}
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

            {/* User Declared Value */}
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

            {/* Reset Cadence */}
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

            {/* Expiration Date */}
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

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </DialogPrimitive.Close>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
