/**
 * Authentication slice for managing user authentication state
 */

import {createSlice, PayloadAction, createAsyncThunk} from '@reduxjs/toolkit';
import authService, {UserInfo} from '../../services/auth';
import {AuthStorage, ViewedVideoStorage, GalleryCache, OnboardingStorage, AiConsentStorage} from '../../utils/storage';
import {fetchBalance} from '../../services/coinBalanceApi';
import type {
  LoginRequest,
  RegisterRequest,
  ExternalLoginRequest,
  AuthResponse,
  ApiError,
} from '../../types';

interface AuthState {
  userId: string | null;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: number | null;
  coinBalance: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoadingUserInfo: boolean;
  isInitialized: boolean;
  error: string | null;
}

const initialState: AuthState = {
  userId: null,
  username: null,
  email: null,
  firstName: null,
  lastName: null,
  profilePictureUrl: null,
  accessToken: null,
  refreshToken: null,
  expiresIn: null,
  coinBalance: null,
  isAuthenticated: false,
  isLoading: false,
  isLoadingUserInfo: false,
  isInitialized: false,
  error: null,
};

/**
 * Helper to extract error message from API error
 */
const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const apiError = error as ApiError;
    return apiError.detail || apiError.title || apiError.message || 'An error occurred';
  }
  return 'An error occurred';
};

/**
 * Async thunk for initializing auth from storage
 */
export const initializeAuth = createAsyncThunk<
  AuthResponse | null,
  void,
  {rejectValue: string}
>('auth/initialize', async (_, {rejectWithValue}) => {
  try {
    const authData = await AuthStorage.getAuthData();
    return authData;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Async thunk for user login
 */
export const loginUser = createAsyncThunk<
  AuthResponse,
  LoginRequest,
  {rejectValue: string}
>('auth/login', async (credentials, {rejectWithValue}) => {
  try {
    const response = await authService.login(credentials);
    // Save auth data to storage
    await AuthStorage.saveAuthData(response);
    return response;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Async thunk for user registration
 */
export const registerUser = createAsyncThunk<
  AuthResponse,
  RegisterRequest,
  {rejectValue: string}
>('auth/register', async (userData, {rejectWithValue}) => {
  try {
    const response = await authService.register(userData);
    // Save auth data to storage
    await AuthStorage.saveAuthData(response);
    return response;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Async thunk for external login (Google/Apple)
 */
export const externalLogin = createAsyncThunk<
  AuthResponse,
  ExternalLoginRequest,
  {rejectValue: string}
>('auth/externalLogin', async (data, {rejectWithValue}) => {
  try {
    const response = await authService.externalLogin(data);
    // Save auth data to storage
    await AuthStorage.saveAuthData(response);
    return response;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Async thunk for token refresh
 */
export const refreshUserToken = createAsyncThunk<
  AuthResponse,
  string,
  {rejectValue: string}
>('auth/refreshToken', async (refreshToken, {rejectWithValue}) => {
  try {
    const response = await authService.refreshToken(refreshToken);
    // Save updated auth data to storage
    await AuthStorage.saveAuthData(response);
    return response;
  } catch (error) {
    // Clear storage on refresh failure
    await AuthStorage.clearAuthData();
    return rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Async thunk for user logout
 */
export const logoutUser = createAsyncThunk<
  void,
  string | undefined,
  {rejectValue: string}
>('auth/logout', async (refreshToken, {rejectWithValue}) => {
  try {
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    // Clear storage
    await AuthStorage.clearAuthData();
    await ViewedVideoStorage.clear();
  } catch (error) {
    // Still clear storage even if logout API fails
    await AuthStorage.clearAuthData();
    await ViewedVideoStorage.clear();
    return rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Async thunk for deleting user account
 */
export const deleteAccount = createAsyncThunk<
  {message: string},
  {accessToken: string; email: string},
  {rejectValue: string}
>('auth/deleteAccount', async ({accessToken, email}, {rejectWithValue}) => {
  try {
    const response = await authService.deleteAccount(accessToken);
    // Clear all local storage
    await AuthStorage.clearAuthData();
    await ViewedVideoStorage.clear();
    await GalleryCache.clearPhotos();
    await GalleryCache.clearVideos();
    await OnboardingStorage.resetOnboarding(email);
    await AiConsentStorage.resetConsent(email);
    return response;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Async thunk for fetching coin balance
 */
export const fetchCoinBalance = createAsyncThunk<
  number,
  string,
  {rejectValue: string}
>('auth/fetchCoinBalance', async (accessToken, {rejectWithValue}) => {
  try {
    const data = await fetchBalance(accessToken);
    return data.balance;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Async thunk for fetching user info
 */
export const fetchUserInfo = createAsyncThunk<
  UserInfo,
  string,
  {rejectValue: string}
>('auth/fetchUserInfo', async (accessToken, {rejectWithValue, dispatch}) => {
  try {
    const userInfo = await authService.getMe(accessToken);
    // Also fetch coin balance when user info loads
    dispatch(fetchCoinBalance(accessToken));
    return userInfo;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

/**
 * Async thunk for updating user info
 */
export const updateUserInfo = createAsyncThunk<
  UserInfo,
  {accessToken: string; data: {username?: string; email?: string}},
  {rejectValue: string}
>('auth/updateUserInfo', async ({accessToken, data}, {rejectWithValue}) => {
  try {
    const userInfo = await authService.updateMe(accessToken, data);
    return userInfo;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Clear authentication error
     */
    clearError: state => {
      state.error = null;
    },
    /**
     * Set auth from stored credentials
     */
    setAuth: (state, action: PayloadAction<AuthResponse>) => {
      state.userId = action.payload.userId;
      state.username = action.payload.username;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.expiresIn = action.payload.expiresIn;
      state.isAuthenticated = true;
      state.error = null;
    },
    /**
     * Clear authentication state
     */
    clearAuth: state => {
      state.userId = null;
      state.username = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.expiresIn = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    /**
     * Mark auth as initialized
     */
    setInitialized: state => {
      state.isInitialized = true;
    },
    /**
     * Set coin balance manually (e.g. after generation returns new balance)
     */
    setCoinBalance: (state, action: PayloadAction<number>) => {
      state.coinBalance = action.payload;
    },
    /**
     * Update tokens after refresh
     */
    updateTokens: (
      state,
      action: PayloadAction<{accessToken: string; refreshToken: string}>,
    ) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
  },
  extraReducers: builder => {
    // Initialize auth reducers
    builder
      .addCase(initializeAuth.pending, state => {
        state.isLoading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        if (action.payload) {
          state.userId = action.payload.userId;
          state.username = action.payload.username;
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
          state.expiresIn = action.payload.expiresIn;
          state.isAuthenticated = true;
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.error = action.payload || 'Failed to initialize auth';
      });

    // Login reducers
    builder
      .addCase(loginUser.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userId = action.payload.userId;
        state.username = action.payload.username;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.expiresIn = action.payload.expiresIn;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Login failed';
        state.isAuthenticated = false;
      });

    // Register reducers
    builder
      .addCase(registerUser.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userId = action.payload.userId;
        state.username = action.payload.username;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.expiresIn = action.payload.expiresIn;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Registration failed';
        state.isAuthenticated = false;
      });

    // External login reducers
    builder
      .addCase(externalLogin.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(externalLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userId = action.payload.userId;
        state.username = action.payload.username;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.expiresIn = action.payload.expiresIn;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(externalLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'External login failed';
        state.isAuthenticated = false;
      });

    // Refresh token reducers
    builder
      .addCase(refreshUserToken.pending, state => {
        state.isLoading = true;
      })
      .addCase(refreshUserToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.expiresIn = action.payload.expiresIn;
        state.error = null;
      })
      .addCase(refreshUserToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Token refresh failed';
        // Clear auth state on token refresh failure
        state.userId = null;
        state.username = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.expiresIn = null;
        state.isAuthenticated = false;
      });

    // Logout reducers
    builder
      .addCase(logoutUser.pending, state => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, state => {
        state.isLoading = false;
        state.userId = null;
        state.username = null;
        state.email = null;
        state.firstName = null;
        state.lastName = null;
        state.profilePictureUrl = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.expiresIn = null;
        state.coinBalance = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Logout failed';
        // Clear auth state even if logout API call failed
        state.userId = null;
        state.username = null;
        state.email = null;
        state.firstName = null;
        state.lastName = null;
        state.profilePictureUrl = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.expiresIn = null;
        state.coinBalance = null;
        state.isAuthenticated = false;
      });

    // Delete account reducers
    builder
      .addCase(deleteAccount.pending, state => {
        state.isLoading = true;
      })
      .addCase(deleteAccount.fulfilled, state => {
        state.isLoading = false;
        state.userId = null;
        state.username = null;
        state.email = null;
        state.firstName = null;
        state.lastName = null;
        state.profilePictureUrl = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.expiresIn = null;
        state.coinBalance = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Account deletion failed';
      });

    // Fetch user info reducers
    builder
      .addCase(fetchUserInfo.pending, state => {
        state.isLoadingUserInfo = true;
      })
      .addCase(fetchUserInfo.fulfilled, (state, action) => {
        state.isLoadingUserInfo = false;
        state.email = action.payload.email;
        state.firstName = action.payload.firstName || null;
        state.lastName = action.payload.lastName || null;
        state.profilePictureUrl = action.payload.profilePictureUrl || null;
      })
      .addCase(fetchUserInfo.rejected, state => {
        state.isLoadingUserInfo = false;
        // Don't set error for user info fetch failure, it's not critical
      });

    // Update user info reducers
    builder
      .addCase(updateUserInfo.pending, state => {
        state.isLoadingUserInfo = true;
        state.error = null;
      })
      .addCase(updateUserInfo.fulfilled, (state, action) => {
        state.isLoadingUserInfo = false;
        state.username = action.payload.username;
        state.email = action.payload.email;
        state.firstName = action.payload.firstName || null;
        state.lastName = action.payload.lastName || null;
        state.profilePictureUrl = action.payload.profilePictureUrl || null;
        state.error = null;
      })
      .addCase(updateUserInfo.rejected, (state, action) => {
        state.isLoadingUserInfo = false;
        state.error = action.payload || 'Failed to update profile';
      });

    // Fetch coin balance reducers
    builder
      .addCase(fetchCoinBalance.fulfilled, (state, action) => {
        state.coinBalance = action.payload;
      });
  },
});

export const {clearError, setAuth, clearAuth, setInitialized, updateTokens, setCoinBalance} = authSlice.actions;
export {fetchUserInfo, fetchCoinBalance};
export default authSlice.reducer;
