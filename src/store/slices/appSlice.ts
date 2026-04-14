/**
 * Application slice for managing general application state
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';
import type { RootState } from '../index';

interface UnreadResponse {
  unopenedPhotosCount: number;
  unplayedVideosCount: number;
  unviewedComicsCount: number;
  totalUnreadCount: number;
}

interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  theme: 'light' | 'dark' | 'system';
  networkStatus: 'online' | 'offline';
  unopenedPhotosCount: number;
  unplayedVideosCount: number;
  unviewedComicsCount: number;
  viewedPhotoIds: Record<string, boolean>;
  businessMode: boolean;
  accountDeleted: boolean;
}

const initialState: AppState = {
  isInitialized: false,
  isLoading: false,
  error: null,
  theme: 'system',
  networkStatus: 'online',
  unopenedPhotosCount: 0,
  unplayedVideosCount: 0,
  unviewedComicsCount: 0,
  viewedPhotoIds: {},
  businessMode: false,
  accountDeleted: false,
};

export const fetchUnreadCounts = createAsyncThunk(
  'app/fetchUnreadCounts',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    if (!token) return { unopenedPhotosCount: 0, unplayedVideosCount: 0, unviewedComicsCount: 0, totalUnreadCount: 0 };
    const response = await api.get<UnreadResponse>('/api/UserPhotos/unread', token);
    return response;
  },
);

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    setNetworkStatus: (state, action: PayloadAction<'online' | 'offline'>) => {
      state.networkStatus = action.payload;
    },
    markPhotoViewed: (state, action: PayloadAction<string>) => {
      state.viewedPhotoIds[action.payload] = true;
    },
    toggleBusinessMode: state => {
      state.businessMode = !state.businessMode;
    },
    setAccountDeleted: (state, action: PayloadAction<boolean>) => {
      state.accountDeleted = action.payload;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchUnreadCounts.fulfilled, (state, action) => {
      state.unopenedPhotosCount = action.payload.unopenedPhotosCount;
      state.unplayedVideosCount = action.payload.unplayedVideosCount;
      state.unviewedComicsCount = action.payload.unviewedComicsCount ?? 0;
    });
  },
});

export const {
  setInitialized,
  setLoading,
  setError,
  clearError,
  setTheme,
  setNetworkStatus,
  markPhotoViewed,
  toggleBusinessMode,
  setAccountDeleted,
} = appSlice.actions;

export default appSlice.reducer;
