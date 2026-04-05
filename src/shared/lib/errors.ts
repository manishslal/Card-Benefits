/**
 * Centralized Error Handling System
 *
 * Provides:
 * - Standardized error codes for all error types
 * - User-friendly error messages
 * - HTTP status code mappings
 * - Custom AppError class for consistent error handling
 * - Helper functions for creating error responses
 *
 * All server actions and API routes should use this system to ensure
 * consistent error handling and messaging across the application.
 */

/**
 * Standardized error codes used throughout the application.
 * Each code maps to a user-friendly message and HTTP status code.
 */
export const ERROR_CODES = {
  // Authentication errors (401)
  AUTH_MISSING: 'AUTH_MISSING',           // No session/token provided
  AUTH_INVALID: 'AUTH_INVALID',           // Invalid/expired token
  AUTH_EXPIRED: 'AUTH_EXPIRED',           // Session expired

  // Authorization errors (403)
  AUTHZ_DENIED: 'AUTHZ_DENIED',           // User not allowed to perform action
  AUTHZ_OWNERSHIP: 'AUTHZ_OWNERSHIP',     // User doesn't own the resource

  // Validation errors (400)
  VALIDATION_EMAIL: 'VALIDATION_EMAIL',   // Invalid email format
  VALIDATION_PASSWORD: 'VALIDATION_PASSWORD', // Password doesn't meet requirements
  VALIDATION_FIELD: 'VALIDATION_FIELD',   // Generic field validation failure

  // Resource errors (404)
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',    // Player/card/benefit not found
  RESOURCE_DELETED: 'RESOURCE_DELETED',        // Resource already deleted

  // Conflict errors (409)
  CONFLICT_DUPLICATE: 'CONFLICT_DUPLICATE',    // Resource already exists (e.g., card already added)
  CONFLICT_STATE: 'CONFLICT_STATE',            // Wrong state for operation (e.g., can't claim expired benefit)

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',  // Too many requests from user

  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',       // Unexpected server error
  DATABASE_ERROR: 'DATABASE_ERROR',       // Database operation failed
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Error message lookup table
 * Maps error codes to user-friendly messages and HTTP status codes
 */
export const ERROR_MESSAGES: Record<ErrorCode, { message: string; statusCode: number }> = {
  // Auth errors
  AUTH_MISSING: {
    message: 'Unauthorized',
    statusCode: 401
  },
  AUTH_INVALID: {
    message: 'Unauthorized',
    statusCode: 401
  },
  AUTH_EXPIRED: {
    message: 'Session expired',
    statusCode: 401
  },

  // Authz errors
  AUTHZ_DENIED: {
    message: 'Forbidden',
    statusCode: 403
  },
  AUTHZ_OWNERSHIP: {
    message: 'Forbidden',
    statusCode: 403
  },

  // Validation errors
  VALIDATION_EMAIL: {
    message: 'Invalid email address',
    statusCode: 400
  },
  VALIDATION_PASSWORD: {
    message: 'Password does not meet requirements',
    statusCode: 400
  },
  VALIDATION_FIELD: {
    message: 'Invalid input',
    statusCode: 400
  },

  // Resource errors
  RESOURCE_NOT_FOUND: {
    message: 'Not found',
    statusCode: 404
  },
  RESOURCE_DELETED: {
    message: 'Resource no longer available',
    statusCode: 404
  },

  // Conflict errors
  CONFLICT_DUPLICATE: {
    message: 'Already claimed',
    statusCode: 409
  },
  CONFLICT_STATE: {
    message: 'Invalid state for this operation',
    statusCode: 409
  },

  // Rate limit
  RATE_LIMIT_EXCEEDED: {
    message: 'Too many requests',
    statusCode: 429
  },

  // Server errors (generic messages to client, detailed logs server-side)
  INTERNAL_ERROR: {
    message: 'Internal server error',
    statusCode: 500
  },
  DATABASE_ERROR: {
    message: 'Internal server error',
    statusCode: 500
  },
};

/**
 * Custom error class for application-level errors
 *
 * Usage in server actions:
 * ```typescript
 * throw new AppError(ERROR_CODES.VALIDATION_EMAIL, {
 *   field: 'email',
 *   value: userEmail
 * });
 * ```
 *
 * Use with try/catch to handle errors consistently:
 * ```typescript
 * try {
 *   // server action logic
 * } catch (error) {
 *   if (error instanceof AppError) {
 *     return createErrorResponse(error.code, error.details);
 *   }
 *   console.error('Unexpected error:', error);
 *   return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
 * }
 * ```
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public details?: Record<string, any>,
  ) {
    const { message } = ERROR_MESSAGES[code];
    super(message);
    this.name = 'AppError';
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Serialize error to JSON for API responses or logging
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: ERROR_MESSAGES[this.code].statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Response type for server actions that can fail
 *
 * Usage in server actions:
 * ```typescript
 * type AddCardResult = SuccessResponse<UserCard> | ErrorResponse;
 *
 * export async function addCard(playerId: string, cardId: string): Promise<AddCardResult> {
 *   try {
 *     // logic
 *     return { success: true, data: card };
 *   } catch (error) {
 *     return createErrorResponse(ERROR_CODES.INVALID_INPUT);
 *   }
 * }
 * ```
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, any>;
}

export type ActionResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Helper to create a standardized error response for server actions
 *
 * Automatically includes HTTP status code and error message
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: Record<string, any>,
): ErrorResponse {
  const { message, statusCode } = ERROR_MESSAGES[code];

  return {
    success: false,
    error: message,
    code,
    statusCode,
    ...(details && { details }),
  };
}

/**
 * Helper to create a standardized success response for server actions
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  };
}
