'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { FormError } from '@/shared/components/forms';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/**
 * EditCardModal Component
 * 
 * Allows users to edit card details:
 * - Custom name
 * - Annual fee override
 * - Renewal date
 * 
 * Props:
 * - card: UserCard object with current values
 * - isOpen: boolean - whether modal is visible
 * - onClose: () => void - callback when user closes modal
 * - onCardUpdated: (card) => void - callback when card is successfully updated
 */

interface UserCard {
  id: string;
  customName: string | null;
  actualAnnualFee: number | null;
  renewalDate: Date | string;
  status: string;
}

interface EditCardModalProps {
  card: UserCard | null;
  isOpen: boolean;
  onClose: () => void;
  onCardUpdated?: (card: any) => void;
}

export function EditCardModal({
  card,
  isOpen,
  onClose,
  onCardUpdated,
}: EditCardModalProps) {
  const [formData, setFormData] = useState({
    customName: '',
    actualAnnualFee: '',
    renewalDate: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Pre-fill form when card data arrives
  useEffect(() => {
    if (isOpen && card) {
      const renewalDate = card.renewalDate instanceof Date
        ? card.renewalDate.toISOString().split('T')[0]
        : typeof card.renewalDate === 'string'
        ? card.renewalDate.split('T')[0]
        : '';

      const actualAnnualFee = card.actualAnnualFee
        ? (card.actualAnnualFee / 100).toFixed(2)
        : '';

      setFormData({
        customName: card.customName || '',
        actualAnnualFee,
        renewalDate,
      });
      setErrors({});
      setMessage('');
    }
  }, [isOpen, card]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.customName && formData.customName.length > 100) {
      newErrors.customName = 'Card name must be 100 characters or less';
    }

    if (formData.actualAnnualFee) {
      const fee = parseFloat(formData.actualAnnualFee);
      if (isNaN(fee) || fee < 0) {
        newErrors.actualAnnualFee = 'Annual fee must be a valid non-negative number';
      }
    }

    if (formData.renewalDate) {
      const date = new Date(formData.renewalDate);
      if (isNaN(date.getTime())) {
        newErrors.renewalDate = 'Invalid date format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !card) return;

    setIsLoading(true);
    setMessage('');

    try {
      // Convert annual fee from dollars to cents
      const actualAnnualFee = formData.actualAnnualFee
        ? Math.round(parseFloat(formData.actualAnnualFee) * 100)
        : undefined;

      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customName: formData.customName || undefined,
          actualAnnualFee,
          renewalDate: formData.renewalDate || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
        }
        setMessage(data.error || 'Failed to update card');
        return;
      }

      // Success
      setMessage('✓ Card updated successfully');
      setErrors({});

      if (onCardUpdated) {
        onCardUpdated(data.card);
      }

      // Close modal after 500ms to show success message
      setTimeout(onClose, 500);
    } catch (error) {
      console.error('Error updating card:', error);
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6 mx-4 max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <DialogPrimitive.Title className="text-2xl font-bold text-[var(--color-text)] mb-2">
            Edit Card
          </DialogPrimitive.Title>

          <DialogPrimitive.Description className="text-sm text-[var(--color-text-secondary)] mb-6">
            Update card details and settings
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
            {/* Custom Name */}
            <Input
        id="edit-card-field-3"
        
              label="Card Nickname (Optional)"
              type="text"
              name="customName"
              placeholder="e.g., 'My Travel Card'"
              value={formData.customName}
              onChange={handleChange}
              error={errors.customName}
              disabled={isLoading}
            />

            {/* Annual Fee Override */}
            <Input
        id="edit-card-field-2"
        
              label="Annual Fee Override (Optional, in dollars)"
              type="number"
              name="actualAnnualFee"
              placeholder="0.00"
              step="0.01"
              value={formData.actualAnnualFee}
              onChange={handleChange}
              error={errors.actualAnnualFee}
              disabled={isLoading}
            />

            {/* Renewal Date */}
            <Input
        id="edit-card-field-1"
        
              label="Renewal Date"
              type="date"
              name="renewalDate"
              value={formData.renewalDate}
              onChange={handleChange}
              error={errors.renewalDate}
              disabled={isLoading}
              hint="When your card benefits reset"
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
