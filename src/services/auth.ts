/**
 * Authentication service
 */

import api from './api';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ExternalLoginRequest,
} from '../types';

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

class AuthService {
  /**
   * Login user with email/username and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return api.post<AuthResponse>('/api/Auth/login', credentials);
  }

  /**
   * Register new user
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    return api.post<AuthResponse>('/api/Auth/register', userData);
  }

  /**
   * External login with Google or Apple
   */
  async externalLogin(data: ExternalLoginRequest): Promise<AuthResponse> {
    return api.post<AuthResponse>('/api/Auth/external', data);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return api.post<AuthResponse>('/api/Auth/refresh-token', {
      refreshToken,
    });
  }

  /**
   * Logout user - revokes the refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    return api.post<void>('/api/Auth/logout', { refreshToken });
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    return api.post<void>('/api/Auth/forgot-password', { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    return api.post<void>('/api/Auth/reset-password', {
      token,
      newPassword,
    });
  }

  /**
   * Delete user account and all associated data permanently
   */
  async deleteAccount(accessToken: string): Promise<{message: string}> {
    return api.delete<{message: string}>('/api/Auth/account', accessToken);
  }

  /**
   * Get current user info
   */
  async getMe(accessToken: string): Promise<UserInfo> {
    return api.get<UserInfo>('/api/Auth/me', accessToken);
  }

  /**
   * Update current user info
   */
  async updateMe(
    accessToken: string,
    data: {username?: string; email?: string},
  ): Promise<UserInfo> {
    return api.put<UserInfo>('/api/Auth/me', data, accessToken);
  }
}

export default new AuthService();
