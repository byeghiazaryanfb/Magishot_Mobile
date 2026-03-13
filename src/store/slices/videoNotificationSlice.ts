import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import api from '../../services/api';
import {GalleryCache} from '../../utils/storage';

import type {RootState} from '../index';

export type VideoJobStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface VideoJob {
  videoId: string;
  status: VideoJobStatus;
  videoUrl?: string;
  fileName?: string;
  mimeType?: string;
  durationSeconds?: number;
  thumbnailUrl?: string | null;
  errorMessage?: string;
  isViewed: boolean;
  createdAt: string;
}

export interface VideoGalleryItem {
  videoId: string;
  videoUrl: string;
  relativeUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  createdAt: string;
  status: string;
  prompt?: string;
  aspectRatio?: string;
  generationType?: string;
  templateId?: string | null;
  errorMessage?: string | null;
  sourcePhotoUrl?: string | null;
  thumbnailUrl?: string | null;
  isPlayed: boolean;
}

interface RawVideoGalleryItem {
  id: string;
  relativeUrl: string;
  fullUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  prompt?: string;
  status: string;
  errorMessage?: string | null;
  durationSeconds: number;
  aspectRatio?: string;
  generationType?: string;
  sourcePhotoUrl?: string | null;
  thumbnailUrl?: string | null;
  templateId?: string | null;
  createdAt: string;
  hasBeenPlayed?: boolean;
}

interface RawVideoGalleryResponse {
  videos: RawVideoGalleryItem[];
  hasMore: boolean;
  nextCursor: string | null;
  totalCount: number;
}

function mapRawVideo(raw: RawVideoGalleryItem): VideoGalleryItem {
  return {
    videoId: raw.id,
    videoUrl: raw.fullUrl,
    relativeUrl: raw.relativeUrl,
    fileName: raw.fileName,
    mimeType: raw.mimeType,
    fileSizeBytes: raw.fileSizeBytes,
    durationSeconds: raw.durationSeconds,
    createdAt: raw.createdAt,
    status: raw.status,
    prompt: raw.prompt,
    aspectRatio: raw.aspectRatio,
    generationType: raw.generationType,
    templateId: raw.templateId,
    errorMessage: raw.errorMessage,
    sourcePhotoUrl: raw.sourcePhotoUrl,
    thumbnailUrl: raw.thumbnailUrl,
    isPlayed: raw.hasBeenPlayed ?? false,
  };
}

interface VideoNotificationState {
  jobs: Record<string, VideoJob>;
  unreadCount: number;
  viewedVideoIds: Record<string, boolean>;
  galleryVideos: VideoGalleryItem[];
  galleryHasMore: boolean;
  galleryNextCursor: string | null;
  isLoadingGallery: boolean;
}

const initialState: VideoNotificationState = {
  jobs: {},
  unreadCount: 0,
  viewedVideoIds: {},
  galleryVideos: [],
  galleryHasMore: false,
  galleryNextCursor: null,
  isLoadingGallery: false,
};

// Recalculate unread count from both jobs and gallery
function recalcUnread(state: VideoNotificationState): number {
  // Unread from in-session jobs (SignalR)
  const unreadJobs = Object.values(state.jobs).filter(
    j => j.status === 'ready' && !j.isViewed,
  ).length;

  // Unread from gallery — use backend isPlayed + local viewedVideoIds
  const jobIds = new Set(Object.keys(state.jobs));
  const unreadGallery = state.galleryVideos.filter(
    v =>
      !v.isPlayed &&
      !state.viewedVideoIds[v.videoId] &&
      !jobIds.has(v.videoId),
  ).length;

  return unreadJobs + unreadGallery;
}

/** Mark a video as played on the backend */
export const persistViewedVideo = createAsyncThunk(
  'videoNotification/persistViewedVideo',
  async (videoId: string, {getState}) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    await api.patch(`/api/gemini/GeminiVideo/${videoId}/played`, undefined, token || undefined);
    return videoId;
  },
);

export const fetchVideoGallery = createAsyncThunk(
  'videoNotification/fetchVideoGallery',
  async (
    {cursor, pageSize = 20, status}: {cursor?: string; pageSize?: number; status?: string},
    {getState},
  ) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('pageSize', String(pageSize));
    if (status) params.append('status', status);
    const query = params.toString();
    const url = `/api/gemini/GeminiVideo/gallery${query ? `?${query}` : ''}`;
    const raw = await api.get<RawVideoGalleryResponse>(
      url,
      token || undefined,
    );
    const response = {
      videos: (raw.videos ?? []).map(mapRawVideo),
      hasMore: raw.hasMore ?? false,
      nextCursor: raw.nextCursor ?? null,
      totalCount: raw.totalCount ?? 0,
    };
    return {response, isLoadMore: !!cursor};
  },
);

export const loadCachedVideoGallery = createAsyncThunk(
  'videoNotification/loadCachedVideoGallery',
  async () => {
    const cached = await GalleryCache.getVideos();
    return cached;
  },
);

export const deleteVideo = createAsyncThunk(
  'videoNotification/deleteVideo',
  async (videoId: string, {getState}) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    await api.delete(`/api/gemini/GeminiVideo/${videoId}`, token || undefined);
    return videoId;
  },
);

const videoNotificationSlice = createSlice({
  name: 'videoNotification',
  initialState,
  reducers: {
    addPendingJob(state, action: PayloadAction<{videoId: string}>) {
      const {videoId} = action.payload;
      state.jobs[videoId] = {
        videoId,
        status: 'pending',
        isViewed: false,
        createdAt: new Date().toISOString(),
      };
    },
    setJobProcessing(state, action: PayloadAction<{videoId: string}>) {
      const job = state.jobs[action.payload.videoId];
      if (job) {
        job.status = 'processing';
      }
    },
    setJobReady(
      state,
      action: PayloadAction<{
        videoId: string;
        videoUrl: string;
        fileName?: string;
        mimeType?: string;
        durationSeconds?: number;
        thumbnailUrl?: string | null;
      }>,
    ) {
      const {videoId, videoUrl, fileName, mimeType, durationSeconds, thumbnailUrl} =
        action.payload;
      state.jobs[videoId] = {
        ...(state.jobs[videoId] || {
          videoId,
          createdAt: new Date().toISOString(),
        }),
        videoId,
        status: 'ready',
        videoUrl,
        fileName,
        mimeType,
        durationSeconds,
        thumbnailUrl,
        isViewed: false,
      };
      state.unreadCount = recalcUnread(state);
    },
    setJobFailed(
      state,
      action: PayloadAction<{videoId: string; errorMessage?: string}>,
    ) {
      const job = state.jobs[action.payload.videoId];
      if (job) {
        job.status = 'failed';
        job.errorMessage = action.payload.errorMessage;
      }
    },
    markVideoViewed(state, action: PayloadAction<string>) {
      const videoId = action.payload;
      const job = state.jobs[videoId];
      if (job) {
        job.isViewed = true;
      }
      state.viewedVideoIds[videoId] = true;
      state.unreadCount = recalcUnread(state);
    },
    markAllVideosViewed(state) {
      Object.values(state.jobs).forEach(job => {
        if (job.status === 'ready') {
          job.isViewed = true;
        }
      });
      state.galleryVideos.forEach(v => {
        state.viewedVideoIds[v.videoId] = true;
      });
      state.unreadCount = 0;
    },
    clearUnreadBadge(state) {
      state.unreadCount = 0;
    },
    removeJob(state, action: PayloadAction<string>) {
      delete state.jobs[action.payload];
      state.unreadCount = recalcUnread(state);
    },
    clearStaleJobs(state) {
      // Remove pending/processing jobs — fresh gallery data will have the real status
      Object.keys(state.jobs).forEach(id => {
        const job = state.jobs[id];
        if (job.status === 'pending' || job.status === 'processing') {
          delete state.jobs[id];
        }
      });
      state.unreadCount = recalcUnread(state);
    },
    resetGallery(state) {
      state.galleryVideos = [];
      state.galleryHasMore = false;
      state.galleryNextCursor = null;
    },
    clearAllVideoNotifications() {
      return initialState;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(persistViewedVideo.fulfilled, (state, action) => {
        state.viewedVideoIds[action.payload] = true;
      })
      .addCase(fetchVideoGallery.pending, state => {
        state.isLoadingGallery = true;
      })
      .addCase(fetchVideoGallery.fulfilled, (state, action) => {
        const {response, isLoadMore} = action.payload;
        if (isLoadMore) {
          state.galleryVideos = [
            ...state.galleryVideos,
            ...response.videos,
          ];
        } else {
          state.galleryVideos = response.videos;
          // Cache first page for instant loading next time
          GalleryCache.saveVideos({
            videos: response.videos,
            hasMore: response.hasMore,
            nextCursor: response.nextCursor,
          });
        }
        // Sync viewedVideoIds from backend isPlayed flag
        response.videos.forEach(v => {
          if (v.isPlayed) {
            state.viewedVideoIds[v.videoId] = true;
          }
        });
        state.galleryHasMore = response.hasMore;
        state.galleryNextCursor = response.nextCursor;
        state.isLoadingGallery = false;
        state.unreadCount = recalcUnread(state);
      })
      .addCase(fetchVideoGallery.rejected, state => {
        state.isLoadingGallery = false;
      })
      .addCase(loadCachedVideoGallery.fulfilled, (state, action) => {
        const cached = action.payload;
        if (cached && cached.videos.length > 0 && state.galleryVideos.length === 0) {
          state.galleryVideos = cached.videos;
          state.galleryHasMore = cached.hasMore;
          state.galleryNextCursor = cached.nextCursor;
          state.unreadCount = recalcUnread(state);
        }
      })
      .addCase(deleteVideo.fulfilled, (state, action) => {
        const videoId = action.payload;
        state.galleryVideos = state.galleryVideos.filter(
          v => v.videoId !== videoId,
        );
        delete state.jobs[videoId];
        state.unreadCount = recalcUnread(state);
      });
  },
});

export const {
  addPendingJob,
  setJobProcessing,
  setJobReady,
  setJobFailed,
  markVideoViewed,
  markAllVideosViewed,
  clearUnreadBadge,
  removeJob,
  clearStaleJobs,
  resetGallery,
  clearAllVideoNotifications,
} = videoNotificationSlice.actions;

export default videoNotificationSlice.reducer;
