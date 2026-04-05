/**
 * Error mapping utility.
 * 
 * Maps API error codes and HTTP status codes to user-friendly messages.
 * Provides error categorization for UI handling (validation, auth, network, etc).
 */

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_EMAIL'
  | 'INVALID_PASSWORD'
  | 'USER_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'EMAIL_EXISTS'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'

export type ErrorCategory = 'validation' | 'auth' | 'conflict' | 'server' | 'network'

/**
 * Structured API error object.
 */
export interface ApiError {
  code: ApiErrorCode
  message: string
  statusCode: number
  field?: string
  category?: ErrorCategory
  recoveryAction?: string
}

/**
 * User-friendly error messages for each error code.
 * These are displayed directly to users (no technical jargon).
 */
const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  'INVALID_INPUT': 'Please check your input and try again.',
  'INVALID_EMAIL': 'Please enter a valid email address.',
  'INVALID_PASSWORD': 'Password must be at least 8 characters with uppercase, lowercase, and numbers.',
  'USER_NOT_FOUND': 'No account found with this email address.',
  'UNAUTHORIZED': 'Invalid email or password.',
  'SESSION_EXPIRED': 'Your session has expired. Please log in again.',
  'EMAIL_EXISTS': 'This email is already registered. Please log in instead.',
  'TOKEN_EXPIRED': 'Password reset link has expired. Please request a new one.',
  'INVALID_TOKEN': 'Invalid or already-used reset link. Please request a new one.',
  'INTERNAL_ERROR': 'Something went wrong on our end. Please try again or contact support.',
  'NETWORK_ERROR': 'Network connection lost. Check your connection and try again.'
}

/**
 * Maps error codes to UI categories for styling/icons.
 */
const ERROR_CATEGORIES: Record<ApiErrorCode, ErrorCategory> = {
  'INVALID_INPUT': 'validation',
  'INVALID_EMAIL': 'validation',
  'INVALID_PASSWORD': 'validation',
  'USER_NOT_FOUND': 'auth',
  'UNAUTHORIZED': 'auth',
  'SESSION_EXPIRED': 'auth',
  'EMAIL_EXISTS': 'conflict',
  'TOKEN_EXPIRED': 'auth',
  'INVALID_TOKEN': 'auth',
  'INTERNAL_ERROR': 'server',
  'NETWORK_ERROR': 'network'
}

/**
 * Maps HTTP status codes to API error codes.
 * 
 * When the backend returns an error code in the response body,
 * use that directly. This mapping is for fallback when no code is provided.
 */
const STATUS_CODE_TO_ERROR_CODE: Record<number, ApiErrorCode> = {
  400: 'INVALID_INPUT',
  401: 'UNAUTHORIZED',
  404: 'USER_NOT_FOUND',
  409: 'EMAIL_EXISTS',
  500: 'INTERNAL_ERROR'
}

/**
 * Converts an API error to a user-friendly message.
 * 
 * @param error - The API error object
 * @returns User-friendly error message
 */
export function mapApiErrorToUserMessage(error: ApiError): string {
  return ERROR_MESSAGES[error.code] || 'An unexpected error occurred. Please try again.'
}

/**
 * Determines if an error is retryable (network or server errors).
 * 
 * @param error - The API error object
 * @returns true if the error can be retried
 */
export function isRetryableError(error: ApiError): boolean {
  return ['NETWORK_ERROR', 'INTERNAL_ERROR'].includes(error.code)
}

/**
 * Gets the error category for UI styling/icons.
 * 
 * Categories:
 * - validation: Field validation errors (red icon, inline message)
 * - auth: Authentication/authorization errors (lock icon)
 * - conflict: Resource conflict (warning icon)
 * - server: Server errors (alert icon)
 * - network: Network errors (wifi icon, with retry)
 * 
 * @param error - The API error object
 * @returns Error category for UI handling
 */
export function getErrorCategory(error: ApiError): ErrorCategory {
  return error.category || ERROR_CATEGORIES[error.code] || 'server'
}

/**
 * Creates an API error from an HTTP status code.
 * 
 * Used as fallback when server doesn't return a structured error code.
 * 
 * @param statusCode - HTTP status code
 * @param message - Optional custom message
 * @returns API error object
 */
export function createErrorFromStatus(statusCode: number, message?: string): ApiError {
  const code: ApiErrorCode = STATUS_CODE_TO_ERROR_CODE[statusCode] || 'INTERNAL_ERROR'
  return {
    code,
    message: message || ERROR_MESSAGES[code],
    statusCode,
    category: ERROR_CATEGORIES[code]
  }
}

/**
 * Parses a fetch error response and creates a structured API error.
 * 
 * Handles:
 * - JSON responses with error code
 * - Plain text responses
 * - Network errors (no response)
 * 
 * @param response - Fetch Response object
 * @param data - Parsed response body (if available)
 * @returns API error object
 */
export async function parseApiError(
  response: Response,
  data?: unknown
): Promise<ApiError> {
  // Try to parse structured error from response
  if (typeof data === 'object' && data !== null) {
    const body = data as Record<string, unknown>
    const code = body.code as ApiErrorCode | undefined
    if (code && code in ERROR_MESSAGES) {
      return {
        code,
        message: (body.message as string) || ERROR_MESSAGES[code],
        statusCode: response.status,
        field: body.field as string | undefined,
        category: ERROR_CATEGORIES[code]
      }
    }
  }

  // Fallback to status code mapping
  return createErrorFromStatus(response.status, (data as any)?.message)
}

/**
 * Checks if a response indicates an error.
 * 
 * @param response - Fetch Response object
 * @returns true if response status indicates an error
 */
export function isErrorResponse(response: Response): boolean {
  return response.status < 200 || response.status >= 300
}
