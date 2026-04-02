# Centralized Error Handling & Validation System

This guide demonstrates how to use the standardized error handling and validation system in server actions and API routes.

## Files Overview

- **`src/lib/errors.ts`** - Error codes, messages, and helper functions
- **`src/lib/validation.ts`** - Input validation utilities
- **`src/__tests__/error-handling.test.ts`** - Error system tests (40 tests)
- **`src/__tests__/validation.test.ts`** - Validation system tests (57 tests)

## Quick Start

### Pattern: Basic Server Action with Validation and Error Handling

```typescript
'use server';

import { validateString, validateEmail } from '@/lib/validation';
import {
  AppError,
  ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  ActionResponse
} from '@/lib/errors';

export async function myServerAction(
  email: string,
  name: string,
): Promise<ActionResponse<{ id: string }>> {
  try {
    // Step 1: Validate all inputs
    validateEmail(email);
    validateString(name, 'name', { minLength: 1, maxLength: 100 });

    // Step 2: Authenticate (if needed)
    const userId = getAuthUserIdOrThrow();

    // Step 3: Authorize (if needed)
    await verifyOwnership(resourceId, userId);

    // Step 4: Execute business logic
    const result = await createSomething();

    // Step 5: Return success response
    return createSuccessResponse(result);
  } catch (error) {
    // Convert AppError to response, log unexpected errors
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }
    console.error('[myServerAction]', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}
```

## Error Codes & HTTP Status Codes

### Authentication (401)
- `AUTH_MISSING` - No session/token provided
- `AUTH_INVALID` - Invalid/expired token
- `AUTH_EXPIRED` - Session expired

### Authorization (403)
- `AUTHZ_DENIED` - User not allowed to perform action
- `AUTHZ_OWNERSHIP` - User doesn't own the resource

### Validation (400)
- `VALIDATION_EMAIL` - Invalid email format
- `VALIDATION_PASSWORD` - Password doesn't meet requirements
- `VALIDATION_FIELD` - Generic field validation failure

### Resource Not Found (404)
- `RESOURCE_NOT_FOUND` - Player/card/benefit not found
- `RESOURCE_DELETED` - Resource already deleted

### Conflict (409)
- `CONFLICT_DUPLICATE` - Resource already exists (e.g., card already added)
- `CONFLICT_STATE` - Wrong state for operation

### Rate Limiting (429)
- `RATE_LIMIT_EXCEEDED` - Too many requests from user

### Server Errors (500)
- `INTERNAL_ERROR` - Unexpected server error
- `DATABASE_ERROR` - Database operation failed

## Validation Functions

All validation functions throw `AppError` on failure. Let them bubble up to your catch block.

### Email

```typescript
validateEmail('user@example.com');
// Throws on invalid format, non-string, or empty
```

### Password

Requires:
- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

```typescript
validatePassword('SecurePass123');
// Throws on weak password
```

### String

```typescript
const name = validateString(value, 'name', {
  minLength: 1,
  maxLength: 100,
  pattern: /^[a-zA-Z\s]+$/,  // optional
  allowEmpty: false,          // default
});
```

### Number

```typescript
const count = validateNumber(value, 'count', {
  min: 0,
  max: 100,
  integer: true,
});
```

### Date

```typescript
const expiry = validateDate(value, 'expiryDate', {
  minDate: new Date(),
  maxDate: new Date('2030-12-31'),
});
```

### UUID

```typescript
validateUUID(playerId, 'playerId');
// Validates UUID v4 format
```

### Enum

```typescript
validateEnum(status, 'status', ['ACTIVE', 'INACTIVE', 'PENDING']);
```

### Monetary Value (Cents)

```typescript
const cents = validateMonetaryValue(value, 'amount');
// Validates: non-negative, safe integer
```

## Response Types

### Success Response

```typescript
{
  success: true,
  data: { /* your data */ }
}
```

### Error Response

```typescript
{
  success: false,
  error: "User-friendly error message",
  code: "ERROR_CODE",
  statusCode: 400,  // HTTP status
  details?: { /* optional additional info */ }
}
```

## Example: Complex Server Action

```typescript
export async function addCardToWallet(
  playerId: string,
  masterCardId: string,
  renewalDate: Date,
): Promise<ActionResponse<UserCard>> {
  try {
    // Validate inputs
    validateString(playerId, 'playerId');
    validateString(masterCardId, 'masterCardId');
    validateDate(renewalDate, 'renewalDate', {
      minDate: new Date(),
    });

    // Authenticate
    const userId = getAuthUserIdOrThrow();

    // Authorize
    const ownership = await verifyPlayerOwnership(playerId, userId);
    if (!ownership.isOwner) {
      return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP);
    }

    // Create card (may throw Prisma errors)
    const userCard = await createUserCardWithBenefits(
      playerId,
      masterCardId,
      renewalDate
    );

    return createSuccessResponse(userCard);
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        return createErrorResponse(ERROR_CODES.CONFLICT_DUPLICATE);
      }
      if (error.code === 'P2025') {
        // Record not found
        return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND);
      }
    }

    console.error('[addCardToWallet]', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}
```

## Client-Side Usage

```typescript
const response = await myServerAction(email, name);

if (response.success) {
  console.log('Success!', response.data);
} else {
  // response.error: user-friendly message
  // response.code: machine-readable error code
  // response.statusCode: HTTP status (for reference)
  // response.details: additional context (if available)

  switch (response.code) {
    case ERROR_CODES.VALIDATION_EMAIL:
      showEmailError('Please enter a valid email');
      break;
    case ERROR_CODES.AUTHZ_OWNERSHIP:
      showAuthError('You do not have permission');
      break;
    default:
      showError(response.error);
  }
}
```

## Best Practices

1. **Always validate inputs at the start of server actions**
   - Don't assume client validation worked
   - All validate* functions throw AppError
   - Let them bubble to your catch block

2. **Use specific error codes**
   - Use correct error code for the problem
   - Don't return `INTERNAL_ERROR` for validation failures
   - Include details when error code alone isn't enough

3. **Separate client and server error messages**
   - Client gets generic user-friendly messages
   - Server logs get full details for debugging
   - Never expose implementation details to clients

4. **Order: Validate → Authenticate → Authorize → Execute**
   - Check inputs first (cheap)
   - Check auth second (medium cost)
   - Check authorization third (may need DB query)
   - Do business logic last (expensive)

5. **Include helpful details in validation errors**
   - Which field failed
   - Why it failed
   - What constraints weren't met

6. **Handle database errors explicitly**
   - Map Prisma errors to appropriate error codes
   - `P2002` (unique constraint) → `CONFLICT_DUPLICATE`
   - `P2025` (not found) → `RESOURCE_NOT_FOUND`
   - Other DB errors → `DATABASE_ERROR`

## Type Safety

The system is fully typed with TypeScript:

```typescript
// Response type automatically narrows based on success flag
const response = await myAction();

if (response.success) {
  // TypeScript knows response.data exists
  const data = response.data;  // ✅ type-safe
} else {
  // TypeScript knows error fields exist
  const code = response.code;  // ✅ type-safe
}
```

## Testing

97 tests covering:

**Error Handling (40 tests)**
- AppError class creation and serialization
- All error codes and HTTP status mappings
- Error response creation
- Success response creation

**Validation (57 tests)**
- Email validation (8 tests)
- Password validation (10 tests)
- String validation (10 tests)
- Number validation (8 tests)
- Date validation (8 tests)
- UUID validation (4 tests)
- Enum validation (5 tests)
- Monetary value validation (6 tests)

Run tests:
```bash
npm run test -- validation.test.ts error-handling.test.ts
```

## Migration Guide

To update existing server actions:

1. Replace `return { success: false, error: 'X', code: 'Y' }` with `createErrorResponse(ERROR_CODES.X)`
2. Replace `return { success: true, data: X }` with `createSuccessResponse(X)`
3. Add `validateString`, `validateEmail`, etc. calls at start
4. Let AppError bubble to catch block (don't catch validation errors)
5. Update Prisma error handling to use proper error codes
6. Update TypeScript return types to use `ActionResponse<T>`

Example:

**Before:**
```typescript
if (!email || !email.includes('@')) {
  return { success: false, error: 'Invalid email' };
}
```

**After:**
```typescript
validateEmail(email);
```
