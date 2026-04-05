/**
 * format-currency.ts
 * 
 * Utility function for consistent currency formatting across the application.
 * Handles conversion from cents (integer storage) to formatted display strings.
 * 
 * Convention: All monetary values in the database and API are stored in CENTS.
 * Example: 30000 cents = $300.00
 * 
 * This utility ensures consistent formatting and prevents arithmetic errors
 * that can occur with floating-point currency operations.
 */

/**
 * Format cents (integer) to currency display string
 * 
 * @param cents - Integer value in cents (e.g., 30000 for $300.00)
 * @param showSymbol - Whether to include $ symbol (default: true)
 * @returns Formatted string: "$300.00" or "300.00"
 * 
 * @example
 * formatCurrency(30000) → "$300.00"
 * formatCurrency(10000) → "$100.00"
 * formatCurrency(5050) → "$50.50"
 * formatCurrency(0) → "$0.00"
 * formatCurrency(10000, false) → "100.00"
 */
export function formatCurrency(cents: number, showSymbol: boolean = true): string {
  // Handle edge cases: null, undefined, NaN
  if (cents === null || cents === undefined || isNaN(cents)) {
    return showSymbol ? '$0.00' : '0.00';
  }

  // Convert cents to dollars with proper rounding
  // We use Math.round to ensure accurate decimal representation
  const dollars = Math.abs(cents) / 100;
  const formatted = dollars.toFixed(2);

  // Add negative sign if original value was negative
  const withSign = cents < 0 ? `-${formatted}` : formatted;

  // Add currency symbol if requested
  return showSymbol ? `$${withSign}` : withSign;
}

/**
 * Format cents for compact display (e.g., "300" instead of "300.00")
 * Useful for cards/tiles where space is limited
 * 
 * @param cents - Integer value in cents
 * @returns Formatted string without cents decimals if whole dollar
 * 
 * @example
 * formatCurrencyCompact(30000) → "$300"
 * formatCurrencyCompact(30050) → "$300.50"
 */
export function formatCurrencyCompact(cents: number): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return '$0';
  }

  const dollars = Math.abs(cents) / 100;
  const isWholeNumber = cents % 100 === 0;
  
  if (isWholeNumber) {
    const formatted = Math.floor(dollars).toString();
    const withSign = cents < 0 ? `-${formatted}` : formatted;
    return `$${withSign}`;
  }
  
  const formatted = dollars.toFixed(2);
  const withSign = cents < 0 ? `-${formatted}` : formatted;
  return `$${withSign}`;
}

/**
 * Parse user input (string like "$300.00" or "300") to cents (integer)
 * Useful for form inputs and API requests
 * 
 * @param input - User input string (e.g., "300", "$300.00", "300.50")
 * @returns Integer cents value (e.g., 30000), or 0 if invalid
 * 
 * @example
 * parseCurrency("300") → 30000
 * parseCurrency("$300.00") → 30000
 * parseCurrency("300.50") → 30050
 * parseCurrency("invalid") → 0
 */
export function parseCurrency(input: string): number {
  if (!input || typeof input !== 'string') {
    return 0;
  }

  // Remove currency symbol and whitespace
  const cleaned = input.replace(/[$,\s]/g, '').trim();
  
  // Parse as float
  const dollars = parseFloat(cleaned);
  
  // Return 0 if NaN
  if (isNaN(dollars)) {
    return 0;
  }

  // Convert to cents and round to avoid floating-point errors
  return Math.round(dollars * 100);
}
