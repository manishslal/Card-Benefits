'use client';

/**
 * MarkBenefitUsedModal Component
 * 
 * Modal for claiming a benefit within a specific period. Allows users to:
 * - Select which period to claim for (current or historical)
 * - Enter the amount claimed
 * - Add optional notes
 * - View claim preview before submitting
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAvailablePeriods,
  calculateAmountPerPeriod,
  formatPeriodLabel,
  ResetCadence,
  PeriodBoundaries,
} from '@/lib/benefit-period-utils';

export interface MarkBenefitUsedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  benefit: {
    id: string;
    name: string;
    stickerValue: number;
    resetCadence: string;
    type?: string;
    masterCard?: {
      cardName: string;
    };
  };
  userCard: {
    id: string;
    renewalDate: Date;
  };
  forPeriod?: Date;
}

export function MarkBenefitUsedModal({
  isOpen,
  onClose,
  onSuccess,
  benefit,
  userCard,
  forPeriod,
}: MarkBenefitUsedModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get period options
  const resetCadence = benefit.resetCadence as ResetCadence;
  const availablePeriods = getAvailablePeriods(resetCadence, userCard.renewalDate, 24);
  
  // Calculate current period
  const currentPeriod = forPeriod || new Date();
  const [selectedPeriodDate, setSelectedPeriodDate] = useState<Date>(currentPeriod);
  const [selectedPeriodBoundaries, setSelectedPeriodBoundaries] = useState<PeriodBoundaries | null>(null);

  const [amountClaimed, setAmountClaimed] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Calculate period details when selection changes
  useEffect(() => {
    const boundaries = availablePeriods.find(p => {
      const sameStart = p.start.getTime() === selectedPeriodDate.getTime();
      return sameStart;
    });
    
    if (boundaries) {
      setSelectedPeriodBoundaries(boundaries);
      const availableAmount = calculateAmountPerPeriod(benefit.stickerValue, resetCadence);
      setAmountClaimed(String(availableAmount / 100)); // Convert cents to dollars
    }
  }, [selectedPeriodDate, benefit.stickerValue, resetCadence]);

  const amountAvailable = calculateAmountPerPeriod(benefit.stickerValue, resetCadence);
  const amountClaimedCents = Math.round(parseFloat(amountClaimed || '0') * 100);
  const periodLabel = selectedPeriodBoundaries ? formatPeriodLabel(selectedPeriodBoundaries, resetCadence) : 'Unknown Period';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validation
      if (!amountClaimedCents || amountClaimedCents <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      if (amountClaimedCents > amountAvailable) {
        setError(`Cannot claim more than $${(amountAvailable / 100).toFixed(2)}`);
        return;
      }

      // Submit claim
      const response = await fetch('/api/benefits/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userBenefitId: benefit.id,
          userCardId: userCard.id,
          usageAmount: amountClaimedCents / 100,
          notes: notes || null,
          usageDate: selectedPeriodDate.toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to claim benefit');
        return;
      }

      // Success
      onClose();
      if (onSuccess) {
        onSuccess();
      }
      router.refresh();
    } catch (err) {
      setError('An error occurred while claiming the benefit');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Claim Benefit</h2>
          <p className="text-sm text-gray-600 mt-1">
            {benefit.masterCard?.cardName} - {benefit.name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Period Selector */}
          <div className="space-y-2">
            <label htmlFor="period" className="block text-sm font-medium">Period</label>
            <select
              id="period"
              value={selectedPeriodDate.toISOString().split('T')[0]}
              onChange={(e) => setSelectedPeriodDate(new Date(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {availablePeriods.map((period) => (
                <option key={period.start.toISOString()} value={period.start.toISOString().split('T')[0]}>
                  {formatPeriodLabel(period, resetCadence)}
                </option>
              ))}
            </select>
          </div>

          {/* Period Details */}
          {selectedPeriodBoundaries && (
            <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
              <div><strong>Period:</strong> {periodLabel}</div>
              <div>
                <strong>Start:</strong> {selectedPeriodBoundaries.start.toLocaleDateString()}
              </div>
              <div>
                <strong>End:</strong> {selectedPeriodBoundaries.end.toLocaleDateString()}
              </div>
              <div>
                <strong>Available:</strong> ${(amountAvailable / 100).toFixed(2)}
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <label htmlFor="amount" className="block text-sm font-medium">
              Amount to Claim
              <span className="text-gray-500 ml-2 font-normal">
                (Max: ${(amountAvailable / 100).toFixed(2)})
              </span>
            </label>
            <input
              id="amount"
              type="number"
              min="0"
              max={(amountAvailable / 100).toFixed(2)}
              step="0.01"
              value={amountClaimed}
              onChange={(e) => setAmountClaimed(e.target.value)}
              placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-lg ${amountClaimedCents > amountAvailable ? 'border-red-500' : ''}`}
            />
            {amountClaimedCents > amountAvailable && (
              <p className="text-red-500 text-sm">Amount exceeds available</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="block text-sm font-medium">
              Notes (Optional)
              <span className="text-gray-500 ml-2 font-normal">
                {notes.length}/500
              </span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="e.g., UberEats order #12345..."
              className="w-full px-3 py-2 border rounded-lg h-20 resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Preview */}
          {amountClaimedCents > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <div className="font-semibold mb-2">Claim Preview:</div>
              <div className="relative w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, (amountClaimedCents / amountAvailable) * 100)}%`,
                  }}
                />
              </div>
              <div className="text-center font-semibold">
                ${(amountClaimedCents / 100).toFixed(2)} / ${(amountAvailable / 100).toFixed(2)}
                {amountClaimedCents === amountAvailable && ' ✓'}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 justify-end border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !amountClaimedCents || amountClaimedCents > amountAvailable}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? 'Claiming...' : 'Claim Benefit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
