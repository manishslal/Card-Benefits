/**
 * src/lib/types/custom-values.ts
 *
 * TypeScript interfaces and types for the Custom Values feature.
 * Covers value display, changes, ROI snapshots, and state management.
 */

import type { UserBenefit as PrismaUserBenefit } from '@prisma/client';

/**
 * Represents how a benefit value is displayed to the user.
 * Includes original sticker value, custom override, and calculated differences.
 */
export interface BenefitValueDisplay {
  /** Sticker value in cents (read-only from master) */
  stickerValue: number;
  
  /** Custom value in cents (user override, null if not set) */
  customValue: number | null;
  
  /** Effective value in cents (custom if set, else sticker) */
  effectiveValue: number;
  
  /** Difference in cents (customValue - stickerValue) */
  differenceAmount: number;
  
  /** Difference as percentage (0-1), where 0.5 = 50% */
  differencePercent: number;
  
  /** Whether a custom value has been set */
  isDifferent: boolean;
  
  /** Whether difference exceeds 10% (significant) */
  isSignificant: boolean;
}

/**
 * Represents a single historical change to a benefit value.
 * Stored in the valueHistory JSON array in the database.
 */
export interface BenefitValueChange {
  /** Optional unique ID for the change entry */
  id?: string;
  
  /** The value in cents after this change */
  value: number;
  
  /** When the change was made (ISO 8601 timestamp) */
  changedAt: Date | string;
  
  /** User ID or 'system' if automated change */
  changedBy: string;
  
  /** Source of the change: manual, import, or system */
  source: 'manual' | 'import' | 'system';
  
  /** Optional user-provided reason for the change (max 255 chars) */
  reason?: string;
  
  /** If source='import', the import job ID */
  importJobId?: string;
}

/**
 * Snapshot of ROI values before/after a value change.
 * Used for preview and confirmation dialogs.
 */
export interface ROISnapshot {
  /** Benefit-level ROI percentage (0-100+) */
  benefitROI: number;
  
  /** Card-level ROI percentage */
  cardROI: number;
  
  /** Player-level ROI percentage */
  playerROI: number;
  
  /** Household-level ROI percentage */
  householdROI: number;
  
  /** Benefit value in cents */
  benefitValue: number;
  
  /** Total annual value of benefits on card in cents */
  cardAnnualValue: number;
  
  /** Total annual value of benefits for player in cents */
  playerAnnualValue: number;
}

/**
 * Local component state for EditableValueField.
 * Tracks all transient states during editing and saving.
 */
export interface EditableValueFieldState {
  /** Whether currently in edit mode */
  isEditing: boolean;
  
  /** String value being typed in the input field */
  pendingValue: string;
  
  /** Whether a server request is in progress */
  isSaving: boolean;
  
  /** Client-side validation error message (non-blocking) */
  validationError: string | null;
  
  /** Server error message (blocking) */
  saveError: string | null;
  
  /** Timestamp of last successful save */
  lastSavedAt: Date | null;
  
  /** Value to revert to if save fails */
  previousValue: number | null;
}

/**
 * Global React Context state for benefit values and ROI.
 * Provides real-time updates across components.
 */
export interface BenefitValueContextType {
  /** Map of benefitId -> effective value in cents */
  values: Map<string, number>;
  
  /** ROI cache with level and expiration info */
  roiCache: Map<string, {
    value: number;
    level: 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD';
    cachedAt: Date;
  }>;
  
  /** Update a single benefit value */
  updateValue: (benefitId: string, newValue: number) => Promise<void>;
  
  /** Update multiple benefit values atomically */
  bulkUpdateValues: (updates: Array<{ benefitId: string; value: number }>) => Promise<void>;
  
  /** Invalidate ROI cache for specific entries */
  invalidateROI: (level: string, ids: string[]) => Promise<void>;
  
  /** Get cached ROI or calculate if not cached */
  getROI: (level: string, id: string) => Promise<number>;
  
  /** Global loading state */
  isLoading: boolean;
  
  /** Global error state */
  error: string | null;
}

// ============================================================================
// Server Action Request/Response Types
// ============================================================================

/**
 * Request to update a benefit's declared value
 */
export interface UpdateUserDeclaredValueRequest {
  benefitId: string;
  valueInCents: number;
  changeReason?: string;
}

/**
 * Response from updating a benefit value
 */
export interface UpdateUserDeclaredValueResult {
  benefit: PrismaUserBenefit;
  rois: {
    benefit: number;
    card: number;
    player: number;
    household: number;
  };
  affectedCards: string[];
  valueBefore: number;
  valueAfter: number;
  changeAmount: number;
  changePercent: number;
  changedAt: Date;
}

/**
 * Request to clear (reset) a benefit's declared value
 */
export interface ClearUserDeclaredValueRequest {
  benefitId: string;
}

/**
 * Response from clearing a benefit value (same as update)
 */
export type ClearUserDeclaredValueResult = UpdateUserDeclaredValueResult;

/**
 * Request to bulk update multiple benefit values
 */
export interface BulkUpdateUserDeclaredValuesRequest {
  updates: Array<{
    benefitId: string;
    valueInCents: number;
  }>;
  cardId?: string;
}

/**
 * Response from bulk updating values
 */
export interface BulkUpdateUserDeclaredValuesResult {
  updated: number;
  failed: number;
  benefits: Array<{
    id: string;
    name: string;
    valueBefore: number;
    valueAfter: number;
  }>;
  rois: {
    card: number;
    player: number;
    household: number;
  };
  affectedCards: string[];
  recalculatedAt: Date;
}

/**
 * Request to fetch value change history for a benefit
 */
export interface GetBenefitValueHistoryRequest {
  benefitId: string;
  limit?: number;
}

/**
 * Response containing benefit value history
 */
export interface GetBenefitValueHistoryResult {
  benefitId: string;
  current: {
    value: number | null;
    type: 'custom' | 'sticker';
    changedAt: Date | null;
  };
  history: BenefitValueChange[];
  totalChanges: number;
}

/**
 * Request to revert to a previous value from history
 */
export interface RevertUserDeclaredValueRequest {
  benefitId: string;
  historyIndex: number;
}

/**
 * Response from reverting to a previous value
 */
export type RevertUserDeclaredValueResult = UpdateUserDeclaredValueResult;

/**
 * Preset option for quick value selection
 */
export interface PresetOption {
  label: string;
  value: number;
  description?: string;
}

/**
 * Props for EditableValueField component
 */
export interface EditableValueFieldProps {
  benefitId: string;
  stickerValue: number;
  currentValue: number | null;
  onSave: (valueInCents: number) => Promise<void>;
  onError?: (error: string) => void;
  disabled?: boolean;
  showPresets?: boolean;
  presetOptions?: PresetOption[];
}

/**
 * Props for BenefitValueComparison component
 */
export interface BenefitValueComparisonProps {
  benefitName: string;
  stickerValue: number;
  customValue: number | null;
  effectiveValue: number;
  benefitROI: number;
  cardROI: number;
  previousCardROI?: number;
  showHistory?: boolean;
  onHistoryClick?: () => void;
}

/**
 * Props for BenefitValuePresets component
 */
export interface BenefitValuePresetsProps {
  stickerValue: number;
  currentValue: number | null;
  onSelect: (valueInCents: number) => Promise<void>;
  benefitType?: 'StatementCredit' | 'UsagePerk';
  isLoading?: boolean;
}

/**
 * Props for ValueHistoryPopover component
 */
export interface ValueHistoryPopoverProps {
  benefitId: string;
  history: BenefitValueChange[];
  currentValue: number | null;
  onRevert: (historyIndex: number) => Promise<void>;
}

/**
 * Benefit item structure for bulk editing
 */
export interface BenefitForBulkEdit {
  id: string;
  name: string;
  stickerValue: number;
  currentValue: number | null;
}

/**
 * Props for BulkValueEditor component
 */
export interface BulkValueEditorProps {
  selectedBenefits: BenefitForBulkEdit[];
  onApply: (updates: Array<{ benefitId: string; valueInCents: number }>) => Promise<void>;
  onCancel: () => void;
}
