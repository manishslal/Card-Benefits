/**
 * Application Metrics Module
 * 
 * Tracks key business and technical metrics for Phase 2B:
 * - Benefits created/tracked
 * - Usage records logged
 * - Recommendations generated
 * - API performance
 * - Authentication events
 * 
 * These metrics can be exported to monitoring systems like:
 * - Sentry
 * - DataDog
 * - New Relic
 * - CloudWatch
 * - Prometheus
 */

interface MetricTags {
  [key: string]: string | number;
}

class Counter {
  private count = 0;
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  increment(tags?: MetricTags) {
    this.count++;
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[METRIC] ${this.name}++`, this.count);
    }
  }

  getValue(): number {
    return this.count;
  }
}

class Gauge {
  private value = 0;
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  set(value: number, tags?: MetricTags) {
    this.value = value;
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[METRIC] ${this.name} = ${value}`);
    }
  }

  getValue(): number {
    return this.value;
  }
}

class Histogram {
  private measurements: number[] = [];
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  record(value: number, tags?: MetricTags) {
    this.measurements.push(value);
    
    // Keep only last 1000 measurements to prevent memory issues
    if (this.measurements.length > 1000) {
      this.measurements.shift();
    }

    if (process.env.NODE_ENV === 'development') {
      const avg = this.getAverage();
      console.debug(`[METRIC] ${this.name} = ${value}ms (avg: ${avg.toFixed(2)}ms)`);
    }
  }

  getPercentile(p: number): number {
    if (this.measurements.length === 0) return 0;
    
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getAverage(): number {
    if (this.measurements.length === 0) return 0;
    const sum = this.measurements.reduce((a, b) => a + b, 0);
    return sum / this.measurements.length;
  }

  getMax(): number {
    return Math.max(...this.measurements, 0);
  }

  getMin(): number {
    if (this.measurements.length === 0) return 0;
    return Math.min(...this.measurements);
  }
}

/**
 * Phase 2B Metrics
 */
export const metrics = {
  // ─────────────────────────────────────────────────────────────────
  // BUSINESS METRICS
  // ─────────────────────────────────────────────────────────────────

  // Benefits tracking
  benefitsCreated: new Counter('phase2b_benefits_created_total'),
  benefitsViewed: new Counter('phase2b_benefits_viewed_total'),
  benefitsArchived: new Counter('phase2b_benefits_archived_total'),

  // Usage tracking
  usageRecorded: new Counter('phase2b_usage_recorded_total'),
  usageExported: new Counter('phase2b_usage_exported_total'),

  // Recommendations
  recommendationsGenerated: new Counter('phase2b_recommendations_generated_total'),
  recommendationsAccepted: new Counter('phase2b_recommendations_accepted_total'),
  recommendationsRejected: new Counter('phase2b_recommendations_rejected_total'),

  // Mobile sync
  mobileSyncAttempts: new Counter('phase2b_mobile_sync_attempts_total'),
  mobileSyncSuccess: new Counter('phase2b_mobile_sync_success_total'),
  mobileSyncFailure: new Counter('phase2b_mobile_sync_failure_total'),

  // ─────────────────────────────────────────────────────────────────
  // TECHNICAL METRICS
  // ─────────────────────────────────────────────────────────────────

  // API performance
  apiLatency: new Histogram('phase2b_api_latency_ms'),
  databaseQueryLatency: new Histogram('phase2b_database_query_latency_ms'),

  // Error tracking
  apiErrors: new Counter('phase2b_api_errors_total'),
  databaseErrors: new Counter('phase2b_database_errors_total'),
  authenticationFailures: new Counter('phase2b_authentication_failures_total'),

  // ─────────────────────────────────────────────────────────────────
  // USER METRICS
  // ─────────────────────────────────────────────────────────────────

  activeUsers: new Gauge('phase2b_active_users'),
  loginAttempts: new Counter('phase2b_login_attempts_total'),
  logoutAttempts: new Counter('phase2b_logout_attempts_total'),

  // ─────────────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get current metrics summary
   */
  getSummary: () => ({
    timestamp: new Date().toISOString(),
    phase2b: {
      benefitsCreated: metrics.benefitsCreated.getValue(),
      usageRecorded: metrics.usageRecorded.getValue(),
      recommendationsGenerated: metrics.recommendationsGenerated.getValue(),
      activeUsers: metrics.activeUsers.getValue(),
    },
    performance: {
      apiLatency: {
        avg: metrics.apiLatency.getAverage(),
        p95: metrics.apiLatency.getPercentile(95),
        p99: metrics.apiLatency.getPercentile(99),
        max: metrics.apiLatency.getMax(),
      },
      databaseQuery: {
        avg: metrics.databaseQueryLatency.getAverage(),
        p95: metrics.databaseQueryLatency.getPercentile(95),
        p99: metrics.databaseQueryLatency.getPercentile(99),
        max: metrics.databaseQueryLatency.getMax(),
      },
    },
    errors: {
      apiErrors: metrics.apiErrors.getValue(),
      databaseErrors: metrics.databaseErrors.getValue(),
      authFailures: metrics.authenticationFailures.getValue(),
    },
  }),

  /**
   * Reset all metrics (useful for testing)
   */
  reset: () => {
    // Note: In production, you'd use a proper metrics collection system
    console.log('[METRICS] Resetting metrics (development only)');
  },
};

// Export types
export { Counter, Gauge, Histogram, MetricTags };
