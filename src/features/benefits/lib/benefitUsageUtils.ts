/**
 * Benefit Usage Utilities
 * 
 * Helper functions for calculating usage metrics, formatting values,
 * detecting duplicates, and managing usage history.
 */

import type { BenefitUsageRecord } from '../types/benefits';

/**
 * Format amount as currency or count based on benefit type
 * @param amount - Amount in cents or count
 * @param type - Benefit type ('CREDIT', 'POINTS', 'NIGHT', etc.)
 * @returns Formatted string
 */
export function formatBenefitAmount(amount: number, type: string): string {
  if (type === 'POINTS' || type === 'MILES') {
    return `${amount.toLocaleString()} ${type}`;
  }

  // Monetary benefits - format as currency
  const dollars = Math.floor(amount / 100);
  const cents = amount % 100;
  return `$${dollars.toLocaleString()}${cents > 0 ? `.${cents.toString().padStart(2, '0')}` : ''}`;
}

/**
 * Calculate percentage of benefit used
 * @param used - Amount used (in cents)
 * @param limit - Benefit limit (in cents), null for unlimited
 * @returns Percentage (0-100+)
 */
export function calculateUsagePercentage(used: number, limit?: number | null): number {
  if (!limit || limit === 0) return 0;
  return Math.round((used / limit) * 100);
}

/**
 * Determine usage status color
 * @param percentageUsed - Percentage of benefit used
 * @returns Color code
 */
export function getUsageColor(percentageUsed: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (percentageUsed >= 100) return 'red';
  if (percentageUsed >= 80) return 'orange';
  if (percentageUsed >= 50) return 'yellow';
  return 'green';
}

/**
 * Get human-readable status text
 * @param used - Amount used
 * @param limit - Benefit limit
 * @param type - Benefit type
 * @returns Status text
 */
export function getUsageStatusText(used: number, limit?: number | null, type: string = 'CREDIT'): string {
  if (!limit) {
    return used === 0 ? 'Not used' : `Used ${formatBenefitAmount(used, type)}`;
  }

  const percentage = calculateUsagePercentage(used, limit);
  const usedFormatted = formatBenefitAmount(used, type);
  const limitFormatted = formatBenefitAmount(limit, type);

  return `${usedFormatted} of ${limitFormatted} (${percentage}%)`;
}

/**
 * Detect if a usage record might be a duplicate
 * @param newRecord - New usage record to check
 * @param existingRecords - Existing records to check against
 * @param tolerance - Allow within tolerance (default: 100 cents = $1)
 * @returns true if likely duplicate
 */
export function isDuplicateUsageRecord(
  newRecord: BenefitUsageRecord,
  existingRecords: BenefitUsageRecord[],
  tolerance: number = 100
): boolean {
  // Same benefit, similar amount, same day = likely duplicate
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  return existingRecords.some(existing => {
    if (existing.benefitId !== newRecord.benefitId) return false;
    if (existing.isDeleted) return false;
    
    const timeDiff = Math.abs(
      new Date(newRecord.usageDate).getTime() - 
      new Date(existing.usageDate).getTime()
    );
    
    const amountDiff = Math.abs(newRecord.amount - existing.amount);
    
    return timeDiff <= oneDayMs && amountDiff <= tolerance;
  });
}

/**
 * Calculate total usage from records
 * @param records - Array of usage records
 * @returns Total amount used
 */
export function calculateTotalUsage(records: BenefitUsageRecord[]): number {
  return records.reduce((sum, record) => {
    if (!record.isDeleted) {
      sum += record.amount;
    }
    return sum;
  }, 0);
}

/**
 * Get unique categories from usage records
 * @param records - Array of usage records
 * @returns Array of unique category strings
 */
export function getUniqueCategories(records: BenefitUsageRecord[]): string[] {
  const categories = new Set<string>();
  
  records.forEach(record => {
    if (record.category && !record.isDeleted) {
      categories.add(record.category);
    }
  });
  
  return Array.from(categories).sort();
}

/**
 * Group usage records by category
 * @param records - Array of usage records
 * @returns Object with categories as keys and total usage as values
 */
export function groupByCategory(records: BenefitUsageRecord[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  
  records.forEach(record => {
    if (record.isDeleted) return;
    
    const category = record.category || 'Uncategorized';
    grouped[category] = (grouped[category] || 0) + record.amount;
  });
  
  return grouped;
}

/**
 * Get usage by date range
 * @param records - Array of usage records
 * @param startDate - Range start
 * @param endDate - Range end
 * @returns Filtered records in date range
 */
export function getUsageInDateRange(
  records: BenefitUsageRecord[],
  startDate: Date,
  endDate: Date
): BenefitUsageRecord[] {
  const start = startDate.getTime();
  const end = endDate.getTime();
  
  return records.filter(record => {
    const recordTime = new Date(record.usageDate).getTime();
    return !record.isDeleted && recordTime >= start && recordTime <= end;
  });
}

/**
 * Calculate usage statistics
 * @param records - Array of usage records
 * @returns Usage statistics
 */
export function calculateUsageStats(records: BenefitUsageRecord[]) {
  const activeRecords = records.filter(r => !r.isDeleted);
  
  if (activeRecords.length === 0) {
    return {
      count: 0,
      total: 0,
      average: 0,
      min: 0,
      max: 0,
    };
  }
  
  const amounts = activeRecords.map(r => r.amount);
  const total = amounts.reduce((a, b) => a + b, 0);
  
  return {
    count: activeRecords.length,
    total,
    average: Math.round(total / activeRecords.length),
    min: Math.min(...amounts),
    max: Math.max(...amounts),
  };
}

/**
 * Format date for display in usage history
 * @param date - Date to format
 * @param showYear - Whether to include year
 * @returns Formatted date string
 */
export function formatUsageDate(date: Date, showYear: boolean = false): string {
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const formatted = `${months[d.getMonth()]} ${d.getDate()}`;
  
  if (showYear) {
    return `${formatted}, ${d.getFullYear()}`;
  }
  
  return formatted;
}

/**
 * Check if a benefit is expiring soon
 * @param expirationDate - Benefit expiration date
 * @param daysThreshold - Consider expiring if within this many days (default: 7)
 * @returns true if expiring soon
 */
export function isExpiringsSoon(expirationDate: Date | undefined, daysThreshold: number = 7): boolean {
  if (!expirationDate) return false;
  
  const now = new Date();
  const daysUntilExpiration = Math.ceil(
    (new Date(expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysUntilExpiration <= daysThreshold && daysUntilExpiration > 0;
}

/**
 * Validate usage record input
 * @param input - Usage record input
 * @returns Array of validation errors (empty if valid)
 */
export function validateUsageRecord(input: {
  amount?: unknown;
  description?: unknown;
  usageDate?: unknown;
  category?: unknown;
}): string[] {
  const errors: string[] = [];
  
  if (typeof input.amount !== 'number' || input.amount < 0 || input.amount > 999999 * 100) {
    errors.push('Amount must be between 0 and 999,999');
  }
  
  if (typeof input.description !== 'string' || input.description.length === 0) {
    errors.push('Description is required');
  } else if (input.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }
  
  if (input.usageDate && !(input.usageDate instanceof Date)) {
    errors.push('Usage date must be a valid date');
  }
  
  if (input.category && typeof input.category !== 'string') {
    errors.push('Category must be a string');
  } else if (input.category && typeof input.category === 'string' && input.category.length > 100) {
    errors.push('Category must be 100 characters or less');
  }
  
  return errors;
}
