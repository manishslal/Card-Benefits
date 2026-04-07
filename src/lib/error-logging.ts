/**
 * QA-008: Safe error logging utility
 * Sanitizes errors to remove PII (Personally Identifiable Information) from production logs
 */

/**
 * Sanitize error for logging
 * Removes user IDs, benefit names, amounts, and other sensitive data
 * 
 * @param error - The error to sanitize
 * @param context - Optional context for development-only logging
 * @returns Safe error message for production logs
 */
export function sanitizeErrorForLogging(
  error: any,
  context?: { userId?: string; benefitId?: string; [key: string]: any }
): string {
  // Extract error code or message
  let errorMessage = 'UNKNOWN_ERROR';

  if (error instanceof Error) {
    errorMessage = error.message || 'UNKNOWN_ERROR';
  } else if (typeof error === 'object' && error !== null) {
    // Prisma errors have a code property
    if (error.code) {
      errorMessage = `${error.code}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // In production, only log the error code/type
  if (process.env.NODE_ENV === 'production') {
    return errorMessage;
  }

  // In development, include context for debugging
  const parts = [errorMessage];
  if (context) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => {
        if (value === undefined) return null;
        return `${key}: ${value}`;
      })
      .filter((x) => x !== null)
      .join(', ');

    if (contextStr) {
      parts.push(`[dev: ${contextStr}]`);
    }
  }

  return parts.join(' ');
}

/**
 * Log an error safely (without PII)
 * 
 * @param context - The context/message for the error
 * @param error - The error object
 * @param piiContext - Optional PII context (only logged in dev)
 */
export function logSafeError(
  context: string,
  error: any,
  piiContext?: { userId?: string; benefitId?: string; [key: string]: any }
): void {
  const sanitized = sanitizeErrorForLogging(error, piiContext);
  console.error(`${context}: ${sanitized}`);
}

/**
 * Determine if an error is expected and safe to return to client
 * 
 * @param error - The error object
 * @returns true if error is safe to expose to client
 */
export function isSafeErrorForClient(error: any): boolean {
  // Prisma unique constraint errors (P2002) are safe
  if (error?.code === 'P2002') return true;

  // Prisma validation errors are safe
  if (error?.code === 'P2025') return true;

  // Custom validation errors are safe
  if (error instanceof ValidationError) return true;

  return false;
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
