/**
 * Semantic color tokens for the dashboard design system
 * Maps CSS variable names to labels for documentation and access
 *
 * Usage:
 * ```typescript
 * import { semanticColors } from '../utils/colors';
 * 
 * // Use in inline styles
 * style={{ color: semanticColors.primary.var }}
 * 
 * // Use in className with CSS variables
 * className="text-[color:var(--color-primary)]"
 * ```
 */

export interface ColorToken {
  var: string;
  label: string;
  description?: string;
}

export const semanticColors = {
  // Primary Brand Colors
  primary: {
    var: '--color-primary',
    label: 'Primary',
    description: 'Main brand color for CTAs and emphasis',
  } as ColorToken,
  primaryLight: {
    var: '--color-primary-light',
    label: 'Primary Light',
    description: 'Light variant of primary for backgrounds',
  } as ColorToken,
  primaryDark: {
    var: '--color-primary-dark',
    label: 'Primary Dark',
    description: 'Dark variant of primary for hover/active states',
  } as ColorToken,

  // Status Colors
  success: {
    var: '--color-success',
    label: 'Success',
    description: 'Success state indicator (green)',
  } as ColorToken,
  successLight: {
    var: '--color-success-light',
    label: 'Success Light',
    description: 'Light background for success messages',
  } as ColorToken,
  warning: {
    var: '--color-warning',
    label: 'Warning',
    description: 'Warning state indicator (orange)',
  } as ColorToken,
  warningLight: {
    var: '--color-warning-light',
    label: 'Warning Light',
    description: 'Light background for warning messages',
  } as ColorToken,
  error: {
    var: '--color-error',
    label: 'Error',
    description: 'Error state indicator (red)',
  } as ColorToken,
  errorLight: {
    var: '--color-error-light',
    label: 'Error Light',
    description: 'Light background for error messages',
  } as ColorToken,

  // Text Colors
  text: {
    var: '--color-text',
    label: 'Text Primary',
    description: 'Main text color',
  } as ColorToken,
  textSecondary: {
    var: '--color-text-secondary',
    label: 'Text Secondary',
    description: 'Secondary text color for subtle content',
  } as ColorToken,
  textTertiary: {
    var: '--color-text-tertiary',
    label: 'Text Tertiary',
    description: 'Tertiary text color for disabled or placeholder text',
  } as ColorToken,

  // Background Colors
  bg: {
    var: '--color-bg',
    label: 'Background',
    description: 'Primary background color',
  } as ColorToken,
  bgSecondary: {
    var: '--color-bg-secondary',
    label: 'Background Secondary',
    description: 'Secondary background for sections',
  } as ColorToken,
  bgTertiary: {
    var: '--color-bg-tertiary',
    label: 'Background Tertiary',
    description: 'Tertiary background for hover states',
  } as ColorToken,

  // Border Colors
  border: {
    var: '--color-border',
    label: 'Border',
    description: 'Default border color',
  } as ColorToken,
  borderLight: {
    var: '--color-border-light',
    label: 'Border Light',
    description: 'Light border for subtle dividers',
  } as ColorToken,

  // Typography
  fontHeading: {
    var: '--font-heading',
    label: 'Font Heading',
    description: 'Font family for headings and titles',
  } as ColorToken,
  fontBody: {
    var: '--font-body',
    label: 'Font Body',
    description: 'Font family for body text',
  } as ColorToken,
};

/**
 * CSS variable reference utilities
 */
export const cssVar = (tokenKey: keyof typeof semanticColors): string => {
  const token = semanticColors[tokenKey];
  return `var(${token.var})`;
};

/**
 * Inline style utilities for React components
 */
export const colorStyles = {
  textPrimary: { color: cssVar('text') } as React.CSSProperties,
  textSecondary: { color: cssVar('textSecondary') } as React.CSSProperties,
  textError: { color: cssVar('error') } as React.CSSProperties,
  textSuccess: { color: cssVar('success') } as React.CSSProperties,
  bgPrimary: { backgroundColor: cssVar('bg') } as React.CSSProperties,
  bgSecondary: { backgroundColor: cssVar('bgSecondary') } as React.CSSProperties,
  headingFont: { fontFamily: cssVar('fontHeading') } as React.CSSProperties,
};
