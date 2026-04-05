/**
 * Error Mapping Utility - Maps API errors to user-friendly messages
 * 
 * Translates technical error codes and HTTP status codes into clear,
 * actionable messages that users understand.
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
  | 'NETWORK_ERROR';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  statusCode: number;
  field?: string;
  recoveryAction?: string;
}

/**
 * Maps API error codes to user-friendly messages
 */
export function mapApiErrorToUserMessage(error: ApiError | unknown): string {
  if (!error || typeof error !== 'object') {
    return 'An unexpected error occurred. Please try again.';
  }

  const apiError = error as Partial<ApiError>;
  const code = apiError.code as ApiErrorCode;

  const messages: Record<ApiErrorCode, string> = {
    'INVALID_INPUT': 'Please check your input and try again.',
    'INVALID_EMAIL': 'Please enter a valid email address.',
    'INVALID_PASSWORD': 'Password must be at least 8 characters with uppercase, lowercase, and numbers.',
    'USER_NOT_FOUND': 'No account found with this email address. Please check and try again or sign up.',
    'UNAUTHORIZED': 'Invalid email or password. Please try again.',
    'SESSION_EXPIRED': 'Your session has expired. Please log in again.',
    'EMAIL_EXISTS': 'This email is already registered. Please log in instead.',
    'TOKEN_EXPIRED': 'Password reset link has expired. Please request a new one.',
    'INVALID_TOKEN': 'Invalid or already-used reset link. Please request a new one.',
    'INTERNAL_ERROR': 'Something went wrong on our end. Please try again or contact support.',
    'NETWORK_ERROR': 'Network connection lost. Check your connection and try again.',
  };

  return messages[code] || 'An unexpected error occurred. Please try again.';
}

/**
 * Determines if an error can be retried
 */
export function isRetryableError(error: ApiError | unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const apiError = error as Partial<ApiError>;
  return ['NETWORK_ERROR', 'INTERNAL_ERROR'].includes(apiError.code as string);
}

/**
 * Determines if an error should be shown as an alert (assertive announcement)
 */
export function isAlertError(error: ApiError | unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const apiError = error as Partial<ApiError>;
  return ['UNAUTHORIZED', 'SESSION_EXPIRED', 'TOKEN_EXPIRED', 'INVALID_TOKEN'].includes(
    apiError.code as string
  );
}

/**
 * Maps HTTP status codes to API error codes
 */
export function mapHttpStatusToErrorCode(statusCode: number, context?: string): ApiErrorCode {
  switch (statusCode) {
    case 400:
      return context === 'password' ? 'INVALID_PASSWORD' : 'INVALID_INPUT';
    case 401:
      return 'UNAUTHORIZED';
    case 404:
      return 'USER_NOT_FOUND';
    case 409:
      return 'EMAIL_EXISTS';
    case 500:
    case 502:
    case 503:
      return 'INTERNAL_ERROR';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Creates a structured API error from various input types
 */
export function createApiError(
  error: unknown,
  statusCode?: number,
  code?: ApiErrorCode
): ApiError {
  if (error instanceof Error) {
    return {
      code: code || 'INTERNAL_ERROR',
      message: error.message,
      statusCode: statusCode || 500,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    return {
      code: (errorObj.code as ApiErrorCode) || code || 'INTERNAL_ERROR',
      message: (errorObj.message as string) || 'Unknown error',
      statusCode: statusCode || (errorObj.statusCode as number) || 500,
      field: errorObj.field as string | undefined,
      recoveryAction: errorObj.recoveryAction as string | undefined,
    };
  }

  return {
    code: code || 'INTERNAL_ERROR',
    message: String(error) || 'Unknown error',
    statusCode: statusCode || 500,
  };
}
