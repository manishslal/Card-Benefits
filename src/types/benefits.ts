/**
 * Type definitions for Phase 2 Advanced Benefits Features
 * Includes types for usage tracking, periods, progress, recommendations, and filtering
 */

export interface UsageRecord {
  id: string;
  benefitId: string;
  userId: string;
  usageAmount: number;
  notes?: string;
  category?: string;
  usageDate: Date;
  benefitPeriodId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BenefitPeriod {
  id: string;
  benefitId: string;
  startDate: Date;
  endDate: Date;
  resetCadence: string;
  periodNumber?: number;
  isArchived?: boolean;
}

export interface Recommendation {
  id: string;
  userId: string;
  benefitId: string;
  title: string;
  value: number;
  reason: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  isDismissed?: boolean;
  dismissedAt?: Date;
}

export interface FilterCriteria {
  status?: string[];
  minValue?: number;
  maxValue?: number;
  resetCadence?: string[];
  expirationBefore?: Date;
  searchTerm?: string;
}

export interface BenefitProgress {
  benefitId: string;
  used: number;
  limit: number | null;
  percentage: number;
  status: 'active' | 'warning' | 'critical' | 'exceeded' | 'unused' | 'no_limit';
  periodId?: string;
  unit?: string;
}

export interface OnboardingStep {
  stepNumber: number;
  title: string;
  description: string;
  completed: boolean;
  skipped: boolean;
}

export interface OnboardingState {
  id: string;
  userId: string;
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  isCompleted: boolean;
  setupReminders: boolean;
  reminderEmail?: string;
  totalTimeSpent: number;
  usedSampleBenefit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Benefit {
  id: string;
  name: string;
  limit?: number;
  used?: number;
  resetCadence: string;
  expirationDate?: Date;
  status?: 'active' | 'expiring_soon' | 'expired' | 'used';
  value?: number;
  category?: string;
  description?: string;
}

export interface UsageFormData {
  benefitId: string;
  amount: number;
  description: string;
  date: Date;
  category?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface MobileOfflineState {
  isOnline: boolean;
  syncInProgress: boolean;
  pendingSyncCount: number;
  lastSyncTime?: Date;
  lastSyncError?: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  resource: 'usage' | 'recommendation' | 'onboarding';
  data: Record<string, unknown>;
  timestamp: Date;
  attempts: number;
  lastAttemptTime?: Date;
}
