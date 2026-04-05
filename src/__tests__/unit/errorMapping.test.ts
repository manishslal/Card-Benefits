/**
 * Unit Tests: Error Mapping Utility
 * 
 * Tests the errorMapping.ts utility that converts API errors and HTTP status codes
 * into user-friendly messages and determines error handling behavior (retry, alert).
 */

import { describe, it, expect } from 'vitest';
import {
  mapApiErrorToUserMessage,
  isRetryableError,
  isAlertError,
  mapHttpStatusToErrorCode,
  createApiError,
  type ApiError,
  type ApiErrorCode,
} from '@/shared/lib/errors/errorMapping';

describe('errorMapping.ts', () => {
  // ============================================================
  // Test Suite 1: Error Code to User Message Mapping
  // ============================================================
  
  describe('mapApiErrorToUserMessage', () => {
    it('should map INVALID_INPUT to user-friendly message', () => {
      const error: ApiError = {
        code: 'INVALID_INPUT',
        message: 'Missing email field',
        statusCode: 400,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toBe('Please check your input and try again.');
    });

    it('should map INVALID_EMAIL to user-friendly message', () => {
      const error: ApiError = {
        code: 'INVALID_EMAIL',
        message: 'Email format invalid',
        statusCode: 400,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toBe('Please enter a valid email address.');
    });

    it('should map INVALID_PASSWORD to user-friendly message', () => {
      const error: ApiError = {
        code: 'INVALID_PASSWORD',
        message: 'Password too weak',
        statusCode: 400,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toContain('Password must be at least 8 characters');
    });

    it('should map USER_NOT_FOUND to user-friendly message', () => {
      const error: ApiError = {
        code: 'USER_NOT_FOUND',
        message: 'User does not exist',
        statusCode: 404,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toContain('No account found');
    });

    it('should map UNAUTHORIZED to user-friendly message', () => {
      const error: ApiError = {
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
        statusCode: 401,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toBe('Invalid email or password. Please try again.');
    });

    it('should map SESSION_EXPIRED to user-friendly message', () => {
      const error: ApiError = {
        code: 'SESSION_EXPIRED',
        message: 'Token expired',
        statusCode: 401,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toBe('Your session has expired. Please log in again.');
    });

    it('should map EMAIL_EXISTS to user-friendly message', () => {
      const error: ApiError = {
        code: 'EMAIL_EXISTS',
        message: 'Email already registered',
        statusCode: 409,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toBe('This email is already registered. Please log in instead.');
    });

    it('should map TOKEN_EXPIRED to user-friendly message', () => {
      const error: ApiError = {
        code: 'TOKEN_EXPIRED',
        message: 'Reset token expired',
        statusCode: 400,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toBe('Password reset link has expired. Please request a new one.');
    });

    it('should map INVALID_TOKEN to user-friendly message', () => {
      const error: ApiError = {
        code: 'INVALID_TOKEN',
        message: 'Token invalid or used',
        statusCode: 400,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toContain('Invalid or already-used');
    });

    it('should map INTERNAL_ERROR to user-friendly message', () => {
      const error: ApiError = {
        code: 'INTERNAL_ERROR',
        message: 'Database connection failed',
        statusCode: 500,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toContain('Something went wrong on our end');
    });

    it('should map NETWORK_ERROR to user-friendly message', () => {
      const error: ApiError = {
        code: 'NETWORK_ERROR',
        message: 'Connection timeout',
        statusCode: 0,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toContain('Network connection lost');
    });

    it('should handle unknown error codes with default message', () => {
      const error = {
        code: 'UNKNOWN_CODE' as ApiErrorCode,
        message: 'Unknown error',
        statusCode: 500,
      };
      const message = mapApiErrorToUserMessage(error);
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should handle null error gracefully', () => {
      const message = mapApiErrorToUserMessage(null);
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should handle undefined error gracefully', () => {
      const message = mapApiErrorToUserMessage(undefined);
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should handle non-object error gracefully', () => {
      const message = mapApiErrorToUserMessage('string error');
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });
  });

  // ============================================================
  // Test Suite 2: Retryable Error Detection
  // ============================================================
  
  describe('isRetryableError', () => {
    it('should identify NETWORK_ERROR as retryable', () => {
      const error: ApiError = {
        code: 'NETWORK_ERROR',
        message: 'Connection timeout',
        statusCode: 0,
      };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify INTERNAL_ERROR as retryable', () => {
      const error: ApiError = {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
        statusCode: 500,
      };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should NOT identify INVALID_INPUT as retryable', () => {
      const error: ApiError = {
        code: 'INVALID_INPUT',
        message: 'Missing field',
        statusCode: 400,
      };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should NOT identify INVALID_EMAIL as retryable', () => {
      const error: ApiError = {
        code: 'INVALID_EMAIL',
        message: 'Bad email',
        statusCode: 400,
      };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should NOT identify UNAUTHORIZED as retryable', () => {
      const error: ApiError = {
        code: 'UNAUTHORIZED',
        message: 'Wrong credentials',
        statusCode: 401,
      };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should NOT identify SESSION_EXPIRED as retryable', () => {
      const error: ApiError = {
        code: 'SESSION_EXPIRED',
        message: 'Token expired',
        statusCode: 401,
      };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should handle null error gracefully', () => {
      expect(isRetryableError(null)).toBe(false);
    });

    it('should handle undefined error gracefully', () => {
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  // ============================================================
  // Test Suite 3: Alert Error Detection (Should Show Alert Modal)
  // ============================================================
  
  describe('isAlertError', () => {
    it('should identify UNAUTHORIZED as alert error', () => {
      const error: ApiError = {
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
        statusCode: 401,
      };
      expect(isAlertError(error)).toBe(true);
    });

    it('should identify SESSION_EXPIRED as alert error', () => {
      const error: ApiError = {
        code: 'SESSION_EXPIRED',
        message: 'Token expired',
        statusCode: 401,
      };
      expect(isAlertError(error)).toBe(true);
    });

    it('should identify TOKEN_EXPIRED as alert error', () => {
      const error: ApiError = {
        code: 'TOKEN_EXPIRED',
        message: 'Reset token expired',
        statusCode: 400,
      };
      expect(isAlertError(error)).toBe(true);
    });

    it('should identify INVALID_TOKEN as alert error', () => {
      const error: ApiError = {
        code: 'INVALID_TOKEN',
        message: 'Token used',
        statusCode: 400,
      };
      expect(isAlertError(error)).toBe(true);
    });

    it('should NOT identify INVALID_INPUT as alert error', () => {
      const error: ApiError = {
        code: 'INVALID_INPUT',
        message: 'Missing field',
        statusCode: 400,
      };
      expect(isAlertError(error)).toBe(false);
    });

    it('should NOT identify NETWORK_ERROR as alert error', () => {
      const error: ApiError = {
        code: 'NETWORK_ERROR',
        message: 'Connection lost',
        statusCode: 0,
      };
      expect(isAlertError(error)).toBe(false);
    });

    it('should NOT identify INTERNAL_ERROR as alert error', () => {
      const error: ApiError = {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
        statusCode: 500,
      };
      expect(isAlertError(error)).toBe(false);
    });

    it('should show alert for null error (default behavior)', () => {
      expect(isAlertError(null)).toBe(true);
    });

    it('should show alert for undefined error (default behavior)', () => {
      expect(isAlertError(undefined)).toBe(true);
    });
  });

  // ============================================================
  // Test Suite 4: HTTP Status Code to Error Code Mapping
  // ============================================================
  
  describe('mapHttpStatusToErrorCode', () => {
    it('should map 400 to INVALID_INPUT', () => {
      const code = mapHttpStatusToErrorCode(400);
      expect(code).toBe('INVALID_INPUT');
    });

    it('should map 400 to INVALID_PASSWORD when context is password', () => {
      const code = mapHttpStatusToErrorCode(400, 'password');
      expect(code).toBe('INVALID_PASSWORD');
    });

    it('should map 401 to UNAUTHORIZED', () => {
      const code = mapHttpStatusToErrorCode(401);
      expect(code).toBe('UNAUTHORIZED');
    });

    it('should map 404 to USER_NOT_FOUND', () => {
      const code = mapHttpStatusToErrorCode(404);
      expect(code).toBe('USER_NOT_FOUND');
    });

    it('should map 409 to EMAIL_EXISTS', () => {
      const code = mapHttpStatusToErrorCode(409);
      expect(code).toBe('EMAIL_EXISTS');
    });

    it('should map 500 to INTERNAL_ERROR', () => {
      const code = mapHttpStatusToErrorCode(500);
      expect(code).toBe('INTERNAL_ERROR');
    });

    it('should map 502 to INTERNAL_ERROR', () => {
      const code = mapHttpStatusToErrorCode(502);
      expect(code).toBe('INTERNAL_ERROR');
    });

    it('should map 503 to INTERNAL_ERROR', () => {
      const code = mapHttpStatusToErrorCode(503);
      expect(code).toBe('INTERNAL_ERROR');
    });

    it('should map unknown status codes to INTERNAL_ERROR', () => {
      const code = mapHttpStatusToErrorCode(418); // I'm a teapot
      expect(code).toBe('INTERNAL_ERROR');
    });
  });

  // ============================================================
  // Test Suite 5: Structured Error Creation
  // ============================================================
  
  describe('createApiError', () => {
    it('should create error from Error instance', () => {
      const originalError = new Error('Database connection failed');
      const error = createApiError(originalError, 500);
      
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Database connection failed');
      expect(error.statusCode).toBe(500);
    });

    it('should create error from Error instance with custom code', () => {
      const originalError = new Error('Email validation failed');
      const error = createApiError(originalError, 400, 'INVALID_EMAIL');
      
      expect(error.code).toBe('INVALID_EMAIL');
      expect(error.message).toBe('Email validation failed');
      expect(error.statusCode).toBe(400);
    });

    it('should create error from object with error properties', () => {
      const errorObj = {
        code: 'TOKEN_EXPIRED' as ApiErrorCode,
        message: 'Reset token expired',
        statusCode: 400,
        field: 'token',
      };
      const error = createApiError(errorObj);
      
      expect(error.code).toBe('TOKEN_EXPIRED');
      expect(error.message).toBe('Reset token expired');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe('token');
    });

    it('should create error from partial object', () => {
      const errorObj = {
        message: 'Something failed',
      };
      const error = createApiError(errorObj, 500, 'INTERNAL_ERROR');
      
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Something failed');
      expect(error.statusCode).toBe(500);
    });

    it('should create error from string', () => {
      const error = createApiError('Operation failed', 500, 'INTERNAL_ERROR');
      
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Operation failed');
      expect(error.statusCode).toBe(500);
    });

    it('should use default status code and code when not provided', () => {
      const error = createApiError(new Error('Test error'));
      
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should preserve recoveryAction when provided', () => {
      const errorObj = {
        message: 'Token expired',
        code: 'TOKEN_EXPIRED' as ApiErrorCode,
        recoveryAction: 'request_new_reset_link',
      };
      const error = createApiError(errorObj);
      
      expect(error.recoveryAction).toBe('request_new_reset_link');
    });

    it('should handle null gracefully', () => {
      const error = createApiError(null, 500, 'INTERNAL_ERROR');
      
      expect(error.code).toBe('INTERNAL_ERROR');
      // null gets stringified to 'null' by String(error)
      expect(['Unknown error', 'null']).toContain(error.message);
      expect(error.statusCode).toBe(500);
    });
  });

  // ============================================================
  // Test Suite 6: Error Code Type Coverage (Comprehensive)
  // ============================================================
  
  describe('All API error codes are mapped', () => {
    const allErrorCodes: ApiErrorCode[] = [
      'INVALID_INPUT',
      'INVALID_EMAIL',
      'INVALID_PASSWORD',
      'USER_NOT_FOUND',
      'UNAUTHORIZED',
      'SESSION_EXPIRED',
      'EMAIL_EXISTS',
      'TOKEN_EXPIRED',
      'INVALID_TOKEN',
      'INTERNAL_ERROR',
      'NETWORK_ERROR',
    ];

    allErrorCodes.forEach((code) => {
      it(`should have user message for ${code}`, () => {
        const error: ApiError = {
          code,
          message: `Error: ${code}`,
          statusCode: 400,
        };
        const message = mapApiErrorToUserMessage(error);
        
        // Message should not be the default/fallback message
        expect(message).not.toBe('An unexpected error occurred. Please try again.');
        // Message should be non-empty and meaningful
        expect(message.length).toBeGreaterThan(10);
      });
    });
  });
});
