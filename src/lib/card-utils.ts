/**
 * Shared card utility functions.
 *
 * Provides helpers for card type/network resolution used across API routes.
 */

/**
 * Resolves a card issuer string to a normalized card network type.
 *
 * @param issuer - The card issuer name (e.g., "American Express", "Visa")
 * @returns Normalized card network identifier
 */
export function getCardType(issuer: string): string {
  const lowerIssuer = issuer.toLowerCase();
  if (lowerIssuer.includes('american') || lowerIssuer.includes('amex')) return 'amex';
  if (lowerIssuer.includes('mastercard') || lowerIssuer.includes('mc')) return 'mastercard';
  if (lowerIssuer.includes('visa')) return 'visa';
  if (lowerIssuer.includes('discover')) return 'discover';
  // Return 'other' instead of guessing for unknown issuers
  return 'other';
}
