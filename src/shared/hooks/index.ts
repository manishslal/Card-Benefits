// Shared Hooks - Barrel Export
// Re-exports all shared utility hooks

export { useAuth, useUserId, useIsAuthenticated } from './useAuth';
export type { SessionInfo, UseAuthState, UseAuthReturn } from './useAuth';

export { useFocusManagement } from './useFocusManagement';

export { useFormValidation } from './useFormValidation';
