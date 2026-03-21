import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  PanResponder,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {navigate} from '../navigation/navigationRef';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAppSelector} from '../store/hooks';
import {useTheme} from '../theme/ThemeContext';
import type {ImageJob} from '../store/slices/imageNotificationSlice';
import type {VideoJob} from '../store/slices/videoNotificationSlice';
import type {ComicJob} from '../store/slices/comicNotificationSlice';

interface NotificationItem {
  id: string;
  type: 'success' | 'error';
  mediaType: 'image' | 'video' | 'comic';
  title: string;
  message: string;
}

const DISPLAY_DURATION = 5000;
const SLIDE_DURATION = 350;
const SWIPE_THRESHOLD = -40;

const InAppNotificationBanner: React.FC = () => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const imageJobs = useAppSelector(state => state.imageNotification.jobs);
  const videoJobs = useAppSelector(state => state.videoNotification.jobs);
  const comicJobs = useAppSelector(state => state.comicNotification.jobs);

  const [currentNotification, setCurrentNotification] = useState<NotificationItem | null>(null);
  const queueRef = useRef<NotificationItem[]>([]);
  const isShowingRef = useRef(false);
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevImageJobsRef = useRef<Record<string, ImageJob>>({});
  const prevVideoJobsRef = useRef<Record<string, VideoJob>>({});
  const prevComicJobsRef = useRef<Record<string, ComicJob>>({});

  const dismiss = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    progressAnim.stopAnimation();
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: SLIDE_DURATION,
      useNativeDriver: true,
    }).start(() => {
      setCurrentNotification(null);
      isShowingRef.current = false;

      // Show next queued notification
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        showNotification(next);
      }
    });
  }, [slideAnim, progressAnim]);

  const showNotification = useCallback(
    (item: NotificationItem) => {
      isShowingRef.current = true;
      setCurrentNotification(item);
      progressAnim.setValue(0);

      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 50,
        useNativeDriver: true,
      }).start();

      // Progress bar countdown
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: DISPLAY_DURATION,
        useNativeDriver: false,
      }).start();

      dismissTimer.current = setTimeout(dismiss, DISPLAY_DURATION);
    },
    [slideAnim, progressAnim, dismiss],
  );

  const enqueue = useCallback(
    (item: NotificationItem) => {
      if (isShowingRef.current) {
        // Don't queue duplicates
        if (
          currentNotification?.id !== item.id &&
          !queueRef.current.find(q => q.id === item.id)
        ) {
          queueRef.current.push(item);
        }
      } else {
        showNotification(item);
      }
    },
    [showNotification, currentNotification],
  );

  // Swipe-up to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy < -10,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < SWIPE_THRESHOLD) {
          dismiss();
        }
      },
    }),
  ).current;

  // Watch for image job status transitions
  useEffect(() => {
    const prevJobs = prevImageJobsRef.current;

    Object.entries(imageJobs).forEach(([photoId, job]) => {
      const prevStatus = prevJobs[photoId]?.status;

      if (job.status === 'ready' && prevStatus && prevStatus !== 'ready') {
        enqueue({
          id: `img-${photoId}`,
          type: 'success',
          mediaType: 'image',
          title: 'Image Ready!',
          message: 'Your image has been generated. Tap to view.',
        });
      } else if (job.status === 'failed' && prevStatus && prevStatus !== 'failed') {
        enqueue({
          id: `img-${photoId}`,
          type: 'error',
          mediaType: 'image',
          title: 'Image Failed',
          message: job.errorMessage || 'Something went wrong. Please try again.',
        });
      }
    });

    prevImageJobsRef.current = {...imageJobs};
  }, [imageJobs, enqueue]);

  // Watch for video job status transitions
  useEffect(() => {
    const prevJobs = prevVideoJobsRef.current;

    Object.entries(videoJobs).forEach(([videoId, job]) => {
      const prevStatus = prevJobs[videoId]?.status;

      if (job.status === 'ready' && prevStatus && prevStatus !== 'ready') {
        enqueue({
          id: `vid-${videoId}`,
          type: 'success',
          mediaType: 'video',
          title: 'Video Ready!',
          message: 'Your video has been generated. Tap to view.',
        });
      } else if (job.status === 'failed' && prevStatus && prevStatus !== 'failed') {
        enqueue({
          id: `vid-${videoId}`,
          type: 'error',
          mediaType: 'video',
          title: 'Video Failed',
          message: job.errorMessage || 'Something went wrong. Please try again.',
        });
      }
    });

    prevVideoJobsRef.current = {...videoJobs};
  }, [videoJobs, enqueue]);

  // Watch for comic job status transitions
  useEffect(() => {
    const prevJobs = prevComicJobsRef.current;

    Object.entries(comicJobs).forEach(([comicId, job]) => {
      const prevStatus = prevJobs[comicId]?.status;

      if (job.status === 'ready' && prevStatus && prevStatus !== 'ready') {
        enqueue({
          id: `comic-${comicId}`,
          type: 'success',
          mediaType: 'comic',
          title: 'Comic Ready!',
          message: 'Your comic has been generated. Tap to view.',
        });
      } else if (job.status === 'failed' && prevStatus && prevStatus !== 'failed') {
        enqueue({
          id: `comic-${comicId}`,
          type: 'error',
          mediaType: 'comic',
          title: 'Comic Failed',
          message: job.errorMessage || 'Something went wrong. Please try again.',
        });
      }
    });

    prevComicJobsRef.current = {...comicJobs};
  }, [comicJobs, enqueue]);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  const handleTap = useCallback(() => {
    const mediaType = currentNotification?.mediaType;
    dismiss();
    navigate('MyCreations', {initialTab: mediaType === 'video' ? 'videos' : mediaType === 'comic' ? 'comics' : 'photos'});
  }, [dismiss, currentNotification]);

  if (!currentNotification) {
    return null;
  }

  const isSuccess = currentNotification.type === 'success';
  const mediaType = currentNotification.mediaType;

  const gradientColors = isSuccess
    ? [colors.gradientStart, colors.gradientEnd]
    : [colors.error, colors.error + 'CC'];

  const iconName = isSuccess
    ? mediaType === 'video'
      ? 'videocam'
      : mediaType === 'comic'
        ? 'book'
        : 'image'
    : 'alert-circle';

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{translateY: slideAnim}],
          paddingTop: insets.top + 8,
        },
      ]}
      {...panResponder.panHandlers}>
      <TouchableOpacity
        onPress={handleTap}
        activeOpacity={0.9}
        style={styles.touchable}>
        <LinearGradient
          colors={gradientColors as [string, string]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.banner}>
          <View style={styles.iconCircle}>
            <Ionicons name={iconName} size={22} color="#fff" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {currentNotification.title}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {currentNotification.message}
            </Text>
          </View>
          <View style={styles.actions}>
            {isSuccess && (
              <View style={styles.viewButton}>
                <Text style={styles.viewButtonText}>View</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={dismiss}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressBar, {width: progressWidth}]}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 8,
  },
  touchable: {
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  banner: {
    height:100,
    flexDirection: 'row',
    alignItems: 'center',
    //paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 20,
    gap: 6,
    overflow: 'hidden',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  message: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },
});

export default InAppNotificationBanner;
