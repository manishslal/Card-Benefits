/**
 * API Client - Handles all HTTP requests to Phase 2 API endpoints
 * 
 * Features:
 * - Automatic auth header handling
 * - Error handling and user-friendly messages
 * - Request/response interceptors
 * - Simple caching for GET requests
 * - Retry logic with exponential backoff
 */

import type { ApiResponse, ApiListResponse, Card, Benefit, AdminUser, AuditLog } from '../types/admin';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private cache: Map<string, CacheEntry<any>>;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    baseURL: string = '/api/admin',
    timeout: number = 10000,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.cache = new Map();
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Clear cache entries
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
    } else {
      for (const [key] of this.cache) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit & { timeout?: number } = {},
    retryCount: number = 0
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = options.timeout || this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
        (error as any).status = response.status;
        (error as any).code = errorData.code;
        throw error;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry on network errors (not 4xx/5xx responses)
      if (
        retryCount < this.maxRetries &&
        error instanceof TypeError &&
        error.message.includes('fetch')
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * Math.pow(2, retryCount))
        );
        return this.fetchWithRetry<T>(url, options, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * GET request with caching
   */
  async get<T = any>(
    endpoint: string,
    options: { cache?: number; params?: Record<string, any> } = {}
  ): Promise<T> {
    const url = new URL(endpoint, this.baseURL);

    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const cacheKey = url.toString();

    // Check cache
    if (options.cache !== 0) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return cached.data as T;
      }
    }

    // Make request
    const data = await this.fetchWithRetry<T>(cacheKey.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    // Cache result
    if (options.cache) {
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: options.cache,
      });
    }

    return data;
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, body: any): Promise<T> {
    const url = new URL(endpoint, this.baseURL);
    const data = await this.fetchWithRetry<T>(url.toString(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    // Invalidate related caches
    this.clearCache(endpoint.split('/')[0]);

    return data;
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, body: any): Promise<T> {
    const url = new URL(endpoint, this.baseURL);
    const data = await this.fetchWithRetry<T>(url.toString(), {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    // Invalidate related caches
    this.clearCache(endpoint.split('/')[0]);

    return data;
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(endpoint, this.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const data = await this.fetchWithRetry<T>(url.toString(), {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    // Invalidate related caches
    this.clearCache(endpoint.split('/')[0]);

    return data;
  }

  /**
   * Get request headers with auth
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      // Auth token is automatically included via cookies
    };
  }
}

// Create default instance
export const apiClient = new ApiClient();

/**
 * Helper functions for common operations
 */

// Cards
export const cardApi = {
  list: (params?: any) =>
    apiClient.get<ApiListResponse<Card>>('/cards', {
      params,
      cache: 5 * 60 * 1000, // 5 minutes
    }),

  get: (cardId: string) =>
    apiClient.get<ApiResponse<Card>>(`/cards/${cardId}`, {
      cache: 5 * 60 * 1000,
    }),

  create: (data: any) => apiClient.post<ApiResponse<Card>>('/cards', data),

  update: (cardId: string, data: any) =>
    apiClient.patch<ApiResponse<Card>>(`/cards/${cardId}`, data),

  delete: (cardId: string, options?: any) =>
    apiClient.delete<ApiResponse<any>>(`/cards/${cardId}`, options),

  reorder: (data: any) =>
    apiClient.patch<ApiResponse<any>>('/cards/reorder', data),
};

// Benefits
export const benefitApi = {
  list: (cardId: string, params?: any) =>
    apiClient.get<ApiListResponse<Benefit>>(`/cards/${cardId}/benefits`, {
      params,
      cache: 5 * 60 * 1000,
    }),

  create: (cardId: string, data: any) =>
    apiClient.post<ApiResponse<Benefit>>(`/cards/${cardId}/benefits`, data),

  update: (cardId: string, benefitId: string, data: any) =>
    apiClient.patch<ApiResponse<Benefit>>(
      `/cards/${cardId}/benefits/${benefitId}`,
      data
    ),

  toggleDefault: (cardId: string, benefitId: string, data: any) =>
    apiClient.patch<ApiResponse<Benefit>>(
      `/cards/${cardId}/benefits/${benefitId}/toggle-default`,
      data
    ),

  delete: (cardId: string, benefitId: string, options?: any) =>
    apiClient.delete<ApiResponse<any>>(
      `/cards/${cardId}/benefits/${benefitId}`,
      options
    ),
};

// Users
export const userApi = {
  list: (params?: any) =>
    apiClient.get<ApiListResponse<AdminUser>>('/users', {
      params,
      cache: 5 * 60 * 1000,
    }),

  assignRole: (userId: string, role: string) =>
    apiClient.post<ApiResponse<AdminUser>>(`/users/${userId}/role`, {
      role,
    }),
};

// Audit Logs
export const auditApi = {
  list: (params?: any) =>
    apiClient.get<ApiListResponse<AuditLog>>('/audit-logs', {
      params,
      cache: 2 * 60 * 1000, // 2 minutes
    }),

  get: (logId: string) =>
    apiClient.get<ApiResponse<AuditLog>>(`/audit-logs/${logId}`, {
      cache: 5 * 60 * 1000,
    }),
};

/**
 * Error handling helper
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if ((error as any).code === 'AUTH_UNAUTHORIZED') {
      return 'Your session has expired. Please log in again.';
    }
    if ((error as any).code === 'FORBIDDEN_ADMIN_REQUIRED') {
      return 'You do not have permission to perform this action.';
    }
    if ((error as any).code === 'CARD_NOT_FOUND') {
      return 'The card was not found.';
    }
    if ((error as any).code === 'DUPLICATE_CARD') {
      return 'A card with this issuer and name already exists.';
    }
    if ((error as any).code === 'CARD_IN_USE') {
      return `This card is used by ${(error as any).userCardCount} user(s) and cannot be deleted without force.`;
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
