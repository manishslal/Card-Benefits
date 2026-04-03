/**
 * Card Validation Utilities
 * 
 * Server-side validation functions for card management operations.
 * All validation functions throw AppError on failure.
 */

import { ERROR_CODES, AppError } from './errors';
import {
  CardStatus,
  VALID_CARD_TRANSITIONS,
  CUSTOM_NAME_CONSTRAINTS,
  ANNUAL_FEE_CONSTRAINTS
} from '@/types/card-management';

/**
 * Validate a card status value
 * Ensures the provided status is a valid CardStatus
 * 
 * @throws {AppError} If status is invalid
 */
export function validateCardStatus(status: any): status is CardStatus {
  const validStatuses: CardStatus[] = ['ACTIVE', 'PENDING', 'PAUSED', 'ARCHIVED', 'DELETED'];
  return validStatuses.includes(status);
}

/**
 * Validate a card status transition
 * Ensures the transition from current to new status is valid per the state machine
 * 
 * @throws {AppError} If transition is invalid
 */
export function validateCardStatusTransition(
  currentStatus: CardStatus,
  newStatus: CardStatus
): void {
  if (!validateCardStatus(newStatus)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'status',
      reason: `Invalid card status: ${newStatus}`
    });
  }

  const validNextStatuses = VALID_CARD_TRANSITIONS[currentStatus];
  if (!validNextStatuses.includes(newStatus)) {
    throw new AppError(ERROR_CODES.CONFLICT_STATE, {
      field: 'status',
      reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
      details: {
        current: currentStatus,
        requested: newStatus,
        valid: validNextStatuses
      }
    });
  }
}

/**
 * Validate custom card name
 * Ensures the name is within length constraints and doesn't contain suspicious content
 * 
 * @throws {AppError} If name is invalid
 */
export function validateCustomName(name: string | null | undefined): void {
  if (name === null || name === undefined) {
    return; // Optional field
  }

  if (typeof name !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'customName',
      reason: 'Custom name must be a string'
    });
  }

  const trimmed = name.trim();

  if (trimmed.length < CUSTOM_NAME_CONSTRAINTS.minLength) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'customName',
      reason: `Custom name must be at least ${CUSTOM_NAME_CONSTRAINTS.minLength} character`
    });
  }

  if (trimmed.length > CUSTOM_NAME_CONSTRAINTS.maxLength) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'customName',
      reason: `Custom name must not exceed ${CUSTOM_NAME_CONSTRAINTS.maxLength} characters`
    });
  }

  // Basic XSS prevention - reject if contains HTML-like content
  if (/<[^>]*>/.test(trimmed)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'customName',
      reason: 'Custom name cannot contain HTML tags'
    });
  }
}

/**
 * Validate annual fee (override)
 * Ensures the fee is a non-negative integer within acceptable range
 * 
 * @throws {AppError} If fee is invalid
 */
export function validateAnnualFee(fee: number | null | undefined): void {
  if (fee === null || fee === undefined) {
    return; // Optional field
  }

  if (typeof fee !== 'number' || !Number.isInteger(fee)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'actualAnnualFee',
      reason: 'Annual fee must be an integer'
    });
  }

  if (fee < ANNUAL_FEE_CONSTRAINTS.min) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'actualAnnualFee',
      reason: `Annual fee cannot be negative (provided: ${fee})`
    });
  }

  if (fee > ANNUAL_FEE_CONSTRAINTS.max) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'actualAnnualFee',
      reason: `Annual fee cannot exceed $${ANNUAL_FEE_CONSTRAINTS.max / 100}`
    });
  }
}

/**
 * Validate renewal date
 * Ensures the date is a valid Date object and is in the future
 * 
 * @throws {AppError} If date is invalid
 */
export function validateRenewalDate(date: any, allowPast: boolean = false): void {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'renewalDate',
      reason: 'Renewal date must be a valid date'
    });
  }

  if (!allowPast) {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Compare dates only, not time
    
    if (date < now) {
      throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
        field: 'renewalDate',
        reason: 'Renewal date must be in the future'
      });
    }
  }
}

/**
 * Validate card confirmation text for deletion
 * Ensures the confirmation text matches the card name exactly
 * 
 * @throws {AppError} If confirmation doesn't match
 */
export function validateDeleteConfirmation(
  confirmationText: string,
  cardName: string,
  customName?: string | null
): void {
  const expectedName = customName || cardName;
  
  if (confirmationText.trim() !== expectedName) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'confirmation',
      reason: 'Confirmation text does not match card name exactly',
      details: {
        expected: expectedName,
        provided: confirmationText.trim()
      }
    });
  }
}

/**
 * Validate bulk operation card IDs
 * Ensures all card IDs are provided and valid
 * 
 * @throws {AppError} If validation fails
 */
export function validateBulkCardIds(cardIds: any[]): void {
  if (!Array.isArray(cardIds)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'cardIds',
      reason: 'Card IDs must be an array'
    });
  }

  if (cardIds.length === 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'cardIds',
      reason: 'At least one card must be selected'
    });
  }

  if (cardIds.length > 100) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'cardIds',
      reason: 'Cannot update more than 100 cards at once'
    });
  }

  for (const id of cardIds) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
        field: 'cardIds',
        reason: 'All card IDs must be non-empty strings'
      });
    }
  }
}

/**
 * Validate card update request
 * Ensures all provided fields are valid (they are optional)
 * 
 * @throws {AppError} If any field is invalid
 */
export function validateCardUpdateInput(input: Record<string, any>): void {
  if (input.customName !== undefined) {
    validateCustomName(input.customName);
  }

  if (input.actualAnnualFee !== undefined) {
    validateAnnualFee(input.actualAnnualFee);
  }

  if (input.renewalDate !== undefined) {
    const date = new Date(input.renewalDate);
    validateRenewalDate(date);
  }

  if (input.status !== undefined) {
    if (!validateCardStatus(input.status)) {
      throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
        field: 'status',
        reason: `Invalid card status: ${input.status}`
      });
    }
  }
}

/**
 * Validate bulk update request
 * Ensures all bulk operation parameters are valid
 * 
 * @throws {AppError} If validation fails
 */
export function validateBulkUpdateInput(input: {
  cardIds?: any[];
  updates?: Record<string, any>;
}): void {
  if (!input.cardIds) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'cardIds',
      reason: 'Card IDs are required'
    });
  }

  validateBulkCardIds(input.cardIds);

  if (!input.updates || typeof input.updates !== 'object') {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'updates',
      reason: 'Updates object is required'
    });
  }

  validateCardUpdateInput(input.updates);
}
