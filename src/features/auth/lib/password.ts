/**
 * Password hashing and verification utilities (Argon2id).
 *
 * This module handles:
 * - Argon2id password hashing with secure parameters
 * - Timing-safe password verification to prevent timing attacks
 * - Password strength validation
 * - Email format validation
 *
 * NOTE: This module must be used only on the server side.
 * It imports native modules (argon2) that cannot be bundled by webpack.
 * Always mark files importing this as 'use server' or use dynamic imports.
 */

// ============================================================
// Configuration Constants
// ============================================================

/**
 * Argon2id parameters for password hashing.
 *
 * Security rationale:
 * - algorithm: 'argon2id' (memory-hard, resistant to GPU/ASIC attacks)
 * - memoryCost: 65536 KB (64MB - balances security and performance)
 * - timeCost: 2 (2 iterations - sufficient with high memory cost)
 * - parallelism: 1 (single thread - consistent across deployments)
 *
 * Expected hash time: ~100ms on modern hardware
 */
const ARGON2_CONFIG = {
  memoryCost: 65536,  // 64MB
  timeCost: 2,
  parallelism: 1,
  type: 0,  // Argon2id
} as const;

export const ARGON2_OPTIONS = ARGON2_CONFIG;

// ============================================================
// Password Strength Validation
// ============================================================

/**
 * Validates password strength against requirements.
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 digit (0-9)
 * - At least 1 special character (!@#$%^&*-_)
 *
 * @param password - Password to validate
 * @returns Object with isValid flag and specific error messages
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password || password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  if (!/[!@#$%^&*\-_]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*-_)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates email format using RFC 5322 basic pattern.
 *
 * This is a basic validation; production should use email verification.
 * Format: local-part@domain
 *
 * @param email - Email to validate
 * @returns true if email format is valid
 */
export function validateEmail(email: string): boolean {
  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================
// Password Hashing (Argon2id)
// ============================================================

/**
 * Hashes a password using Argon2id algorithm.
 *
 * Security considerations:
 * - Uses memory-hard Argon2id (resistant to GPU/ASIC attacks)
 * - Timing-safe operation (always takes similar time)
 * - Returns Base64-encoded hash with algorithm info embedded
 *
 * Expected output format: $argon2id$v=19$m=65536,t=2,p=1$<salt>$<hash>
 *
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password string
 * @throws {Error} If hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Dynamic import to avoid webpack bundling the native argon2 module
    const { hash } = await import('argon2');
    const hashedPassword = await hash(password, ARGON2_CONFIG);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verifies a password against a hash using timing-safe comparison.
 *
 * CRITICAL SECURITY: Uses argon2.verify() which performs timing-safe
 * comparison internally. This prevents timing attacks where an attacker
 * could determine password correctness by measuring response time.
 *
 * The verification time depends on the stored parameters, not the
 * match position, making it impossible to guess passwords character-by-character.
 *
 * @param hashedPassword - Hash from database (Argon2id format)
 * @param plaintextPassword - Password to verify
 * @returns Promise<boolean> true if password matches, false otherwise
 * @throws {Error} If verification fails (invalid hash format)
 */
export async function verifyPassword(
  hashedPassword: string,
  plaintextPassword: string
): Promise<boolean> {
  try {
    // Dynamic import to avoid webpack bundling the native argon2 module
    const { verify } = await import('argon2');
    const isValid = await verify(hashedPassword, plaintextPassword);
    return isValid;
  } catch (error) {
    // Hash format invalid or verification failed - treat as no match
    return false;
  }
}
