/**
 * EditBenefitModal Component (Admin)
 * 
 * Allows admins to edit benefit details (master benefits).
 * - Pre-fills form with existing benefit data
 * - Editable fields: name, type, stickerValue, resetCadence,
 *   claimingCadence, claimingAmount, variableAmounts, isActive
 * - Validates form inputs
 * - API call: PATCH /api/admin/benefits/{benefitId}
 * - Handles currency conversion (dollars <-> cents)
 * - Displays errors via FormError component
 * - Closes on success
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import { formatCurrency, parseCurrency } from '@/shared/lib/format-currency';
import { FormError } from '@/shared/components/forms';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Benefit } from '@/features/admin/types/admin';

// ============================================================
// Constants
// ============================================================

const VALID_TYPES = ['StatementCredit', 'UsagePerk'];

const TYPE_OPTIONS = [
  { value: 'StatementCredit', label: 'Statement Credit' },
  { value: 'UsagePerk', label: 'Usage Perk' },
];

const CLAIMING_CADENCE_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
  { value: 'FLEXIBLE_ANNUAL', label: 'Flexible Annual' },
  { value: 'ONE_TIME', label: 'One Time' },
];

/** Number of periods per year for each claiming cadence */
const PERIODS_PER_YEAR: Record<string, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  SEMI_ANNUAL: 2,
  FLEXIBLE_ANNUAL: 1,
  ONE_TIME: 1,
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ============================================================
// Types
// ============================================================

interface VariableAmountEntry {
  month: string; // "1" through "12"
  amount: string; // dollars display string
}

interface EditBenefitModalProps {
  benefit: Benefit | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// Shared Tailwind class strings
const inputClasses =
  'w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50';
const helperClasses = 'text-slate-500 dark:text-slate-400 text-xs mt-1';
const errorClasses = 'text-red-500 dark:text-red-400 text-sm mt-1';
const labelClasses = 'block text-sm font-medium text-slate-900 dark:text-white mb-1';

// ============================================================
// Component
// ============================================================

export function EditBenefitModal({
  benefit,
  isOpen,
  onClose,
  onSaved,
}: EditBenefitModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    stickerValue: '',
    resetCadence: '',
    claimingCadence: '',
    claimingAmount: '',
    isActive: true,
  });
  const [variableAmounts, setVariableAmounts] = useState<VariableAmountEntry[]>([]);
  const [suggestedAmount, setSuggestedAmount] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Pre-fill form when benefit data arrives
  useEffect(() => {
    if (isOpen && benefit) {
      const typeValue = benefit.type && VALID_TYPES.includes(benefit.type) ? benefit.type : '';

      // Parse variableAmounts from benefit (JSON object: { "12": 3500 })
      const entries: VariableAmountEntry[] = [];
      if (benefit.variableAmounts && typeof benefit.variableAmounts === 'object') {
        for (const [month, cents] of Object.entries(benefit.variableAmounts)) {
          entries.push({
            month,
            amount: formatCurrency(cents as number, false),
          });
        }
      }

      setFormData({
        name: benefit.name || '',
        type: typeValue,
        stickerValue: formatCurrency(benefit.stickerValue, false),
        resetCadence: benefit.resetCadence || '',
        claimingCadence: benefit.claimingCadence || '',
        claimingAmount: benefit.claimingAmount != null
          ? formatCurrency(benefit.claimingAmount, false)
          : '',
        isActive: benefit.isActive ?? true,
      });
      setVariableAmounts(entries);
      setSuggestedAmount(null);
      setFieldErrors({});
      setFormError(null);
    }
  }, [isOpen, benefit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type: inputType } = e.target;
    const newValue = inputType === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  /** When claimingCadence changes, compute a suggested per-period amount */
  const handleCadenceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const cadence = e.target.value;
      setFormData((prev) => ({ ...prev, claimingCadence: cadence }));
      if (fieldErrors.claimingCadence) {
        setFieldErrors((prev) => ({ ...prev, claimingCadence: '' }));
      }

      if (cadence && formData.stickerValue) {
        const totalCents = parseCurrency(formData.stickerValue);
        const periods = PERIODS_PER_YEAR[cadence] ?? 1;
        const perPeriodCents = Math.round(totalCents / periods);
        const suggestion = formatCurrency(perPeriodCents, true);
        setSuggestedAmount(`Suggested: ${suggestion} based on annual total`);
      } else {
        setSuggestedAmount(null);
      }
    },
    [formData.stickerValue, fieldErrors],
  );

  // ── Variable amounts helpers ────────────────────────────────
  const usedMonths = new Set(variableAmounts.map((e) => e.month));

  const handleAddOverride = () => {
    // Find the first unused month
    const nextMonth = Array.from({ length: 12 }, (_, i) => String(i + 1)).find(
      (m) => !usedMonths.has(m),
    );
    if (!nextMonth) return; // all months used
    setVariableAmounts((prev) => [...prev, { month: nextMonth, amount: '' }]);
  };

  const handleRemoveOverride = (idx: number) => {
    setVariableAmounts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleOverrideChange = (
    idx: number,
    field: 'month' | 'amount',
    value: string,
  ) => {
    setVariableAmounts((prev) =>
      prev.map((entry, i) => (i === idx ? { ...entry, [field]: value } : entry)),
    );
  };

  // ── Validation ──────────────────────────────────────────────
  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Name is required';
    } else if (formData.name.length > 200) {
      errors.name = 'Name must be 200 characters or less';
    }

    if (!formData.type) {
      errors.type = 'Type is required';
    } else if (!VALID_TYPES.includes(formData.type)) {
      errors.type = 'Invalid type selected';
    }

    if (!formData.stickerValue) {
      errors.stickerValue = 'Sticker value is required';
    } else {
      const cents = parseCurrency(formData.stickerValue);
      if (cents < 0) {
        errors.stickerValue = 'Value cannot be negative';
      }
    }

    if (!formData.resetCadence) {
      errors.resetCadence = 'Reset cadence is required';
    }

    if (formData.claimingAmount) {
      const cents = parseCurrency(formData.claimingAmount);
      if (cents < 0) {
        errors.claimingAmount = 'Claiming amount cannot be negative';
      }
    }

    // Validate variable amount entries
    for (const entry of variableAmounts) {
      if (entry.amount) {
        const cents = parseCurrency(entry.amount);
        if (cents < 0) {
          errors.variableAmounts = 'Override amounts cannot be negative';
          break;
        }
      }
    }

    return errors;
  };

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setIsSubmitting(false);
        return;
      }

      if (!benefit) {
        setFormError('Benefit not found');
        setIsSubmitting(false);
        return;
      }

      // Convert stickerValue from dollars to cents
      const stickerValueCents = parseCurrency(formData.stickerValue);

      // Build claiming cadence payload
      const claimingCadence = formData.claimingCadence || null;
      const claimingAmount = formData.claimingAmount
        ? parseCurrency(formData.claimingAmount)
        : null;

      // Build variableAmounts JSON object (month string → cents)
      let variableAmountsPayload: Record<string, number> | null = null;
      if (variableAmounts.length > 0) {
        variableAmountsPayload = {};
        for (const entry of variableAmounts) {
          if (entry.month && entry.amount) {
            variableAmountsPayload[entry.month] = parseCurrency(entry.amount);
          }
        }
        // If all entries were empty, send null
        if (Object.keys(variableAmountsPayload).length === 0) {
          variableAmountsPayload = null;
        }
      }

      const response = await apiClient.patch(`/benefits/${benefit.id}`, {
        name: formData.name.trim(),
        type: formData.type,
        stickerValue: stickerValueCents,
        resetCadence: formData.resetCadence,
        claimingCadence,
        claimingAmount,
        variableAmounts: variableAmountsPayload,
        isActive: formData.isActive,
      });

      if (response.success) {
        onSaved();
      } else {
        setFormError(response.error || 'Failed to update benefit');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !benefit) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <div className="flex items-center justify-between mb-4">
            <DialogPrimitive.Title className="text-2xl font-bold text-slate-900 dark:text-white">
              Edit Benefit
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Close dialog"
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={24} />
              </button>
            </DialogPrimitive.Close>
          </div>

          {formError && (
            <FormError message={formError} />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field */}
            <div>
              <label className={labelClasses}>
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                maxLength={200}
                disabled={isSubmitting}
                className={inputClasses}
                placeholder="Benefit name"
              />
              {fieldErrors.name && (
                <p className={errorClasses}>{fieldErrors.name}</p>
              )}
            </div>

            {/* Type field */}
            <div>
              <label className={labelClasses}>
                Type *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className={inputClasses}
              >
                <option value="">Select a type</option>
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {fieldErrors.type && (
                <p className={errorClasses}>{fieldErrors.type}</p>
              )}
            </div>

            {/* Sticker Value field (in dollars) */}
            <div>
              <label className={labelClasses}>
                Sticker Value ($) *
              </label>
              <input
                type="text"
                name="stickerValue"
                value={formData.stickerValue}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className={inputClasses}
                placeholder="500.00"
              />
              <p className={helperClasses}>
                Enter amount in dollars (e.g., 500.00)
              </p>
              {fieldErrors.stickerValue && (
                <p className={errorClasses}>{fieldErrors.stickerValue}</p>
              )}
            </div>

            {/* Reset Cadence field */}
            <div>
              <label className={labelClasses}>
                Reset Cadence *
              </label>
              <select
                name="resetCadence"
                value={formData.resetCadence}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className={inputClasses}
              >
                <option value="">Select a cadence</option>
                <option value="ANNUAL">Annual</option>
                <option value="PER_TRANSACTION">Per Transaction</option>
                <option value="PER_DAY">Per Day</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ONE_TIME">One Time</option>
              </select>
              {fieldErrors.resetCadence && (
                <p className={errorClasses}>{fieldErrors.resetCadence}</p>
              )}
            </div>

            {/* ── Claiming Cadence ───────────────────────────── */}
            <div>
              <label className={labelClasses}>
                Claiming Cadence
              </label>
              <select
                name="claimingCadence"
                value={formData.claimingCadence}
                onChange={handleCadenceChange}
                disabled={isSubmitting}
                className={inputClasses}
              >
                <option value="">Not Set</option>
                {CLAIMING_CADENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className={helperClasses}>
                How often this benefit resets within the year
              </p>
              {fieldErrors.claimingCadence && (
                <p className={errorClasses}>{fieldErrors.claimingCadence}</p>
              )}
            </div>

            {/* ── Claiming Amount ────────────────────────────── */}
            <div>
              <label className={labelClasses}>
                Claiming Amount ($)
              </label>
              <input
                type="text"
                name="claimingAmount"
                value={formData.claimingAmount}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className={inputClasses}
                placeholder="0.00"
              />
              {suggestedAmount && (
                <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                  {suggestedAmount}
                </p>
              )}
              <p className={helperClasses}>
                Amount per period in dollars
              </p>
              {fieldErrors.claimingAmount && (
                <p className={errorClasses}>{fieldErrors.claimingAmount}</p>
              )}
            </div>

            {/* ── Variable Amounts (Month Overrides) ─────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClasses}>
                  Month Overrides
                </label>
                <button
                  type="button"
                  onClick={handleAddOverride}
                  disabled={isSubmitting || usedMonths.size >= 12}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  <Plus size={14} />
                  Add Override
                </button>
              </div>

              {variableAmounts.length === 0 ? (
                <p className={helperClasses}>
                  Override the default per-period amount for specific months
                </p>
              ) : (
                <div className="space-y-2">
                  {variableAmounts.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={entry.month}
                        onChange={(e) => handleOverrideChange(idx, 'month', e.target.value)}
                        disabled={isSubmitting}
                        className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 text-sm"
                      >
                        {MONTH_NAMES.map((name, mIdx) => {
                          const monthNum = String(mIdx + 1);
                          const isUsedElsewhere = usedMonths.has(monthNum) && entry.month !== monthNum;
                          return (
                            <option key={monthNum} value={monthNum} disabled={isUsedElsewhere}>
                              {name}
                            </option>
                          );
                        })}
                      </select>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input
                          type="text"
                          value={entry.amount}
                          onChange={(e) => handleOverrideChange(idx, 'amount', e.target.value)}
                          disabled={isSubmitting}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOverride(idx)}
                        disabled={isSubmitting}
                        className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 transition-colors"
                        aria-label={`Remove ${MONTH_NAMES[Number(entry.month) - 1]} override`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <p className={helperClasses}>
                    Override the default per-period amount for specific months
                  </p>
                </div>
              )}
              {fieldErrors.variableAmounts && (
                <p className={errorClasses}>{fieldErrors.variableAmounts}</p>
              )}
            </div>

            {/* ── Is Active Toggle ───────────────────────────── */}
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 dark:peer-focus:ring-blue-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </label>
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Active
                </span>
                <p className={helperClasses}>
                  Inactive benefits won&apos;t be generated for new cards
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
