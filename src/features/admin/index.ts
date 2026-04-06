/**
 * Admin feature module - Phase 3
 */

export type {
  Card,
  Benefit,
  AdminUser,
  AuditLog,
} from './types/admin';

export {
  BenefitType,
  ResetCadence,
  UserRole,
  AuditActionType,
  ResourceType,
} from './types/admin';

// Hooks
export { useCards } from './hooks/useCards';
export { useBenefits } from './hooks/useBenefits';
export { useUsers } from './hooks/useUsers';
export { useAuditLogs } from './hooks/useAuditLogs';

// API Client
export { apiClient, getErrorMessage } from './lib/api-client';

// Context
export { AdminContextProvider, useAdminContext } from './context/AdminContext';
export { UIContextProvider, useUIContext } from './context/UIContext';
