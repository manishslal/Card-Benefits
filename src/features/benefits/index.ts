/**
 * Benefits Feature Module
 * 
 * Consolidates all benefit-related components, utilities, context, and actions
 * for clean, centralized importing across the application.
 * 
 * Usage:
 * ```ts
 * import { AddBenefitModal, BenefitTable } from '@/features/benefits';
 * import { toggleBenefit } from '@/features/benefits';
 * import { useROI } from '@/features/benefits';
 * ```
 */

// Components (modals, grids, tables, etc.)
export * from './components';

// Context and hooks
export * from './context';

// Utilities and helpers
export * from './lib';

// Types and interfaces
export * from './types';

// Server actions
export * from './actions';
