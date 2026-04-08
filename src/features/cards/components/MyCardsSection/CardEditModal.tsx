'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { FormError } from '@/shared/components/forms';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Card, UpdateCardResponse } from './types';

interface CardEditModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onCardUpdated?: (card: Card) => void;
}

interface FormData {
  name: string;
}

/**
 * CardEditModal Component
 *
 * Modal for editing card details:
 * - Card name (editable, max 100 chars, sent to API as customName)
 * 
 * Note: Other fields like cardType, cardNetwork, isActive are read-only
 * and should not be included in API requests. Only customName is editable.
 *
 * Features:
 * - Form validation on blur and submit
 * - Loading states during API call
 * - Dark mode support
 * - Accessibility: ARIA labels, focus management
 * - Matches EditBenefitModal pattern
 */
export function CardEditModal({
  card,
  isOpen,
  onClose,
  onCardUpdated,
}: CardEditModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Pre-fill form when card data arrives
  useEffect(() => {
    if (isOpen && card) {
      setFormData({
        name: card.name || '',
      });
      setErrors({});
      setMessage('');
    }
  }, [isOpen, card]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Card name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Card name must be 100 characters or less';
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
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customName: formData.name.trim(),
        }),
      });

      const data: UpdateCardResponse = await response.json();

      if (!response.ok) {
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

  if (!isOpen || !card) return null;

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />

        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto border"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
          }}
        >
          <DialogPrimitive.Title
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--color-text)' }}
          >
            Edit Card
          </DialogPrimitive.Title>

          <DialogPrimitive.Description
            className="text-sm mb-6"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Update your card information
          </DialogPrimitive.Description>

          {/* Close button */}
          <div className="absolute top-4 right-4">
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Close dialog"
                className="p-2 rounded-md transition-colors focus:outline-none focus:ring-2"
                style={{
                  color: 'var(--color-text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
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
            {/* Card Name */}
            <Input
              label="Card Name"
              type="text"
              name="name"
              placeholder="e.g., 'My Chase Sapphire'"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              disabled={isLoading}
              required
              maxLength={100}
            />

            {/* Read-Only: Last 4 Digits */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--color-text)' }}
              >
                Last 4 Digits
              </label>
              <div
                className="p-3 rounded-md"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                }}
              >
                •••• {card.lastFourDigits}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
