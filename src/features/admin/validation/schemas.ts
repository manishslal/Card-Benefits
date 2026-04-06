/**
 * Zod validation schemas for Admin API endpoints.
 *
 * This module provides reusable validation schemas for:
 * - Card creation and updates
 * - Benefit creation and updates
 * - User role management
 * - Pagination and filtering
 * - Query parameters
 *
 * All schemas follow strict validation rules matching the specification.
 */

import { z } from 'zod';

// ============================================================
// Common Schemas
// ============================================================

/**
 * Pagination query parameters validation
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Sorting schema for list endpoints
 */
export const SortSchema = z.object({
  sortBy: z.enum(['issuer', 'cardName', 'displayOrder', 'updatedAt']).default('displayOrder'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

// ============================================================
// Card Management Schemas
// ============================================================

/**
 * Validation for card creation request body
 */
export const CreateCardSchema = z.object({
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
    .optional(),
});

export type CreateCardInput = z.infer<typeof CreateCardSchema>;

/**
 * Validation for card update request body
 * All fields are optional (PATCH semantics)
 */
export const UpdateCardSchema = z.object({
  cardName: z
    .string()
    .min(1, 'Card name must not be empty')
    .max(200, 'Card name must be 200 characters or less')
    .optional(),
  defaultAnnualFee: z
    .number()
    .int('Annual fee must be an integer')
    .min(0, 'Annual fee must be non-negative')
    .optional(),
  cardImageUrl: z
    .string()
    .url('Card image URL must be a valid URL')
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;

/**
 * Query parameters for listing cards
 */
export const ListCardsQuerySchema = PaginationQuerySchema.extend({
  issuer: z.string().optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['issuer', 'cardName', 'displayOrder', 'updatedAt']).default('displayOrder'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

export type ListCardsQuery = z.infer<typeof ListCardsQuerySchema>;

/**
 * Query parameters for deleting cards
 */
export const DeleteCardQuerySchema = z.object({
  force: z.coerce.boolean().default(false),
  archiveInstead: z.coerce.boolean().default(false),
});

export type DeleteCardQuery = z.infer<typeof DeleteCardQuerySchema>;

/**
 * Request body for reordering cards
 */
export const ReorderCardsSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string().min(1, 'Card ID is required'),
      displayOrder: z.number().int().min(0, 'Display order must be non-negative'),
    })
  ).min(1, 'At least one card must be provided'),
});

export type ReorderCardsInput = z.infer<typeof ReorderCardsSchema>;

// ============================================================
// Benefit Management Schemas
// ============================================================

/**
 * Benefit type enum validation
 */
export const BenefitTypeEnum = z.enum([
  'INSURANCE',
  'CASHBACK',
  'TRAVEL',
  'BANKING',
  'POINTS',
  'OTHER',
]);

/**
 * Reset cadence enum validation
 */
export const ResetCadenceEnum = z.enum([
  'ANNUAL',
  'PER_TRANSACTION',
  'PER_DAY',
  'MONTHLY',
  'ONE_TIME',
]);

/**
 * Validation for benefit creation
 */
export const CreateBenefitSchema = z.object({
  name: z
    .string()
    .min(1, 'Benefit name is required')
    .max(200, 'Benefit name must be 200 characters or less'),
  type: BenefitTypeEnum,
  stickerValue: z
    .number()
    .int('Sticker value must be an integer')
    .min(0, 'Sticker value must be non-negative'),
  resetCadence: ResetCadenceEnum,
  isDefault: z.boolean().default(true),
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
});

export type CreateBenefitInput = z.infer<typeof CreateBenefitSchema>;

/**
 * Validation for benefit updates
 */
export const UpdateBenefitSchema = z.object({
  name: z
    .string()
    .min(1, 'Benefit name must not be empty')
    .max(200, 'Benefit name must be 200 characters or less')
    .optional(),
  type: BenefitTypeEnum.optional(),
  stickerValue: z
    .number()
    .int('Sticker value must be an integer')
    .min(0, 'Sticker value must be non-negative')
    .optional(),
  resetCadence: ResetCadenceEnum.optional(),
  isDefault: z.boolean().optional(),
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
});

export type UpdateBenefitInput = z.infer<typeof UpdateBenefitSchema>;

/**
 * Query parameters for listing benefits
 */
export const ListBenefitsQuerySchema = PaginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
});

export type ListBenefitsQuery = z.infer<typeof ListBenefitsQuerySchema>;

/**
 * Validation for toggling benefit default status
 */
export const ToggleBenefitDefaultSchema = z.object({
  isDefault: z.boolean(),
});

export type ToggleBenefitDefaultInput = z.infer<typeof ToggleBenefitDefaultSchema>;

/**
 * Query parameters for deleting benefits
 */
export const DeleteBenefitQuerySchema = z.object({
  force: z.coerce.boolean().default(false),
  deactivateInstead: z.coerce.boolean().default(false),
});

export type DeleteBenefitQuery = z.infer<typeof DeleteBenefitQuerySchema>;

// ============================================================
// User Role Management Schemas
// ============================================================

/**
 * User role enum validation
 */
export const UserRoleEnum = z.enum(['USER', 'ADMIN']);

/**
 * Query parameters for listing users
 */
export const ListUsersQuerySchema = PaginationQuerySchema.extend({
  role: UserRoleEnum.optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;

/**
 * Validation for role assignment
 */
export const AssignRoleSchema = z.object({
  role: UserRoleEnum,
});

export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;

// ============================================================
// Audit Log Schemas
// ============================================================

/**
 * Action type enum validation
 */
export const AuditActionTypeEnum = z.enum(['CREATE', 'UPDATE', 'DELETE']);

/**
 * Resource type enum validation
 */
export const ResourceTypeEnum = z.enum(['CARD', 'BENEFIT', 'USER_ROLE', 'SYSTEM_SETTING']);

/**
 * Query parameters for listing audit logs
 */
export const ListAuditLogsQuerySchema = PaginationQuerySchema.extend({
  actionType: AuditActionTypeEnum.optional(),
  resourceType: ResourceTypeEnum.optional(),
  adminUserId: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
});

export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsQuerySchema>;

// ============================================================
// Response Schemas
// ============================================================

/**
 * Standard pagination metadata response
 */
export const PaginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

/**
 * Standard error response schema
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string(),
  details: z.array(z.object({
    field: z.string(),
    message: z.string(),
  })).optional(),
});

/**
 * Standard success response schema
 */
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  pagination: PaginationMetaSchema.optional(),
  message: z.string().optional(),
  changes: z.record(z.unknown()).optional(),
});

// ============================================================
// Utility Functions
// ============================================================

/**
 * Safely parse query parameters and return validation errors
 */
export function parseQueryParams<T extends z.ZodSchema>(
  schema: T,
  params: Record<string, any>
): { success: boolean; data?: z.infer<T>; errors?: any } {
  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      errors: { _general: ['Validation failed'] },
    };
  }
}

/**
 * Safely parse request body and return validation errors
 */
export function parseRequestBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown
): { success: boolean; data?: z.infer<T>; errors?: any } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return {
        success: false,
        errors: { details },
      };
    }
    return {
      success: false,
      errors: { _general: ['Validation failed'] },
    };
  }
}
