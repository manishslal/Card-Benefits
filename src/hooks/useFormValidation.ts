'use client';

import { useState, useCallback } from 'react';

/**
 * Form Validation Hook - Real-time Field Validation
 * 
 * Features:
 * - Per-field error state management
 * - Real-time validation on blur
 * - Supports custom validators
 * - Built-in validators: required, email, minLength, maxLength, pattern
 * - Clear error on field change
 * - Batch form validation
 * 
 * Usage:
 * const { errors, validateField, validateForm, clearError } = useFormValidation({
 *   firstName: {
 *     required: true,
 *     minLength: { value: 2, message: 'Min 2 characters' }
 *   }
 * });
 * 
 * // Validate on blur
 * <input onBlur={() => validateField('firstName', value)} />
 * 
 * // Validate entire form
 * if (!validateForm(formData)) return;
 */

interface ValidationRule {
  required?: boolean | string;
  email?: boolean | string;
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  pattern?: { value: RegExp; message: string };
  custom?: (value: any) => string | undefined;
  match?: { field: string; message: string };
}

interface ValidationRules {
  [field: string]: ValidationRule;
}

interface FormData {
  [field: string]: any;
}

interface UseFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

/**
 * useFormValidation Hook
 */
export function useFormValidation(
  rules: ValidationRules,
  options: UseFormValidationOptions = {
    validateOnBlur: true,
    validateOnChange: false,
  }
) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Validate a single field
   */
  const validateField = useCallback(
    (field: string, value: any, formData?: FormData): string | undefined => {
      const fieldRules = rules[field];
      if (!fieldRules) return undefined;

      // Required validation
      if (fieldRules.required) {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          const message =
            typeof fieldRules.required === 'string'
              ? fieldRules.required
              : 'This field is required';
          return message;
        }
      }

      // Email validation
      if (fieldRules.email && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          const message =
            typeof fieldRules.email === 'string'
              ? fieldRules.email
              : 'Please enter a valid email address';
          return message;
        }
      }

      // Min length validation
      if (fieldRules.minLength && value) {
        if (value.length < fieldRules.minLength.value) {
          return fieldRules.minLength.message;
        }
      }

      // Max length validation
      if (fieldRules.maxLength && value) {
        if (value.length > fieldRules.maxLength.value) {
          return fieldRules.maxLength.message;
        }
      }

      // Pattern validation
      if (fieldRules.pattern && value) {
        if (!fieldRules.pattern.value.test(value)) {
          return fieldRules.pattern.message;
        }
      }

      // Match field validation (e.g., confirm password)
      if (fieldRules.match && formData && value) {
        if (value !== formData[fieldRules.match.field]) {
          return fieldRules.match.message;
        }
      }

      // Custom validation
      if (fieldRules.custom) {
        const customError = fieldRules.custom(value);
        if (customError) {
          return customError;
        }
      }

      return undefined;
    },
    [rules]
  );

  /**
   * Validate entire form
   */
  const validateForm = useCallback(
    (formData: FormData): boolean => {
      const newErrors: Record<string, string> = {};

      Object.keys(rules).forEach((field) => {
        const error = validateField(field, formData[field], formData);
        if (error) {
          newErrors[field] = error;
        }
      });

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [rules, validateField]
  );

  /**
   * Handle field blur - validate and update errors
   */
  const handleBlur = useCallback(
    (field: string, value: any, formData?: FormData) => {
      if (!options.validateOnBlur) return;

      const error = validateField(field, value, formData);
      setErrors((prev) => ({
        ...prev,
        [field]: error || '',
      }));
    },
    [validateField, options.validateOnBlur]
  );

  /**
   * Handle field change - clear error if validateOnChange is true
   */
  const handleChange = useCallback(
    (field: string, value: any, formData?: FormData) => {
      if (!options.validateOnChange) {
        // Just clear the error for this field
        setErrors((prev) => ({
          ...prev,
          [field]: '',
        }));
        return;
      }

      // Validate on change
      const error = validateField(field, value, formData);
      setErrors((prev) => ({
        ...prev,
        [field]: error || '',
      }));
    },
    [validateField, options.validateOnChange]
  );

  /**
   * Clear a single field's error
   */
  const clearError = useCallback((field: string) => {
    setErrors((prev) => ({
      ...prev,
      [field]: '',
    }));
  }, []);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Set error for a field manually
   */
  const setFieldError = useCallback((field: string, error: string) => {
    setErrors((prev) => ({
      ...prev,
      [field]: error,
    }));
  }, []);

  return {
    errors,
    validateField,
    validateForm,
    handleBlur,
    handleChange,
    clearError,
    clearAllErrors,
    setFieldError,
  };
}

export default useFormValidation;
