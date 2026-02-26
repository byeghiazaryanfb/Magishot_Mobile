import {useEffect, useRef} from 'react';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import notificationService from '../services/notificationService';
import {
  setJobProcessing,
  setJobReady,
  setJobFailed,
  clearAllVideoNotifications,
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
import {fetchUnreadCounts} from '../store/slices/appSlice';

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
      },
      data =>
        dispatch(
          setJobFailed({
            videoId: data.videoId,
            errorMessage: data.errorMessage,
          }),
        ),
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
        dispatch(fetchUnreadCounts());
      },
      data =>
        dispatch(
          setImageJobFailed({
            photoId: data.photoId,
            errorMessage: data.errorMessage,
          }),
        ),
    );

    notificationService.setSynthesizeEventCallbacks(
      data => dispatch(setSynthesizeProcessing({photoIds: data.photoIds})),
      data => {
        dispatch(setSynthesizeReady({images: data.images}));
        dispatch(fetchUnreadCounts());
      },
      data =>
        dispatch(
          setSynthesizeFailed({
            photoIds: data.photoIds,
            errorMessage: data.errorMessage,
          }),
        ),
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
      prevTokenRef.current = null;
    }
  }, [isAuthenticated, accessToken, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      notificationService.disconnect();
    };
  }, []);

  return null;
};

export default SignalRListener;
