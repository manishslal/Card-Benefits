/**
 * Form validators using Zod
 * 
 * Provides reusable validation schemas for:
 * - Card operations
 * - Benefit operations
 * - User role assignments
 */

import { z } from 'zod';

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
    .max(100, 'Card name must be 100 characters or less'),
  defaultAnnualFee: z
    .number()
    .nonnegative('Annual fee must be non-negative'),
  cardImageUrl: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
});

/**
 * Benefit validators
 */
export const benefitFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Benefit name is required')
    .max(100, 'Benefit name must be 100 characters or less'),
  type: z.enum(['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER']),
  stickerValue: z
    .number()
    .nonnegative('Sticker value must be non-negative'),
  resetCadence: z.enum(['ANNUAL', 'MONTHLY', 'PER_TRANSACTION', 'PER_DAY', 'ONE_TIME']),
});

/**
 * Role assignment validator
 */
export const roleAssignmentSchema = z.object({
  userId: z
    .string()
    .min(1, 'User is required'),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']),
});

/**
 * Search validator
 */
export const searchSchema = z.object({
  q: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});
