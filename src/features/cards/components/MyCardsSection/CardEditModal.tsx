'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { UnifiedSelect } from '@/shared/components/ui/select-unified';
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
  cardType: 'Credit' | 'Debit' | 'Prepaid';
  cardNetwork: 'Visa' | 'Mastercard' | 'Amex' | 'Discover';
  isActive: boolean;
}

/**
 * CardEditModal Component
 *
 * Modal for editing card details:
 * - Card name (editable, 1-50 chars)
 * - Card type (editable via dropdown)
 * - Card network (editable via dropdown)
 * - Active status (editable via toggle)
 * - Last 4 digits (read-only)
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
    cardType: 'Credit',
    cardNetwork: 'Visa',
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Pre-fill form when card data arrives
  useEffect(() => {
    if (isOpen && card) {
      setFormData({
        name: card.name || '',
        cardType: card.cardType,
        cardNetwork: card.cardNetwork,
        isActive: card.isActive,
      });
      setErrors({});
      setMessage('');
    }
  }, [isOpen, card]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value as 'Credit' | 'Debit' | 'Prepaid' | 'Visa' | 'Mastercard' | 'Amex' | 'Discover',
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Card name is required';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Card name must be 50 characters or less';
    }

    if (!formData.cardType) {
      newErrors.cardType = 'Card type is required';
    }

    if (!formData.cardNetwork) {
      newErrors.cardNetwork = 'Card network is required';
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
          name: formData.name.trim(),
          cardType: formData.cardType,
          cardNetwork: formData.cardNetwork,
          isActive: formData.isActive,
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

  const cardTypeOptions = [
    { value: 'Credit', label: 'Credit' },
    { value: 'Debit', label: 'Debit' },
    { value: 'Prepaid', label: 'Prepaid' },
  ];

  const cardNetworkOptions = [
    { value: 'Visa', label: 'Visa' },
    { value: 'Mastercard', label: 'Mastercard' },
    { value: 'Amex', label: 'American Express' },
    { value: 'Discover', label: 'Discover' },
  ];

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
                  hoverColor: 'var(--color-text)',
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
              maxLength={50}
            />

            {/* Card Type */}
            <UnifiedSelect
              label="Card Type"
              value={formData.cardType}
              onChange={(value) => handleSelectChange('cardType', value)}
              options={cardTypeOptions}
              error={errors.cardType}
              disabled={isLoading}
            />

            {/* Card Network */}
            <UnifiedSelect
              label="Card Network"
              value={formData.cardNetwork}
              onChange={(value) => handleSelectChange('cardNetwork', value)}
              options={cardNetworkOptions}
              error={errors.cardNetwork}
              disabled={isLoading}
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

            {/* Active Status Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
              }}
            >
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                disabled={isLoading}
                className="w-4 h-4 rounded cursor-pointer"
                style={{
                  accentColor: 'var(--color-primary)',
                }}
              />
              <label
                htmlFor="isActive"
                className="flex-1 text-sm cursor-pointer"
                style={{ color: 'var(--color-text)' }}
              >
                This card is active and can receive benefits
              </label>
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
