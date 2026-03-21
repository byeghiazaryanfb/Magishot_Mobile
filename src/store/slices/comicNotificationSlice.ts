import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {ComicPanel} from '../../services/comicsApi';

export type ComicJobStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface ComicJob {
  comicId: string;
  status: ComicJobStatus;
  imageUrl?: string;
  fileName?: string;
  mimeType?: string;
  thumbnailUrl?: string;
  panels?: ComicPanel[];
  errorMessage?: string;
  isViewed: boolean;
  createdAt: string;
}

interface ComicNotificationState {
  jobs: Record<string, ComicJob>;
  unreadCount: number;
}

const initialState: ComicNotificationState = {
  jobs: {},
  unreadCount: 0,
};

function recalcUnread(state: ComicNotificationState): number {
  return Object.values(state.jobs).filter(
    j => j.status === 'ready' && !j.isViewed,
  ).length;
}

const comicNotificationSlice = createSlice({
  name: 'comicNotification',
  initialState,
  reducers: {
    addPendingComicJob(state, action: PayloadAction<{comicId: string}>) {
      const {comicId} = action.payload;
      state.jobs[comicId] = {
        comicId,
        status: 'pending',
        isViewed: false,
        createdAt: new Date().toISOString(),
      };
    },
    setComicJobProcessing(state, action: PayloadAction<{comicId: string}>) {
      const job = state.jobs[action.payload.comicId];
      if (job) {
        job.status = 'processing';
      }
    },
    setComicJobReady(
      state,
      action: PayloadAction<{
        comicId: string;
        imageUrl: string;
        fileName?: string;
        mimeType?: string;
        thumbnailUrl?: string;
        panels?: ComicPanel[];
      }>,
    ) {
      const {comicId, imageUrl, fileName, mimeType, thumbnailUrl, panels} = action.payload;
      state.jobs[comicId] = {
        ...(state.jobs[comicId] || {
          comicId,
          createdAt: new Date().toISOString(),
        }),
        comicId,
        status: 'ready',
        imageUrl,
        fileName,
        mimeType,
        thumbnailUrl,
        panels,
        isViewed: false,
      };
      state.unreadCount = recalcUnread(state);
    },
    setComicJobFailed(
      state,
      action: PayloadAction<{comicId: string; errorMessage?: string}>,
    ) {
      const job = state.jobs[action.payload.comicId];
      if (job) {
        job.status = 'failed';
        job.errorMessage = action.payload.errorMessage;
      }
    },
    markComicViewed(state, action: PayloadAction<string>) {
      const job = state.jobs[action.payload];
      if (job) {
        job.isViewed = true;
      }
      state.unreadCount = recalcUnread(state);
    },
    removeComicJob(state, action: PayloadAction<string>) {
      delete state.jobs[action.payload];
      state.unreadCount = recalcUnread(state);
    },
    clearAllComicNotifications() {
      return initialState;
    },
  },
});

export const {
  addPendingComicJob,
  setComicJobProcessing,
  setComicJobReady,
  setComicJobFailed,
  markComicViewed,
  removeComicJob,
  clearAllComicNotifications,
} = comicNotificationSlice.actions;

export default comicNotificationSlice.reducer;
