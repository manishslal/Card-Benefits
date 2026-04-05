// Shared Library Exports - Barrel Export
// Re-exports all shared utilities and helpers

// Format utilities
export { formatCurrency } from './format-currency';

// Error handling
export { AppError, ERROR_CODES, ERROR_MESSAGES, createErrorResponse, createSuccessResponse } from './errors';
export type { ErrorCode, SuccessResponse, ErrorResponse, ActionResponse } from './errors';

// General utilities
export { cn } from './utils';

// Validation helpers
export { 
  validateEmail, 
  validatePassword, 
  validateString,
  validateNumber,
  validateDate,
  validateUUID,
  validateEnum,
  validateMonetaryValue
} from './validation';

// Database
export { prisma } from './prisma';

// Rate limiting
export { RateLimiter } from './rate-limiter';

