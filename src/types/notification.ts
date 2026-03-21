export interface Notification {
  id: string;
  title: string;
  message: string;
  resourceType: 'photo' | 'video' | 'comic';
  resourceId: string;
  status: 'ready' | 'failed';
  thumbnailUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkAllReadResponse {
  markedCount: number;
}
