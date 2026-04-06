/**
 * Barrel export for admin library utilities
 */

export {
  apiClient,
  cardApi,
  benefitApi,
  userApi,
  auditApi,
  getErrorMessage,
} from './api-client';

export {
  cardFormSchema,
  benefitFormSchema,
  roleAssignmentSchema,
  validateForm,
  fieldValidators,
  asyncValidators,
} from './validators';

export {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  formatNumber,
  formatPercentage,
  truncateText,
  capitalize,
  enumToLabel,
  formatBenefitType,
  formatResetCadence,
  formatActionType,
  formatResourceType,
  formatBytes,
  formatPhoneNumber,
  highlightText,
  stripHtml,
  escapeHtml,
} from './formatting';

// Re-export from existing audit utilities
export { createAuditLog, logResourceCreation, logResourceUpdate, logResourceDeletion } from './audit';
