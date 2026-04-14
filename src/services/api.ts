/**
 * API service for handling HTTP requests
 */

import config from '../utils/config';
import type { ApiError } from '../types';

// Token management callbacks
type TokenRefreshCallback = (newAccessToken: string, newRefreshToken: string) => void;
type GetTokensCallback = () => { accessToken: string | null; refreshToken: string | null };
type OnAuthFailureCallback = () => void;

class ApiService {
  private baseUrl: string;
  private timeout: number;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<string> | null = null;
  private onTokenRefresh: TokenRefreshCallback | null = null;
  private getTokens: GetTokensCallback | null = null;
  private onAuthFailure: OnAuthFailureCallback | null = null;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.timeout = config.apiTimeout;
  }

  /**
   * Set token management callbacks
   */
  setTokenCallbacks(
    getTokens: GetTokensCallback,
    onTokenRefresh: TokenRefreshCallback,
    onAuthFailure: OnAuthFailureCallback,
  ) {
    this.getTokens = getTokens;
    this.onTokenRefresh = onTokenRefresh;
    this.onAuthFailure = onAuthFailure;
  }

  /**
   * Refresh the access token
   */
  private async refreshAccessToken(): Promise<string> {
    // If already refreshing, wait for the existing promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const tokens = this.getTokens?.();
        if (!tokens?.refreshToken) {
          throw new Error('No refresh token available');
        }

        console.log('Refreshing access token...');
        const url = `${this.baseUrl}/api/Auth/refresh`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('Token refresh failed:', response.status, errorText);
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        console.log('Token refreshed successfully');

        // Notify about new tokens
        if (this.onTokenRefresh) {
          this.onTokenRefresh(data.accessToken, data.refreshToken);
        }

        return data.accessToken;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Make a generic API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log('=== API REQUEST ===');
    console.log('URL:', url);
    console.log('Method:', options.method || 'GET');
    console.log('Base URL:', this.baseUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('=== API FETCH ERROR ===');
      console.warn('URL:', url);
      console.warn('Error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw { message: 'Request timeout' } as ApiError;
      }
      throw {
        message: error instanceof Error ? error.message : 'Network request failed',
      } as ApiError;
    }

    clearTimeout(timeoutId);

    console.log('=== API RESPONSE ===');
    console.log('Status:', response.status, response.statusText);

    // Handle 401 Unauthorized - try to refresh token (skip for login/register/refresh endpoints)
    const authSkipPaths = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/external', '/auth/forgot-password', '/auth/reset-password'];
    const isAuthEndpoint = authSkipPaths.some(path => endpoint.toLowerCase().includes(path));
    if (response.status === 401 && !isRetry && !isAuthEndpoint && this.getTokens && this.onTokenRefresh) {
      console.log('Received 401, attempting token refresh...');
      try {
        const newAccessToken = await this.refreshAccessToken();
        const newHeaders = {
          ...options.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };
        return this.request<T>(endpoint, { ...options, headers: newHeaders }, true);
      } catch (refreshError) {
        console.warn('Token refresh failed, logging out...');
        this.onAuthFailure?.();
        throw { message: 'Session expired. Please login again.' } as ApiError;
      }
    }

    if (!response.ok) {
      const responseText = await response.text();
      console.warn('=== API ERROR ===');
      console.warn('Status:', response.status, response.statusText);
      console.warn('Body:', responseText);
      let error: ApiError;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { message: responseText || `HTTP ${response.status}: ${response.statusText}` };
      }
      throw error;
    }

    // Handle empty responses (204 No Content) or responses we don't need to parse
    const contentType = response.headers.get('content-type');
    if (response.status === 204 || !contentType?.includes('application/json')) {
      return {} as T;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text);
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data: unknown, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data: unknown, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
}

export default new ApiService();
