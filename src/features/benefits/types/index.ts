/**
 * Benefit-related types for the benefits feature
 * 
 * Re-exports from @prisma/client and app types for convenient importing.
 * Types are centralized in src/types but re-exported here for feature modularity.
 */

// Prisma types
export type { UserBenefit, MasterBenefit } from '@prisma/client';

// Application types
export type { BenefitClaim, CardWallet } from '@/types';
