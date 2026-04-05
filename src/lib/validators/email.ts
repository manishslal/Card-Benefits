/**
 * Email validation utility.
 */

/**
 * Validates email format.
 * Uses a pragmatic regex that catches most invalid emails without being too strict.
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  
  // Simple but effective email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Checks if email is in correct format and not empty.
 */
export function isEmailValid(email: string): boolean {
  return validateEmail(email)
}

/**
 * Gets user-friendly error message for email.
 */
export function getEmailErrorMessage(email: string): string | null {
  if (!email) {
    return 'Email address is required'
  }
  
  if (!validateEmail(email)) {
    return 'Please enter a valid email address'
  }
  
  return null
}
