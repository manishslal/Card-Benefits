/**
 * Mark Usage Modal Component
 * Form to record new benefit usage event
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { BenefitUsageRecord } from '@/features/benefits/types/benefits';

interface MarkUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  benefitId: string;
  maxValue: number;
  onSuccess?: (record: BenefitUsageRecord) => void;
}

export function MarkUsageModal({ isOpen, onClose, benefitId, maxValue, onSuccess }: MarkUsageModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const numAmount = parseFloat(amount);
      if (!amount || numAmount <= 0) {
        throw new Error('Amount must be positive');
      }
      if (numAmount > maxValue) {
        throw new Error(`Amount cannot exceed ${maxValue}`);
      }

      const response = await fetch('/api/benefits/usage/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          benefitId,
          amount: numAmount,
          usageDate: new Date(date).toISOString(),
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record usage');
      }

      const data = await response.json();
      if (data.success && onSuccess) {
        onSuccess(data.usage);
        setAmount('');
        setNotes('');
        setDate(new Date().toISOString().split('T')[0]);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Benefit Usage</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={maxValue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder={`0.00 (max: $${maxValue})`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
              placeholder="Add any notes about this usage..."
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Record Usage'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
