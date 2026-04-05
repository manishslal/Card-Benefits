'use client';

import React, { useState } from 'react';
import Button from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { UnifiedSelect } from '@/shared/components/ui/select-unified';
import { FormError } from '@/shared/components/forms';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/**
 * AddBenefitModal Component
 * 
 * Allows users to add a new benefit to a card
 * 
 * Props:
 * - cardId: string - which card to add benefit to
 * - isOpen: boolean - whether modal is visible
 * - onClose: () => void - callback when user closes modal
 * - onBenefitAdded: (benefit) => void - callback when benefit is successfully added
 */

interface AddBenefitModalProps {
  cardId: string;
  isOpen: boolean;
  onClose: () => void;
  onBenefitAdded?: (benefit: any) => void;
}

export function AddBenefitModal({
  cardId,
  isOpen,
  onClose,
  onBenefitAdded,
}: AddBenefitModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    stickerValue: '',
    resetCadence: '',
    userDeclaredValue: '',
    expirationDate: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

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

    if (!formData.type) {
      newErrors.type = 'Benefit type is required';
    }

    if (!formData.stickerValue || parseFloat(formData.stickerValue) <= 0) {
      newErrors.stickerValue = 'Sticker value must be greater than 0';
    } else if (isNaN(parseFloat(formData.stickerValue))) {
      newErrors.stickerValue = 'Sticker value must be a valid number';
    }

    if (!formData.resetCadence) {
      newErrors.resetCadence = 'Reset cadence is required';
    }

    if (formData.userDeclaredValue) {
      const declaredValue = parseFloat(formData.userDeclaredValue);
      const stickerValue = parseFloat(formData.stickerValue);
      if (isNaN(declaredValue) || declaredValue < 0) {
        newErrors.userDeclaredValue = 'User declared value must be a non-negative number';
      } else if (declaredValue > stickerValue) {
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setMessage('');

    try {
      // Convert values to cents
      const stickerValue = Math.round(parseFloat(formData.stickerValue) * 100);
      const userDeclaredValue = formData.userDeclaredValue
        ? Math.round(parseFloat(formData.userDeclaredValue) * 100)
        : undefined;

      const response = await fetch('/api/benefits/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userCardId: cardId,
          name: formData.name.trim(),
          type: formData.type,
          stickerValue,
          resetCadence: formData.resetCadence,
          userDeclaredValue,
          expirationDate: formData.expirationDate || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
        }
        setMessage(data.error || 'Failed to add benefit');
        return;
      }

      // Success
      setMessage('✓ Benefit added successfully');
      setErrors({});
      setFormData({
        name: '',
        type: '',
        stickerValue: '',
        resetCadence: '',
        userDeclaredValue: '',
        expirationDate: '',
      });

      if (onBenefitAdded) {
        onBenefitAdded(data.benefit);
      }

      // Close modal after 500ms to show success message
      setTimeout(onClose, 500);
    } catch (error) {
      console.error('Error adding benefit:', error);
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const typeOptions = [
    { value: 'StatementCredit', label: 'Statement Credit' },
    { value: 'UsagePerk', label: 'Usage Perk' },
  ];

  const cadenceOptions = [
    { value: 'Monthly', label: 'Monthly' },
    { value: 'CalendarYear', label: 'Calendar Year' },
    { value: 'CardmemberYear', label: 'Cardmember Year' },
    { value: 'OneTime', label: 'One Time' },
  ];

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200 p-6 mx-4 max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          {/* Header with title and close button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <DialogPrimitive.Title
                id="add-benefit-modal-title"
                className="text-2xl font-bold text-[var(--color-text)]"
              >
                Add Benefit
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="add-benefit-modal-description"
                className="text-sm text-[var(--color-text-secondary)] mt-1"
              >
                Add a new benefit to this card
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
            <FormError
              message={message.replace(/^✓\s*/, '')}
              type={message.startsWith('✓') ? 'success' : 'error'}
            />
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Benefit Name */}
            <Input
        id="add-benefit-field-4"
        
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

            {/* Benefit Type */}
            <UnifiedSelect
              options={typeOptions}
              value={formData.type}
              onChange={(value) => handleSelectChange('type', value)}
              placeholder="Choose a type..."
              label="Benefit Type"
              error={errors.type}
              required
              disabled={isLoading}
            />

            {/* Sticker Value */}
            <Input
        id="add-benefit-field-3"
        
              label="Sticker Value (in dollars)"
              type="number"
              name="stickerValue"
              placeholder="0.00"
              step="0.01"
              value={formData.stickerValue}
              onChange={handleChange}
              error={errors.stickerValue}
              disabled={isLoading}
              required
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

            {/* User Declared Value (Optional) */}
            <Input
        id="add-benefit-field-2"
        
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

            {/* Expiration Date (Optional) */}
            <Input
        id="add-benefit-field-1"
        
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
                {isLoading ? 'Adding Benefit...' : 'Add Benefit'}
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
