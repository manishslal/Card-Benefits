/**
 * Feature Flags Module
 * 
 * Allows gradual rollout, A/B testing, and quick feature toggles for Phase 2B
 * 
 * Flag enabling methods (in order of precedence):
 * 1. Environment variable: FEATURE_FLAGS_ENABLED="flag1,flag2,flag3"
 * 2. User-level feature flags (future enhancement with database)
 * 3. Gradual rollout % (future enhancement)
 * 
 * Usage:
 *   if (featureFlags.PHASE2B_ENABLED) {
 *     return <AdvancedBenefitsFeatures />;
 *   }
 */

/**
 * Parse feature flags from environment variable
 * 
 * @example
 * FEATURE_FLAGS_ENABLED="phase2b,recommendations,mobile_offline,debug"
 */
function parseFeatureFlags(): Set<string> {
  const flagsEnv = process.env.FEATURE_FLAGS_ENABLED || '';
  return new Set(
    flagsEnv
      .split(',')
      .map(flag => flag.trim().toUpperCase())
      .filter(flag => flag.length > 0)
  );
}

const enabledFlags = parseFeatureFlags();

/**
 * Check if a feature flag is enabled
 */
function isEnabled(flag: string): boolean {
  return enabledFlags.has(flag.toUpperCase());
}

/**
 * Phase 2B Feature Flags
 */
export const featureFlags = {
  // ─────────────────────────────────────────────────────────────────
  // BENEFIT ENGINE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Enable the Benefit Engine auto-generation service.
   * When enabled:
   * - POST /api/cards/add uses generateBenefitsForCard() with period tracking
   * - Cron job creates new period rows instead of resetting in-place
   * When disabled:
   * - Existing benefit creation logic is used (flat copy without periods)
   *
   * Controlled via env var: BENEFIT_ENGINE_ENABLED=true
   */
  BENEFIT_ENGINE_ENABLED: process.env.BENEFIT_ENGINE_ENABLED === 'true',

  // ─────────────────────────────────────────────────────────────────
  // CORE PHASE 2B FEATURES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Enable all Phase 2B advanced benefits features
   * - Benefit usage tracking
   * - Benefit recommendations
   * - Enhanced mobile support
   * - Advanced analytics
   */
  PHASE2B_ENABLED: isEnabled('PHASE2B'),

  /**
   * Enable benefit recommendations engine
   * - Generate personalized recommendations
   * - Track recommendation acceptance
   * - A/B test recommendation algorithms
   */
  PHASE2B_RECOMMENDATIONS: isEnabled('PHASE2B_RECOMMENDATIONS'),

  /**
   * Enable mobile offline mode
   * - Store data locally when offline
   * - Sync when reconnected
   * - Conflict resolution
   */
  PHASE2B_MOBILE_OFFLINE: isEnabled('PHASE2B_MOBILE_OFFLINE'),

  /**
   * Enable advanced analytics
   * - Benefits usage patterns
   * - Recommendation performance tracking
   * - User engagement metrics
   */
  PHASE2B_ANALYTICS: isEnabled('PHASE2B_ANALYTICS'),

  /**
   * Enable new usage tracking UI
   * - Visual timeline of benefit usage
   * - Usage statistics
   * - Export functionality
   */
  PHASE2B_USAGE_UI: isEnabled('PHASE2B_USAGE_UI'),

  /**
   * Enable API pagination enhancements
   * - Cursor-based pagination
   * - Improved performance for large datasets
   */
  PHASE2B_API_PAGINATION: isEnabled('PHASE2B_API_PAGINATION'),

  // ─────────────────────────────────────────────────────────────────
  // DEVELOPMENT & TESTING FLAGS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Enable debug mode
   * - Verbose logging
   * - Additional error details
   * - Performance metrics
   */
  DEBUG: isEnabled('DEBUG'),

  /**
   * Enable development mode features
   * - Demo data
   * - Test endpoints
   * - Detailed error messages
   */
  DEVELOPMENT: isEnabled('DEVELOPMENT') || process.env.NODE_ENV === 'development',

  /**
   * Enable experimental features
   * - Features under active development
   * - May be unstable
   * - For internal testing only
   */
  EXPERIMENTAL: isEnabled('EXPERIMENTAL'),

  // ─────────────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get all enabled flags
   */
  getEnabled: (): string[] => {
    return Array.from(enabledFlags).sort();
  },

  /**
   * Get all available flags with their status
   */
  getStatus: () => ({
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    enabled: featureFlags.getEnabled(),
    phase2b: {
      enabled: featureFlags.PHASE2B_ENABLED,
      recommendations: featureFlags.PHASE2B_RECOMMENDATIONS,
      mobileOffline: featureFlags.PHASE2B_MOBILE_OFFLINE,
      analytics: featureFlags.PHASE2B_ANALYTICS,
      usageUI: featureFlags.PHASE2B_USAGE_UI,
      apiPagination: featureFlags.PHASE2B_API_PAGINATION,
    },
    development: {
      debug: featureFlags.DEBUG,
      development: featureFlags.DEVELOPMENT,
      experimental: featureFlags.EXPERIMENTAL,
    },
  }),
};

// Export utility function for conditional rendering
export function withFeatureFlag<T>(
  flag: boolean,
  trueValue: T,
  falseValue: T
): T {
  return flag ? trueValue : falseValue;
}

// Export for testing
export { isEnabled };
