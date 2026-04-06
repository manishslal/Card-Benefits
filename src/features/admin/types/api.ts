/**
 * API and HTTP request/response types
 */

export interface HttpError extends Error {
  status: number;
  code: string;
  details?: any;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export type CacheStore<T> = Map<string, CacheEntry<T>>;

export interface CacheConfig {
  ttl: number; // Time-to-live in milliseconds
  maxSize?: number;
}

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  cache?: CacheConfig;
}

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  headers?: Record<string, string>;
  body?: any;
  signal?: AbortSignal;
}
