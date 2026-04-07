/**
 * UsageForm - Form to record benefit usage
 * Controlled inputs for amount, description, date
 */

'use client';

import React, { useState } from 'react';
import { UsageFormData } from '@/types/benefits';

interface UsageFormProps {
  benefitId: string;
  onSubmit: (data: UsageFormData) => Promise<void>;
  onCancel?: () => void;
}

export function UsageForm({
  benefitId,
  onSubmit,
  onCancel,
}: UsageFormProps) {
  const [formData, setFormData] = useState<UsageFormData>({
    benefitId,
    amount: 0,
    description: '',
    date: new Date(),
    category: '',
  });

  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Validation
    if (!formData.amount || formData.amount <= 0) {
      setLocalError('Amount must be greater than 0');
      return;
    }

    if (!formData.description.trim()) {
      setLocalError('Description is required');
      return;
    }

    if (formData.description.length > 500) {
      setLocalError('Description must not exceed 500 characters');
      return;
    }

    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        benefitId,
        amount: 0,
        description: '',
        date: new Date(),
        category: '',
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to record usage');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Record Benefit Usage
      </h2>

      {localError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">
            {localError}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Amount (in cents)
        </label>
        <input
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          min="0"
          max="999999"
          step="1"
          required
          aria-label="Amount in cents"
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          maxLength={500}
          required
          aria-label="Usage description"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Describe what this benefit was used for..."
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {formData.description.length}/500 characters
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Date
        </label>
        <input
          type="date"
          name="date"
          value={formData.date.toISOString().split('T')[0]}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              date: new Date(e.target.value),
            }))
          }
          required
          aria-label="Usage date"
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Category (Optional)
        </label>
        <input
          type="text"
          name="category"
          value={formData.category}
          onChange={handleChange}
          aria-label="Usage category"
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., Travel, Dining, Shopping"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={false}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium transition"
        >
          {false ? 'Recording...' : 'Record Usage'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
