/**
 * Password Validation Utility
 * 
 * Validates passwords against requirements and provides strength feedback.
 * Used in sign up, password reset, and password change forms.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very-strong';
  feedback: string;
}

/**
 * Validates a password against minimum requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Min length
  if (password.length < 8) {
    errors.push('At least 8 characters');
  }

  // Uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter (A-Z)');
  }

  // Lowercase
  if (!/[a-z]/.test(password)) {
    errors.push('At least one lowercase letter (a-z)');
  }

  // Number
  if (!/\d/.test(password)) {
    errors.push('At least one number (0-9)');
  }

  // Calculate strength
  const strength = calculateStrength(password);

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    feedback: `Password strength: ${strength}`,
  };
}

/**
 * Calculates password strength based on various factors
 */
function calculateStrength(password: string): PasswordValidationResult['strength'] {
  let score = 0;

  // Length scoring
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Character type scoring
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  // Return strength based on score
  if (score >= 5) return 'very-strong';
  if (score >= 4) return 'strong';
  if (score >= 2) return 'fair';
  return 'weak';
}

/**
 * Gets visual feedback for password strength
 */
export function getPasswordStrengthColor(strength: string): string {
  switch (strength) {
    case 'very-strong':
      return 'text-green-600 dark:text-green-400';
    case 'strong':
      return 'text-blue-600 dark:text-blue-400';
    case 'fair':
      return 'text-amber-600 dark:text-amber-400';
    case 'weak':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * Gets background color for password strength meter
 */
export function getPasswordStrengthBg(strength: string): string {
  switch (strength) {
    case 'very-strong':
      return 'bg-green-600 dark:bg-green-500';
    case 'strong':
      return 'bg-blue-600 dark:bg-blue-500';
    case 'fair':
      return 'bg-amber-600 dark:bg-amber-500';
    case 'weak':
      return 'bg-red-600 dark:bg-red-500';
    default:
      return 'bg-gray-400 dark:bg-gray-600';
  }
}
