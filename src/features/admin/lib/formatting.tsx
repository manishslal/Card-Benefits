'use client';

/**
 * Formatting utilities for dates, numbers, and text
 */

import React from 'react';
import { format, formatDistance, parseISO } from 'date-fns';

/**
 * Format date to readable string
 */
export function formatDate(
  date: Date | string,
  pattern: string = 'MMM d, yyyy'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, pattern);
}

/**
 * Format date with time
 */
export function formatDateTime(
  date: Date | string,
  pattern: string = 'MMM d, yyyy h:mm a'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, pattern);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(dateObj, new Date(), { addSuffix: true });
}

/**
 * Format currency
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  decimals: number = 0
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100); // Convert cents to dollars
}

/**
 * Format number with comma separators
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert enum value to readable label
 */
export function enumToLabel(value: string): string {
  return value
    .split('_')
    .map((word) => capitalize(word))
    .join(' ');
}

/**
 * Format benefit type for display
 */
export function formatBenefitType(type: string): string {
  const typeMap: Record<string, string> = {
    INSURANCE: 'Insurance',
    CASHBACK: 'Cash Back',
    TRAVEL: 'Travel',
    BANKING: 'Banking',
    POINTS: 'Points',
    OTHER: 'Other',
  };
  return typeMap[type] || type;
}

/**
 * Format reset cadence for display
 */
export function formatResetCadence(cadence: string): string {
  const cadenceMap: Record<string, string> = {
    ANNUAL: 'Annual',
    PER_TRANSACTION: 'Per Transaction',
    PER_DAY: 'Per Day',
    MONTHLY: 'Monthly',
    ONE_TIME: 'One Time',
  };
  return cadenceMap[cadence] || cadence;
}

/**
 * Format action type for audit log display
 */
export function formatActionType(action: string): string {
  const actionMap: Record<string, string> = {
    CREATE: 'Created',
    UPDATE: 'Updated',
    DELETE: 'Deleted',
    TOGGLE: 'Toggled',
  };
  return actionMap[action] || action;
}

/**
 * Format resource type for audit log display
 */
export function formatResourceType(resource: string): string {
  const resourceMap: Record<string, string> = {
    CARD: 'Card',
    BENEFIT: 'Benefit',
    USER_ROLE: 'User Role',
    SYSTEM_SETTING: 'System Setting',
  };
  return resourceMap[resource] || resource;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format phone number
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Highlight search term in text
 */
export function highlightText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm) return text;

  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark key={i}>{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

/**
 * Strip HTML tags from string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
