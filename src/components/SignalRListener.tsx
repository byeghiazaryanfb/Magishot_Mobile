import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import notificationService from '../services/notificationService';
import {
  addPendingJob,
  setJobProcessing,
  setJobReady,
  setJobFailed,
  clearAllVideoNotifications,
  resetGallery,
  fetchVideoGallery,
} from '../store/slices/videoNotificationSlice';
import {
  setImageJobProcessing,
  setImageJobReady,
  setImageJobFailed,
  setSynthesizeProcessing,
  setSynthesizeReady,
  setSynthesizeFailed,
  clearAllImageNotifications,
} from '../store/slices/imageNotificationSlice';
import {
  setComicJobProcessing,
  setComicJobReady,
  setComicJobFailed,
  clearAllComicNotifications,
} from '../store/slices/comicNotificationSlice';
import {fetchUnreadCounts} from '../store/slices/appSlice';
import {
  incrementUnreadCount,
  resetNotifications,
} from '../store/slices/notificationSlice';

const SignalRListener: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const accessToken = useAppSelector(state => state.auth.accessToken);
  const prevTokenRef = useRef<string | null>(null);

  // Register dispatch callbacks once on mount
  useEffect(() => {
    notificationService.setEventCallbacks(
      data => dispatch(setJobProcessing({videoId: data.videoId})),
      data => {
        dispatch(
          setJobReady({
            videoId: data.videoId,
            videoUrl: data.videoUrl,
            fileName: data.fileName,
            mimeType: data.mimeType,
            durationSeconds: data.durationSeconds,
            thumbnailUrl: data.thumbnailUrl,
          }),
        );
        dispatch(fetchUnreadCounts());
        dispatch(incrementUnreadCount());
        // Refresh gallery so the API-proxied relativeUrl is available for playback
        dispatch(resetGallery());
        dispatch(fetchVideoGallery({}));
      },
      data => {
        dispatch(
          setJobFailed({
            videoId: data.videoId,
            errorMessage: data.errorMessage,
          }),
        );
        dispatch(incrementUnreadCount());
      },
    );

    notificationService.setImageEventCallbacks(
      data => dispatch(setImageJobProcessing({photoId: data.photoId})),
      data => {
        dispatch(
          setImageJobReady({
            photoId: data.photoId,
            imageUrl: data.imageUrl,
            fileName: data.fileName,
            mimeType: data.mimeType,
          }),
        );
        // If the backend queued a video animation, register it as a pending video job
        if (data.pendingVideoId) {
          dispatch(addPendingJob({videoId: data.pendingVideoId}));
        }
        dispatch(fetchUnreadCounts());
        dispatch(incrementUnreadCount());
      },
      data => {
        dispatch(
          setImageJobFailed({
            photoId: data.photoId,
            errorMessage: data.errorMessage,
          }),
        );
        dispatch(incrementUnreadCount());
      },
    );

    notificationService.setSynthesizeEventCallbacks(
      data => dispatch(setSynthesizeProcessing({photoIds: data.photoIds})),
      data => {
        dispatch(setSynthesizeReady({images: data.images}));
        dispatch(fetchUnreadCounts());
        dispatch(incrementUnreadCount());
      },
      data => {
        dispatch(
          setSynthesizeFailed({
            photoIds: data.photoIds,
            errorMessage: data.errorMessage,
          }),
        );
        dispatch(incrementUnreadCount());
      },
    );

    notificationService.setComicEventCallbacks(
      data => dispatch(setComicJobProcessing({comicId: data.comicId})),
      data => {
        dispatch(
          setComicJobReady({
            comicId: data.comicId,
            imageUrl: data.imageUrl,
            fileName: data.fileName,
            mimeType: data.mimeType,
            thumbnailUrl: data.thumbnailUrl,
          }),
        );
        dispatch(fetchUnreadCounts());
        dispatch(incrementUnreadCount());
      },
      data => {
        dispatch(
          setComicJobFailed({
            comicId: data.comicId,
            errorMessage: data.errorMessage,
          }),
        );
        dispatch(incrementUnreadCount());
      },
    );
  }, [dispatch]);

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      if (prevTokenRef.current && prevTokenRef.current !== accessToken) {
        // Token changed (refresh) — reconnect
        notificationService.reconnectWithNewToken(accessToken);
      } else {
        notificationService.connect(accessToken);
      }
      prevTokenRef.current = accessToken;
    } else {
      // Logged out
      notificationService.disconnect();
      dispatch(clearAllVideoNotifications());
      dispatch(clearAllImageNotifications());
      dispatch(clearAllComicNotifications());
      dispatch(resetNotifications());
      prevTokenRef.current = null;
    }
  }, [isAuthenticated, accessToken, dispatch]);

  // Reconnect SignalR when app comes back to foreground
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isAuthenticated &&
        accessToken
      ) {
        if (!notificationService.isConnected()) {
          console.log('[SignalR] App foregrounded — reconnecting...');
          notificationService.connect(accessToken);
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, accessToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      notificationService.disconnect();
    };
  }, []);

  return null;
};

export default SignalRListener;
