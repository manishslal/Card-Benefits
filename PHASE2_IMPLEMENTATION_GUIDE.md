/**
 * PHASE 2 ADMIN API IMPLEMENTATION - REMAINING ENDPOINTS
 * 
 * This document outlines all remaining endpoints to be implemented.
 * Partially implemented: Card Management (3/6 endpoints done)
 * Still needed: Reorder cards, Benefits, Users, Audit Logs
 */

// ============================================================
// CARD MANAGEMENT ENDPOINTS - REMAINING
// ============================================================

/**
 * PATCH /api/admin/cards/reorder
 * 
 * Reorder cards by updating displayOrder field
 * 
 * Request Body:
 * {
 *   "cards": [
 *     { "id": "card_123", "displayOrder": 0 },
 *     { "id": "card_456", "displayOrder": 1 },
 *   ]
 * }
 * 
 * Response 200: Success
 */

// File: src/app/api/admin/cards/reorder/route.ts
// Handler: POST
// Validation: ReorderCardsSchema
// Audit: Log each card's order change

// ============================================================
// BENEFIT MANAGEMENT ENDPOINTS
// ============================================================

/**
 * POST /api/admin/benefits
 * GET /api/admin/cards/[cardId]/benefits
 * PATCH /api/admin/benefits/[id]
 * DELETE /api/admin/benefits/[id]
 * PATCH /api/admin/benefits/[id]/toggle-default
 */

// Files needed:
// - src/app/api/admin/benefits/route.ts (POST list all benefits)
// - src/app/api/admin/cards/[id]/benefits/route.ts (GET + POST per card)
// - src/app/api/admin/benefits/[id]/route.ts (PATCH, DELETE)
// - src/app/api/admin/benefits/[id]/toggle-default/route.ts (PATCH)

// ============================================================
// USER ROLE MANAGEMENT ENDPOINTS
// ============================================================

/**
 * GET /api/admin/users
 * PATCH /api/admin/users/[id]/role
 */

// Files needed:
// - src/app/api/admin/users/route.ts (GET list)
// - src/app/api/admin/users/[id]/role/route.ts (PATCH)

// ============================================================
// AUDIT LOG ENDPOINTS
// ============================================================

/**
 * GET /api/admin/audit-logs
 * GET /api/admin/audit-logs/[id]
 */

// Files needed:
// - src/app/api/admin/audit-logs/route.ts (GET list)
// - src/app/api/admin/audit-logs/[id]/route.ts (GET detail)

// ============================================================
// UTILITY EXPORTS
// ============================================================

// Create barrel export:
// src/features/admin/index.ts

export {
  // Validation
  CreateCardSchema,
  UpdateCardSchema,
  ListCardsQuerySchema,
  CreateBenefitSchema,
  UpdateBenefitSchema,
  ListBenefitsQuerySchema,
  ListUsersQuerySchema,
  AssignRoleSchema,
  ListAuditLogsQuerySchema,
  parseQueryParams,
  parseRequestBody,
} from './validation/schemas';

export {
  // Middleware
  verifyAdminRole,
  createAuthErrorResponse,
  extractRequestContext,
  tryGetAdminContext,
  type AdminRequestContext,
} from './middleware/auth';

export {
  // Audit
  createAuditLog,
  logResourceCreation,
  logResourceUpdate,
  logResourceDeletion,
  getChangedFields,
  formatAuditLogResponse,
  type AuditLogOptions,
} from './lib/audit';

