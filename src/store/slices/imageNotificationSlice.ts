import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export type ImageJobStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface ImageJob {
  photoId: string;
  status: ImageJobStatus;
  imageUrl?: string;
  fileName?: string;
  mimeType?: string;
  errorMessage?: string;
  isViewed: boolean;
  createdAt: string;
}

interface ImageNotificationState {
  jobs: Record<string, ImageJob>;
  unreadCount: number;
}

const initialState: ImageNotificationState = {
  jobs: {},
  unreadCount: 0,
};

function recalcUnread(state: ImageNotificationState): number {
  return Object.values(state.jobs).filter(
    j => j.status === 'ready' && !j.isViewed,
  ).length;
}

const imageNotificationSlice = createSlice({
  name: 'imageNotification',
  initialState,
  reducers: {
    addPendingImageJob(state, action: PayloadAction<{photoId: string}>) {
      const {photoId} = action.payload;
      state.jobs[photoId] = {
        photoId,
        status: 'pending',
        isViewed: false,
        createdAt: new Date().toISOString(),
      };
    },
    setImageJobProcessing(state, action: PayloadAction<{photoId: string}>) {
      const job = state.jobs[action.payload.photoId];
      if (job) {
        job.status = 'processing';
      }
    },
    setImageJobReady(
      state,
      action: PayloadAction<{
        photoId: string;
        imageUrl: string;
        fileName?: string;
        mimeType?: string;
      }>,
    ) {
      const {photoId, imageUrl, fileName, mimeType} = action.payload;
      state.jobs[photoId] = {
        ...(state.jobs[photoId] || {
          photoId,
          createdAt: new Date().toISOString(),
        }),
        photoId,
        status: 'ready',
        imageUrl,
        fileName,
        mimeType,
        isViewed: false,
      };
      state.unreadCount = recalcUnread(state);
    },
    setImageJobFailed(
      state,
      action: PayloadAction<{photoId: string; errorMessage?: string}>,
    ) {
      const job = state.jobs[action.payload.photoId];
      if (job) {
        job.status = 'failed';
        job.errorMessage = action.payload.errorMessage;
      }
    },
    markImageViewed(state, action: PayloadAction<string>) {
      const job = state.jobs[action.payload];
      if (job) {
        job.isViewed = true;
      }
      state.unreadCount = recalcUnread(state);
    },
    removeImageJob(state, action: PayloadAction<string>) {
      delete state.jobs[action.payload];
      state.unreadCount = recalcUnread(state);
    },
    // Synthesize: add multiple pending jobs at once
    addPendingSynthesizeJobs(state, action: PayloadAction<{photoIds: string[]}>) {
      const now = new Date().toISOString();
      action.payload.photoIds.forEach(photoId => {
        state.jobs[photoId] = {
          photoId,
          status: 'pending',
          isViewed: false,
          createdAt: now,
        };
      });
    },
    // Synthesize: mark multiple jobs processing
    setSynthesizeProcessing(state, action: PayloadAction<{photoIds: string[]}>) {
      action.payload.photoIds.forEach(photoId => {
        const job = state.jobs[photoId];
        if (job) {
          job.status = 'processing';
        }
      });
    },
    // Synthesize: mark multiple jobs ready
    setSynthesizeReady(
      state,
      action: PayloadAction<{
        images: Array<{photoId: string; imageUrl: string; fileName?: string; mimeType?: string}>;
      }>,
    ) {
      action.payload.images.forEach(({photoId, imageUrl, fileName, mimeType}) => {
        state.jobs[photoId] = {
          ...(state.jobs[photoId] || {photoId, createdAt: new Date().toISOString()}),
          photoId,
          status: 'ready',
          imageUrl,
          fileName,
          mimeType,
          isViewed: false,
        };
      });
      state.unreadCount = recalcUnread(state);
    },
    // Synthesize: mark multiple jobs failed
    setSynthesizeFailed(
      state,
      action: PayloadAction<{photoIds: string[]; errorMessage?: string}>,
    ) {
      action.payload.photoIds.forEach(photoId => {
        const job = state.jobs[photoId];
        if (job) {
          job.status = 'failed';
          job.errorMessage = action.payload.errorMessage;
        }
      });
    },
    clearStaleImageJobs(state) {
      // Remove pending/processing jobs — fresh gallery data will have the real status
      Object.keys(state.jobs).forEach(id => {
        const job = state.jobs[id];
        if (job.status === 'pending' || job.status === 'processing') {
          delete state.jobs[id];
        }
      });
      state.unreadCount = recalcUnread(state);
    },
    clearAllImageNotifications() {
      return initialState;
    },
  },
});

export const {
  addPendingImageJob,
  setImageJobProcessing,
  setImageJobReady,
  setImageJobFailed,
  markImageViewed,
  removeImageJob,
  addPendingSynthesizeJobs,
  setSynthesizeProcessing,
  setSynthesizeReady,
  setSynthesizeFailed,
  clearStaleImageJobs,
  clearAllImageNotifications,
} = imageNotificationSlice.actions;

export default imageNotificationSlice.reducer;
