/**
 * claiming-errors.ts
 * 
 * Error codes and definitions for claiming cadence validation.
 * Used consistently across API responses and validation logic.
 */

export enum ClaimingErrorCode {
  CLAIMING_WINDOW_CLOSED = 'CLAIMING_WINDOW_CLOSED',
  CLAIMING_LIMIT_EXCEEDED = 'CLAIMING_LIMIT_EXCEEDED',
  ALREADY_CLAIMED_ONE_TIME = 'ALREADY_CLAIMED_ONE_TIME',
  INVALID_CLAIMING_AMOUNT = 'INVALID_CLAIMING_AMOUNT',
  PERIOD_BOUNDARY_VIOLATION = 'PERIOD_BOUNDARY_VIOLATION',
  UNAUTHORIZED_CLAIMING = 'UNAUTHORIZED_CLAIMING',
}

export interface ClaimingError {
  code: ClaimingErrorCode;
  message: string;
  details?: Record<string, any>;
  statusCode: number;
}

export const CLAIMING_ERROR_MESSAGES: Record<ClaimingErrorCode, string> = {
  [ClaimingErrorCode.CLAIMING_WINDOW_CLOSED]:
    'The claiming window for this benefit has closed.',
  [ClaimingErrorCode.CLAIMING_LIMIT_EXCEEDED]:
    'You cannot claim this amount. It exceeds the limit for this period.',
  [ClaimingErrorCode.ALREADY_CLAIMED_ONE_TIME]:
    'This one-time benefit has already been claimed.',
  [ClaimingErrorCode.INVALID_CLAIMING_AMOUNT]:
    'The claiming amount is invalid.',
  [ClaimingErrorCode.PERIOD_BOUNDARY_VIOLATION]:
    'The claim date violates period boundaries.',
  [ClaimingErrorCode.UNAUTHORIZED_CLAIMING]:
    'You do not have permission to claim this benefit.',
};

export function createClaimingError(
  code: ClaimingErrorCode,
  details?: Record<string, any>,
  customMessage?: string
): ClaimingError {
  return {
    code,
    message: customMessage || CLAIMING_ERROR_MESSAGES[code],
    details,
    statusCode: getStatusCodeForError(code),
  };
}

function getStatusCodeForError(code: ClaimingErrorCode): number {
  switch (code) {
    case ClaimingErrorCode.CLAIMING_LIMIT_EXCEEDED:
    case ClaimingErrorCode.INVALID_CLAIMING_AMOUNT:
    case ClaimingErrorCode.PERIOD_BOUNDARY_VIOLATION:
      return 400;
    case ClaimingErrorCode.CLAIMING_WINDOW_CLOSED:
    case ClaimingErrorCode.ALREADY_CLAIMED_ONE_TIME:
      return 410; // Gone - resource no longer available
    case ClaimingErrorCode.UNAUTHORIZED_CLAIMING:
      return 403;
    default:
      return 400;
  }
}
