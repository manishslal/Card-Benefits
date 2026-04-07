'use client';

import React, { useState, useEffect, useRef } from 'react';
import Button from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { UnifiedSelect } from '@/shared/components/ui/select-unified';
import { FormError } from '@/shared/components/forms';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/**
 * AddCardModal Component - Phase 4: Accessibility & UX Fixes
 * 
 * WCAG 2.1 Level AA Compliant Features:
 * - Radix UI Dialog for proper ARIA roles and keyboard trapping
 * - Focus management: Focus moves to first input on open, returns to trigger on close
 * - Keyboard navigation: Tab cycles within modal, Escape closes modal
 * - Screen reader support: aria-modal, aria-labelledby, aria-describedby
 * - Form validation with real-time feedback
 * 
 * Props:
 * - isOpen: boolean - whether modal is visible
 * - onClose: () => void - callback when user closes modal
 * - onCardAdded: (card) => void - callback when card is successfully added
 */

interface Card {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
}

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCardAdded?: (card: any) => void;
}

export function AddCardModal({ isOpen, onClose, onCardAdded }: AddCardModalProps) {
  const cardSelectRef = useRef<HTMLButtonElement>(null);
  const previousCardIdRef = useRef<string>('');

  const [formData, setFormData] = useState({
    masterCardId: '',
    customName: '',
    customAnnualFee: '',
    renewalDate: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [availableCards, setAvailableCards] = useState<Card[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

  // Fetch available cards when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableCards();
    }
  }, [isOpen]);

  const fetchAvailableCards = async () => {
    setIsLoadingCards(true);
    setMessage('');
    try {
      // Fetch available cards from real API endpoint (BLOCKER #6 implementation)
      const response = await fetch('/api/cards/available?limit=100', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch available cards');
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.cards)) {
        throw new Error('Invalid response format');
      }

      // Map API response to Card interface
      const cards: Card[] = data.cards.map((apiCard: any) => ({
        id: apiCard.id,
        issuer: apiCard.issuer,
        cardName: apiCard.cardName,
        defaultAnnualFee: apiCard.defaultAnnualFee,
      }));

      setAvailableCards(cards);

      if (cards.length === 0) {
        setMessage('No cards available in the catalog');
      }
    } catch (error) {
      console.error('Failed to fetch cards:', error);
      setMessage('Failed to load available cards. Please try again.');
    } finally {
      setIsLoadingCards(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, masterCardId: value }));
    if (errors.masterCardId) {
      setErrors((prev) => ({ ...prev, masterCardId: '' }));
    }
  };

  // Enhancement 4: Auto-populate annual fee when card is selected
  // This effect detects when a NEW card is selected (different from previous) and populates the fee
  useEffect(() => {
    // Only proceed if masterCardId has changed from the previous value
    const cardChanged = formData.masterCardId !== previousCardIdRef.current;

    // Update the ref to the current card ID for next comparison
    previousCardIdRef.current = formData.masterCardId;

    // If no card selected, nothing to do
    if (!formData.masterCardId || !cardChanged) {
      return;
    }

    // Find the selected card from availableCards
    const selectedCard = availableCards.find((card) => card.id === formData.masterCardId);
    if (selectedCard) {
      // Always populate fee when card changes, regardless of current fee value
      // Convert from cents to dollars and format as "150.00"
      const feeInDollars = (selectedCard.defaultAnnualFee / 100).toFixed(2);
      setFormData((prev) => ({
        ...prev,
        customAnnualFee: feeInDollars,
      }));
    }
  }, [formData.masterCardId, availableCards]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.masterCardId) {
      newErrors.masterCardId = 'Please select a card';
    }

    if (!formData.renewalDate) {
      newErrors.renewalDate = 'Renewal date is required';
    } else {
      const date = new Date(formData.renewalDate);
      if (date < new Date()) {
        newErrors.renewalDate = 'Renewal date must be in the future';
      }
    }

    if (formData.customAnnualFee) {
      const fee = parseFloat(formData.customAnnualFee);
      if (isNaN(fee) || fee < 0) {
        newErrors.customAnnualFee = 'Annual fee must be a valid positive number';
      }
    }

    if (formData.customName && formData.customName.length > 100) {
      newErrors.customName = 'Card name must be 100 characters or less';
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
      // Convert annual fee from string input to cents (if provided)
      const customAnnualFee = formData.customAnnualFee
        ? Math.round(parseFloat(formData.customAnnualFee) * 100)
        : undefined;

      const response = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          masterCardId: formData.masterCardId,
          renewalDate: formData.renewalDate,
          customName: formData.customName || undefined,
          customAnnualFee,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
        }
        setMessage(data.error || 'Failed to add card');
        return;
      }

      // Success - clear form and call callback
      setMessage('✓ Card added successfully');
      setFormData({
        masterCardId: '',
        customName: '',
        customAnnualFee: '',
        renewalDate: '',
      });
      setErrors({});

      if (onCardAdded) {
        onCardAdded(data.card);
      }

      // Close modal after 1 second
      setTimeout(onClose, 1000);
    } catch (error) {
      console.error('Error adding card:', error);
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Prepare select options for card selection
  // Enhancement 1: Show only card name and annual fee (no issuer) to fit mobile viewport
  const cardOptions = availableCards.map((card) => ({
    value: card.id,
    label: `${card.cardName} ($${(card.defaultAnnualFee / 100).toFixed(2)}/yr)`,
  }));

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
          style={{ backgroundColor: 'var(--color-bg)' }}
          onOpenAutoFocus={() => {
            requestAnimationFrame(() => {
              cardSelectRef.current?.focus();
            });
          }}
        >
          <DialogPrimitive.Title className="text-2xl font-bold text-[var(--color-text)] mb-2">
            Add Credit Card
          </DialogPrimitive.Title>

          <DialogPrimitive.Description className="text-sm text-[var(--color-text-secondary)] mb-6">
            Add a new credit card to track its benefits
          </DialogPrimitive.Description>

          {/* Header with close button */}
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
            {/* Card Selection using Unified Select */}
            <UnifiedSelect
              ref={cardSelectRef}
              options={cardOptions}
              value={formData.masterCardId}
              onChange={handleSelectChange}
              placeholder={isLoadingCards ? 'Loading cards...' : 'Choose a card...'}
              label="Select Card"
              error={errors.masterCardId}
              required
              disabled={isLoading || isLoadingCards}
              aria-labelledby="add-card-modal-title"
            />

            {/* Renewal Date */}
            <Input
        id="add-card-field-3"
        
              label="Renewal Date"
              type="date"
              name="renewalDate"
              value={formData.renewalDate}
              onChange={handleChange}
              onBlur={(e) => {
                // Validate renewal date on blur
                const date = new Date(e.currentTarget.value);
                if (e.currentTarget.value && date < new Date()) {
                  setErrors((prev) => ({
                    ...prev,
                    renewalDate: 'Renewal date must be in the future'
                  }));
                }
              }}
              error={errors.renewalDate}
              disabled={isLoading}
              required
              hint="When your card benefits reset"
            />

            {/* Custom Name (Optional) */}
            <Input
        id="add-card-field-2"
        
              label="Card Nickname (Optional)"
              type="text"
              name="customName"
              placeholder="e.g., 'My Travel Card'"
              value={formData.customName}
              onChange={handleChange}
              error={errors.customName}
              disabled={isLoading}
            />

            {/* Custom Annual Fee (Optional) */}
            <Input
        id="add-card-field-1"
        
              label="Annual Fee Override (Optional, in dollars)"
              type="number"
              name="customAnnualFee"
              placeholder="0.00"
              step="0.01"
              value={formData.customAnnualFee}
              onChange={handleChange}
              error={errors.customAnnualFee}
              disabled={isLoading}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isLoading}
                disabled={isLoading || isLoadingCards}
              >
                {isLoading ? 'Adding Card...' : 'Add Card'}
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
