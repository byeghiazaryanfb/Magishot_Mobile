import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import api from '../../services/api';
import type {RootState} from '../index';
import type {
  Notification,
  NotificationsResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
} from '../../types/notification';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
  nextCursor: string | null;
  isLoading: boolean;
  isMarkingAllRead: boolean;
  isDeletingAll: boolean;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  hasMore: false,
  nextCursor: null,
  isLoading: false,
  isMarkingAllRead: false,
  isDeletingAll: false,
};

export const fetchNotificationUnreadCount = createAsyncThunk(
  'notification/fetchUnreadCount',
  async (_, {getState}) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    const data = await api.get<UnreadCountResponse>(
      '/api/notifications/unread-count',
      token || undefined,
    );
    return data.unreadCount;
  },
);

export const fetchNotifications = createAsyncThunk(
  'notification/fetchNotifications',
  async (
    {cursor, pageSize = 20}: {cursor?: string; pageSize?: number},
    {getState},
  ) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('pageSize', String(pageSize));
    const query = params.toString();
    const url = `/api/notifications${query ? `?${query}` : ''}`;
    const data = await api.get<NotificationsResponse>(url, token || undefined);
    return {response: data, isLoadMore: !!cursor};
  },
);

export const markNotificationRead = createAsyncThunk(
  'notification/markRead',
  async (id: string, {getState}) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    await api.patch(
      `/api/notifications/${id}/status?isRead=true`,
      undefined,
      token || undefined,
    );
    return id;
  },
);

export const toggleNotificationReadStatus = createAsyncThunk(
  'notification/toggleReadStatus',
  async ({id, isRead}: {id: string; isRead: boolean}, {getState}) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    await api.patch(
      `/api/notifications/${id}/status?isRead=${isRead}`,
      undefined,
      token || undefined,
    );
    return {id, isRead};
  },
);

export const markAllNotificationsRead = createAsyncThunk(
  'notification/markAllRead',
  async (_, {getState}) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    const data = await api.patch<MarkAllReadResponse>(
      '/api/notifications/read-all',
      undefined,
      token || undefined,
    );
    return data.markedCount;
  },
);

export const deleteNotification = createAsyncThunk(
  'notification/delete',
  async (id: string, {getState}) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    await api.delete(`/api/notifications/${id}`, token || undefined);
    return id;
  },
);

export const deleteAllNotifications = createAsyncThunk(
  'notification/deleteAll',
  async (_, {getState}) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    await api.delete('/api/notifications', token || undefined);
  },
);

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    incrementUnreadCount(state) {
      state.unreadCount += 1;
    },
    resetNotifications() {
      return initialState;
    },
  },
  extraReducers: builder => {
    builder
      // fetchNotificationUnreadCount
      .addCase(fetchNotificationUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      // fetchNotifications
      .addCase(fetchNotifications.pending, state => {
        state.isLoading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        const {response, isLoadMore} = action.payload;
        if (isLoadMore) {
          state.notifications = [
            ...state.notifications,
            ...(response.notifications ?? []),
          ];
        } else {
          state.notifications = response.notifications ?? [];
        }
        state.hasMore = response.hasMore ?? false;
        state.nextCursor = response.nextCursor ?? null;
        state.isLoading = false;
      })
      .addCase(fetchNotifications.rejected, state => {
        state.isLoading = false;
      })
      // markNotificationRead
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const id = action.payload;
        const notification = state.notifications.find(n => n.id === id);
        if (notification && !notification.isRead) {
          notification.isRead = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      // toggleNotificationReadStatus
      .addCase(toggleNotificationReadStatus.fulfilled, (state, action) => {
        const {id, isRead} = action.payload;
        const notification = state.notifications.find(n => n.id === id);
        if (notification && notification.isRead !== isRead) {
          notification.isRead = isRead;
          if (isRead) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          } else {
            state.unreadCount += 1;
          }
        }
      })
      // markAllNotificationsRead
      .addCase(markAllNotificationsRead.pending, state => {
        state.isMarkingAllRead = true;
      })
      .addCase(markAllNotificationsRead.fulfilled, state => {
        state.notifications.forEach(n => {
          n.isRead = true;
        });
        state.unreadCount = 0;
        state.isMarkingAllRead = false;
      })
      .addCase(markAllNotificationsRead.rejected, state => {
        state.isMarkingAllRead = false;
      })
      // deleteNotification
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const id = action.payload;
        const notification = state.notifications.find(n => n.id === id);
        if (notification && !notification.isRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications = state.notifications.filter(n => n.id !== id);
      })
      // deleteAllNotifications
      .addCase(deleteAllNotifications.pending, state => {
        state.isDeletingAll = true;
      })
      .addCase(deleteAllNotifications.fulfilled, state => {
        state.notifications = [];
        state.unreadCount = 0;
        state.hasMore = false;
        state.nextCursor = null;
        state.isDeletingAll = false;
      })
      .addCase(deleteAllNotifications.rejected, state => {
        state.isDeletingAll = false;
      });
  },
});

export const {incrementUnreadCount, resetNotifications} =
  notificationSlice.actions;

export default notificationSlice.reducer;
