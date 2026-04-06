/**
 * Form-specific type definitions
 */

import type { BenefitType, ResetCadence, UserRole } from './admin';

export interface CardFormData {
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
  description?: string;
}

export interface BenefitFormData {
  name: string;
  type: BenefitType;
  stickerValue: number;
  resetCadence: ResetCadence;
  isDefault: boolean;
  description?: string;
}

export interface RoleAssignmentFormData {
  userId: string;
  role: UserRole;
  reason?: string;
}

export interface SearchFormData {
  query: string;
  filters: Record<string, any>;
}

export type FormData = 
  | CardFormData 
  | BenefitFormData 
  | RoleAssignmentFormData 
  | SearchFormData;
