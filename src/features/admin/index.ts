/**
 * Barrel export for all admin features.
 *
 * This module exports all validation schemas, middleware, and audit utilities
 * needed for admin endpoints.
 */

// ============================================================
// Validation Schemas
// ============================================================

export {
  // Pagination
  PaginationQuerySchema,
  type PaginationMeta,
  // Card Management
  CreateCardSchema,
  UpdateCardSchema,
  ListCardsQuerySchema,
  DeleteCardQuerySchema,
  ReorderCardsSchema,
  type CreateCardInput,
  type UpdateCardInput,
  type ListCardsQuery,
  type DeleteCardQuery,
  type ReorderCardsInput,
  // Benefit Management
  BenefitTypeEnum,
  ResetCadenceEnum,
  CreateBenefitSchema,
  UpdateBenefitSchema,
  ListBenefitsQuerySchema,
  ToggleBenefitDefaultSchema,
  DeleteBenefitQuerySchema,
  type CreateBenefitInput,
  type UpdateBenefitInput,
  type ListBenefitsQuery,
  type ToggleBenefitDefaultInput,
  type DeleteBenefitQuery,
  // User Role Management
  UserRoleEnum,
  ListUsersQuerySchema,
  AssignRoleSchema,
  type ListUsersQuery,
  type AssignRoleInput,
  // Audit Logs
  AuditActionTypeEnum,
  ResourceTypeEnum,
  ListAuditLogsQuerySchema,
  type ListAuditLogsQuery,
  // Parsing utilities
  parseQueryParams,
  parseRequestBody,
} from './validation/schemas';

// ============================================================
// Middleware
// ============================================================

export {
  verifyAdminRole,
  extractRequestContext,
  createAuthErrorResponse,
  type AdminRequestContext,
} from './middleware/auth';

// ============================================================
// Audit Logging
// ============================================================

export {
  createAuditLog,
  logResourceCreation,
  logResourceUpdate,
  logResourceDeletion,
  getChangedFields,
  type AuditLogOptions,
} from './lib/audit';
