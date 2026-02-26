/**
 * Common TypeScript type definitions
 */

export interface User {
  userId: string;
  username: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  username: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface ExternalLoginRequest {
  provider: 'google' | 'apple';
  idToken: string;
  fullName: string;
}

export interface ApiError {
  message: string;
  code?: string;
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  details?: unknown;
}
