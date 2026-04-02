/**
 * Error Handling System Tests
 *
 * Tests for:
 * - AppError class
 * - ERROR_CODES and ERROR_MESSAGES
 * - Error response creation helpers
 * - HTTP status code mappings
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ERROR_CODES,
  ERROR_MESSAGES,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/errors';

// ============================================================================
// AppError Class Tests
// ============================================================================

describe('AppError', () => {
  it('creates an error with code and message', () => {
    const error = new AppError(ERROR_CODES.AUTH_MISSING);
    expect(error.code).toBe(ERROR_CODES.AUTH_MISSING);
    expect(error.message).toBe('Unauthorized');
    expect(error.name).toBe('AppError');
  });

  it('includes details when provided', () => {
    const details = { field: 'email', reason: 'Already exists' };
    const error = new AppError(ERROR_CODES.CONFLICT_DUPLICATE, details);
    expect(error.details).toEqual(details);
  });

  it('is an instanceof AppError', () => {
    const error = new AppError(ERROR_CODES.VALIDATION_EMAIL);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('serializes to JSON correctly', () => {
    const error = new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'name',
      reason: 'Required',
    });
    const json = error.toJSON();

    expect(json.code).toBe(ERROR_CODES.VALIDATION_FIELD);
    expect(json.message).toBe('Invalid input');
    expect(json.statusCode).toBe(400);
    expect(json.details).toEqual({
      field: 'name',
      reason: 'Required',
    });
  });

  it('does not include details in JSON when not provided', () => {
    const error = new AppError(ERROR_CODES.AUTH_MISSING);
    const json = error.toJSON();
    expect(json.details).toBeUndefined();
  });

  it('maintains prototype chain for instanceof checks', () => {
    const error = new AppError(ERROR_CODES.INTERNAL_ERROR);
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

// ============================================================================
// ERROR_CODES Enum Tests
// ============================================================================

describe('ERROR_CODES', () => {
  it('defines all authentication error codes', () => {
    expect(ERROR_CODES.AUTH_MISSING).toBeDefined();
    expect(ERROR_CODES.AUTH_INVALID).toBeDefined();
    expect(ERROR_CODES.AUTH_EXPIRED).toBeDefined();
  });

  it('defines all authorization error codes', () => {
    expect(ERROR_CODES.AUTHZ_DENIED).toBeDefined();
    expect(ERROR_CODES.AUTHZ_OWNERSHIP).toBeDefined();
  });

  it('defines all validation error codes', () => {
    expect(ERROR_CODES.VALIDATION_EMAIL).toBeDefined();
    expect(ERROR_CODES.VALIDATION_PASSWORD).toBeDefined();
    expect(ERROR_CODES.VALIDATION_FIELD).toBeDefined();
  });

  it('defines all resource error codes', () => {
    expect(ERROR_CODES.RESOURCE_NOT_FOUND).toBeDefined();
    expect(ERROR_CODES.RESOURCE_DELETED).toBeDefined();
  });

  it('defines all conflict error codes', () => {
    expect(ERROR_CODES.CONFLICT_DUPLICATE).toBeDefined();
    expect(ERROR_CODES.CONFLICT_STATE).toBeDefined();
  });

  it('defines rate limiting error code', () => {
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBeDefined();
  });

  it('defines server error codes', () => {
    expect(ERROR_CODES.INTERNAL_ERROR).toBeDefined();
    expect(ERROR_CODES.DATABASE_ERROR).toBeDefined();
  });

  it('all codes are strings', () => {
    Object.values(ERROR_CODES).forEach((code) => {
      expect(typeof code).toBe('string');
    });
  });
});

// ============================================================================
// ERROR_MESSAGES Mapping Tests
// ============================================================================

describe('ERROR_MESSAGES', () => {
  it('has messages for all error codes', () => {
    Object.values(ERROR_CODES).forEach((code) => {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(ERROR_MESSAGES[code].message).toBeDefined();
      expect(ERROR_MESSAGES[code].statusCode).toBeDefined();
    });
  });

  it('maps authentication errors to 401 status', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.AUTH_MISSING].statusCode).toBe(401);
    expect(ERROR_MESSAGES[ERROR_CODES.AUTH_INVALID].statusCode).toBe(401);
    expect(ERROR_MESSAGES[ERROR_CODES.AUTH_EXPIRED].statusCode).toBe(401);
  });

  it('maps authorization errors to 403 status', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.AUTHZ_DENIED].statusCode).toBe(403);
    expect(ERROR_MESSAGES[ERROR_CODES.AUTHZ_OWNERSHIP].statusCode).toBe(403);
  });

  it('maps validation errors to 400 status', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.VALIDATION_EMAIL].statusCode).toBe(400);
    expect(ERROR_MESSAGES[ERROR_CODES.VALIDATION_PASSWORD].statusCode).toBe(400);
    expect(ERROR_MESSAGES[ERROR_CODES.VALIDATION_FIELD].statusCode).toBe(400);
  });

  it('maps resource errors to 404 status', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.RESOURCE_NOT_FOUND].statusCode).toBe(404);
    expect(ERROR_MESSAGES[ERROR_CODES.RESOURCE_DELETED].statusCode).toBe(404);
  });

  it('maps conflict errors to 409 status', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.CONFLICT_DUPLICATE].statusCode).toBe(409);
    expect(ERROR_MESSAGES[ERROR_CODES.CONFLICT_STATE].statusCode).toBe(409);
  });

  it('maps rate limit error to 429 status', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED].statusCode).toBe(429);
  });

  it('maps server errors to 500 status', () => {
    expect(ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR].statusCode).toBe(500);
    expect(ERROR_MESSAGES[ERROR_CODES.DATABASE_ERROR].statusCode).toBe(500);
  });

  it('provides user-friendly messages', () => {
    // Messages should not expose technical details to users
    Object.values(ERROR_MESSAGES).forEach(({ message }) => {
      expect(message.length).toBeGreaterThan(0);
      expect(typeof message).toBe('string');
    });
  });

  it('uses generic messages for server errors', () => {
    // Server errors should not expose implementation details
    expect(ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR].message).toBe('Internal server error');
    expect(ERROR_MESSAGES[ERROR_CODES.DATABASE_ERROR].message).toBe('Internal server error');
  });
});

// ============================================================================
// createErrorResponse Helper Tests
// ============================================================================

describe('createErrorResponse', () => {
  it('creates error response with code and message', () => {
    const response = createErrorResponse(ERROR_CODES.VALIDATION_EMAIL);

    expect(response.success).toBe(false);
    expect(response.error).toBe('Invalid email address');
    expect(response.code).toBe(ERROR_CODES.VALIDATION_EMAIL);
    expect(response.statusCode).toBe(400);
  });

  it('includes details when provided', () => {
    const details = { field: 'email', value: 'invalid' };
    const response = createErrorResponse(ERROR_CODES.VALIDATION_EMAIL, details);

    expect(response.details).toEqual(details);
  });

  it('does not include details when not provided', () => {
    const response = createErrorResponse(ERROR_CODES.AUTH_MISSING);
    expect(response.details).toBeUndefined();
  });

  it('returns correct type structure', () => {
    const response = createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND);

    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('error');
    expect(response).toHaveProperty('code');
    expect(response).toHaveProperty('statusCode');
  });

  it('works with all error codes', () => {
    Object.values(ERROR_CODES).forEach((code) => {
      const response = createErrorResponse(code);
      expect(response.success).toBe(false);
      expect(response.code).toBe(code);
      expect(response.statusCode).toBeDefined();
      expect(response.error).toBeDefined();
    });
  });

  it('maps error code to correct message and status', () => {
    const testCases = [
      [ERROR_CODES.AUTH_MISSING, 'Unauthorized', 401],
      [ERROR_CODES.VALIDATION_PASSWORD, 'Password does not meet requirements', 400],
      [ERROR_CODES.RESOURCE_NOT_FOUND, 'Not found', 404],
      [ERROR_CODES.CONFLICT_DUPLICATE, 'Already claimed', 409],
    ] as const;

    testCases.forEach(([code, expectedMessage, expectedStatus]) => {
      const response = createErrorResponse(code);
      expect(response.error).toBe(expectedMessage);
      expect(response.statusCode).toBe(expectedStatus);
    });
  });
});

// ============================================================================
// createSuccessResponse Helper Tests
// ============================================================================

describe('createSuccessResponse', () => {
  it('creates success response with data', () => {
    const data = { id: '123', name: 'Test Card' };
    const response = createSuccessResponse(data);

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
  });

  it('works with different data types', () => {
    // Object
    let response: any = createSuccessResponse({ id: '1' });
    expect(response.data).toEqual({ id: '1' });

    // Array
    response = createSuccessResponse([1, 2, 3]);
    expect(response.data).toEqual([1, 2, 3]);

    // String
    response = createSuccessResponse('success');
    expect(response.data).toBe('success');

    // Number
    response = createSuccessResponse(42);
    expect(response.data).toBe(42);

    // Null (for operations that don't return data)
    response = createSuccessResponse(null);
    expect(response.data).toBeNull();
  });

  it('returns correct type structure', () => {
    const response = createSuccessResponse({ test: true });

    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('data');
    expect(Object.keys(response).length).toBe(2);
  });
});

// ============================================================================
// Error Code Uniqueness Tests
// ============================================================================

describe('ERROR_CODES Uniqueness', () => {
  it('all codes are unique', () => {
    const codes = Object.values(ERROR_CODES);
    const uniqueCodes = new Set(codes);
    expect(codes.length).toBe(uniqueCodes.size);
  });

  it('codes follow consistent naming pattern', () => {
    Object.entries(ERROR_CODES).forEach(([key, value]) => {
      // Keys should be UPPER_SNAKE_CASE
      expect(key).toMatch(/^[A-Z_]+$/);
      // Values should equal keys
      expect(value).toBe(key);
    });
  });
});

// ============================================================================
// Error Handling Integration Tests
// ============================================================================

describe('Error Handling Integration', () => {
  it('handles error flow from AppError to response', () => {
    // Simulate server action error handling pattern
    try {
      throw new AppError(ERROR_CODES.VALIDATION_EMAIL, { field: 'email' });
    } catch (error) {
      if (error instanceof AppError) {
        const response = createErrorResponse(error.code, error.details);

        expect(response.success).toBe(false);
        expect(response.code).toBe(ERROR_CODES.VALIDATION_EMAIL);
        expect(response.statusCode).toBe(400);
        expect(response.details?.field).toBe('email');
      }
    }
  });

  it('handles mixed success and error responses', () => {
    const successResponse = createSuccessResponse({ id: '123' });
    const errorResponse = createErrorResponse(ERROR_CODES.AUTH_MISSING);

    // Type narrowing should work
    if (successResponse.success) {
      expect(successResponse.data).toBeDefined();
    }

    if (!errorResponse.success) {
      expect(errorResponse.code).toBeDefined();
      expect(errorResponse.statusCode).toBeDefined();
    }
  });

  it('supports error serialization for logging', () => {
    const error = new AppError(ERROR_CODES.DATABASE_ERROR, {
      operation: 'createUser',
      table: 'users',
    });

    const json = error.toJSON();
    const logged = JSON.stringify(json);

    expect(logged).toContain('DATABASE_ERROR');
    expect(logged).toContain('createUser');
    expect(logged).toContain('users');
  });
});
