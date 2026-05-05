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
import notificationReducer from './slices/notificationSlice';
import comicNotificationReducer from './slices/comicNotificationSlice';
import subscriptionReducer from './slices/subscriptionSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    app: appReducer,
    transform: transformReducer,
    history: historyReducer,
    tryOn: tryOnReducer,
    videoNotification: videoNotificationReducer,
    imageNotification: imageNotificationReducer,
    notification: notificationReducer,
    comicNotification: comicNotificationReducer,
    subscription: subscriptionReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;