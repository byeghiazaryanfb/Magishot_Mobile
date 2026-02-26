/**
 * Redux store configuration
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import appReducer from './slices/appSlice';
import transformReducer from './slices/transformSlice';
import historyReducer from './slices/historySlice';
import tryOnReducer from './slices/tryOnSlice';
import videoNotificationReducer from './slices/videoNotificationSlice';
import imageNotificationReducer from './slices/imageNotificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    app: appReducer,
    transform: transformReducer,
    history: historyReducer,
    tryOn: tryOnReducer,
    videoNotification: videoNotificationReducer,
    imageNotification: imageNotificationReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;