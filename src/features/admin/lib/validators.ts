/**
 * Form validators using Zod
 * 
 * Provides reusable validation schemas for:
 * - Card operations
 * - Benefit operations
 * - User role assignments
 */

import { z } from 'zod';
import type { CardFormData, BenefitFormData, RoleAssignmentFormData } from '../types/forms';

/**
 * Card validators
 */
export const cardFormSchema = z.object({
  issuer: z
    .string()
    .min(1, 'Issuer is required')
    .max(100, 'Issuer must be 100 characters or less'),
  cardName: z
    .string()
    .min(1, 'Card name is required')
    .max(200, 'Card name must be 200 characters or less'),
  defaultAnnualFee: z
    .number()
    .int('Annual fee must be an integer')
    .min(0, 'Annual fee must be non-negative'),
  cardImageUrl: z
    .string()
    .url('Card image URL must be a valid URL'),
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional()
    .or(z.literal('')),
});

export type CardFormSchema = z.infer<typeof cardFormSchema>;

/**
 * Benefit validators
 */
export const benefitFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Benefit name is required')
    .max(200, 'Benefit name must be 200 characters or less'),
  type: z
    .enum(['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER'])
    .refine((val) => val !== '', 'Benefit type is required'),
  stickerValue: z
    .number()
    .int('Sticker value must be an integer')
    .min(0, 'Sticker value must be non-negative'),
  resetCadence: z
    .enum(['ANNUAL', 'PER_TRANSACTION', 'PER_DAY', 'MONTHLY', 'ONE_TIME'])
    .refine((val) => val !== '', 'Reset cadence is required'),
  isDefault: z.boolean().default(true),
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional()
    .or(z.literal('')),
});

export type BenefitFormSchema = z.infer<typeof benefitFormSchema>;

/**
 * Role assignment validator
 */
export const roleAssignmentSchema = z.object({
  userId: z
    .string()
    .min(1, 'User is required'),
  role: z
    .enum(['USER', 'ADMIN'])
    .refine((val) => val !== '', 'Role is required'),
  reason: z
    .string()
    .max(500, 'Reason must be 500 characters or less')
    .optional()
    .or(z.literal('')),
});

export type RoleAssignmentSchema = z.infer<typeof roleAssignmentSchema>;

/**
 * Generic validation function
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: any
): { valid: boolean; errors: Record<string, string>; data?: T } {
  try {
    const validated = schema.parse(data);
    return { valid: true, errors: {}, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { valid: false, errors };
    }
    return {
      valid: false,
      errors: { _form: 'Validation failed' },
    };
  }
}

/**
 * Field-level validators
 */
export const fieldValidators = {
  issuer: (value: string): string | undefined => {
    if (!value) return 'Issuer is required';
    if (value.length > 100) return 'Issuer must be 100 characters or less';
    return undefined;
  },

  cardName: (value: string): string | undefined => {
    if (!value) return 'Card name is required';
    if (value.length > 200) return 'Card name must be 200 characters or less';
    return undefined;
  },

  defaultAnnualFee: (value: number): string | undefined => {
    if (value === null || value === undefined) return 'Annual fee is required';
    if (!Number.isInteger(value)) return 'Annual fee must be an integer';
    if (value < 0) return 'Annual fee must be non-negative';
    return undefined;
  },

  cardImageUrl: (value: string): string | undefined => {
    if (!value) return 'Card image URL is required';
    try {
      new URL(value);
      return undefined;
    } catch {
      return 'Invalid URL format';
    }
  },

  benefitName: (value: string): string | undefined => {
    if (!value) return 'Benefit name is required';
    if (value.length > 200) return 'Benefit name must be 200 characters or less';
    return undefined;
  },

  benefitType: (value: string): string | undefined => {
    if (!value) return 'Benefit type is required';
    const validTypes = ['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER'];
    if (!validTypes.includes(value)) return 'Invalid benefit type';
    return undefined;
  },

  stickerValue: (value: number): string | undefined => {
    if (value === null || value === undefined) return 'Sticker value is required';
    if (!Number.isInteger(value)) return 'Sticker value must be an integer';
    if (value < 0) return 'Sticker value must be non-negative';
    return undefined;
  },

  resetCadence: (value: string): string | undefined => {
    if (!value) return 'Reset cadence is required';
    const validCadences = ['ANNUAL', 'PER_TRANSACTION', 'PER_DAY', 'MONTHLY', 'ONE_TIME'];
    if (!validCadences.includes(value)) return 'Invalid reset cadence';
    return undefined;
  },

  email: (value: string): string | undefined => {
    if (!value) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Invalid email format';
    return undefined;
  },

  description: (value: string | undefined): string | undefined => {
    if (value && value.length > 1000) {
      return 'Description must be 1000 characters or less';
    }
    return undefined;
  },

  url: (value: string): string | undefined => {
    if (!value) return undefined;
    try {
      new URL(value);
      return undefined;
    } catch {
      return 'Invalid URL format';
    }
  },

  role: (value: string): string | undefined => {
    if (!value) return 'Role is required';
    if (!['USER', 'ADMIN'].includes(value)) return 'Invalid role';
    return undefined;
  },
};

/**
 * Async validators (for server-side validation)
 */
export const asyncValidators = {
  /**
   * Check if card already exists
   * This would call the API in a real scenario
   */
  cardExists: async (issuer: string, cardName: string): Promise<string | undefined> => {
    // In a real app, you'd check against the API
    return undefined;
  },

  /**
   * Check if benefit name is unique for card
   */
  benefitUnique: async (
    cardId: string,
    name: string,
    excludeId?: string
  ): Promise<string | undefined> => {
    // In a real app, you'd check against the API
    return undefined;
  },

  /**
   * Validate user exists
   */
  userExists: async (userId: string): Promise<string | undefined> => {
    // In a real app, you'd check against the API
    return undefined;
  },
};
