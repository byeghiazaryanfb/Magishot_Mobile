import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  RefreshControl,
  AppState,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {
  getUserPhotos,
  deleteUserPhoto,
  deleteAllUserPhotos,
  markPhotoOpened,
  UserPhoto,
} from '../services/userPhotosApi';
import {
  fetchVideoGallery,
  loadCachedVideoGallery,
  deleteVideo,
  markVideoViewed,
  persistViewedVideo,
  resetGallery,
  removeJob,
  clearAllVideoNotifications,
  VideoGalleryItem,
  VideoJob,
} from '../store/slices/videoNotificationSlice';
import type {ImageJob} from '../store/slices/imageNotificationSlice';
import {fetchUnreadCounts, markPhotoViewed} from '../store/slices/appSlice';
import CustomDialog from '../components/CustomDialog';
import AnimateResultModal from '../components/AnimateResultModal';
import {GalleryCache} from '../utils/storage';
import type {RootStackParamList} from '../navigation/RootNavigator';
import {config} from '../utils/config';

type TabType = 'photos' | 'videos';

// Unified photo list item type
type PhotoListItem =
  | {type: 'activeImage'; job: ImageJob}
  | {type: 'photo'; photo: UserPhoto};

// Unified video list item type
type VideoListItem =
  | {type: 'active'; job: VideoJob}
  | {type: 'ready'; job: VideoJob}
  | {type: 'failed'; job: VideoJob}
  | {type: 'gallery'; video: VideoGalleryItem};

const MyCreationsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MyCreations'>>();
  const {colors} = useTheme();
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(state => state.auth.accessToken);
  const {unopenedPhotosCount, unplayedVideosCount} = useAppSelector(state => state.app);

  const [activeTab, setActiveTab] = useState<TabType>(route.params?.initialTab || 'photos');
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  // Sync tab when navigating back with a new initialTab param
  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Badge is now driven by isPlayed from the backend;
  // it clears only when individual videos are actually played.

  // ─── Photos state ───
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isLoadingMorePhotos, setIsLoadingMorePhotos] = useState(false);
  const [isRefreshingPhotos, setIsRefreshingPhotos] = useState(false);
  const [hasMorePhotos, setHasMorePhotos] = useState(true);
  const [nextPhotoCursor, setNextPhotoCursor] = useState<string | null>(null);
  const [photoTotalCount, setPhotoTotalCount] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [clearAllDialogVisible, setClearAllDialogVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [messageDialog, setMessageDialog] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }>({visible: false, type: 'error', title: '', message: ''});

  // ─── Image jobs (for pending/processing indicators) ───
  const imageJobs = useAppSelector(state => state.imageNotification.jobs);

  // ─── Track viewed photos via Redux (shared with PhotoDetailScreen) ───
  const viewedPhotoIds = useAppSelector(state => state.app.viewedPhotoIds);

  // ─── Videos state ───
  const {jobs, galleryVideos, galleryHasMore, galleryNextCursor, isLoadingGallery, viewedVideoIds} =
    useAppSelector(state => state.videoNotification);
  const [selectedVideo, setSelectedVideo] = useState<{
    videoUrl: string;
    fileName: string;
    mimeType: string;
    durationSeconds: number;
  } | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [isRefreshingVideos, setIsRefreshingVideos] = useState(false);
  const [videoDeleteDialogVisible, setVideoDeleteDialogVisible] = useState(false);
  const [videoItemToDelete, setVideoItemToDelete] = useState<string | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);
  const [clearVideosDialogVisible, setClearVideosDialogVisible] = useState(false);
  const [isDeletingAllVideos, setIsDeletingAllVideos] = useState(false);

  // ─── Tab animation ───
  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: activeTab === 'photos' ? 0 : 1,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabIndicatorAnim]);

  // ─── Mark individual video viewed when played ───
  const handleMarkViewed = useCallback((videoId: string) => {
    dispatch(markVideoViewed(videoId));
    dispatch(persistViewedVideo(videoId)).then(() => {
      dispatch(fetchUnreadCounts());
    });
  }, [dispatch]);

  // ─── Mark individual photo opened when tapped ───
  const handleMarkPhotoOpened = useCallback((photoId: string) => {
    dispatch(markPhotoViewed(photoId));
    if (accessToken) {
      markPhotoOpened(accessToken, photoId);
      dispatch(fetchUnreadCounts());
    }
  }, [accessToken, dispatch]);

  // ─── Gallery lookup for ready job thumbnails ───
  const galleryByVideoId = useMemo(() => {
    const map = new Map<string, VideoGalleryItem>();
    galleryVideos.forEach(v => map.set(v.videoId, v));
    return map;
  }, [galleryVideos]);

  // ─── Photos: fetch ───
  const fetchPhotos = useCallback(async (cursor?: string, isRefresh = false) => {
    if (!accessToken) {
      setPhotoError('Please log in to view your photos.');
      return;
    }

    if (isRefresh) {
      setIsRefreshingPhotos(true);
    } else if (!cursor) {
      setIsLoadingPhotos(true);
    } else {
      setIsLoadingMorePhotos(true);
    }
    setPhotoError(null);

    try {
      const response = await getUserPhotos(accessToken, cursor);
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response from server');
      }

      const fetchedPhotos = response.photos ?? [];
      const hasMore = response.hasMore ?? false;
      const nextCursorValue = response.nextCursor ?? null;
      const total = response.totalCount ?? 0;

      if (isRefresh || !cursor) {
        setPhotos(fetchedPhotos);
        // Cache first page for instant loading next time
        GalleryCache.savePhotos({photos: fetchedPhotos, hasMore, nextCursor: nextCursorValue, totalCount: total});
      } else {
        setPhotos(prev => [...prev, ...fetchedPhotos]);
      }

      setHasMorePhotos(hasMore);
      setNextPhotoCursor(nextCursorValue);
      setPhotoTotalCount(total);
    } catch {
      setPhotoError('Failed to load photos. Please try again.');
    } finally {
      setIsLoadingPhotos(false);
      setIsLoadingMorePhotos(false);
      setIsRefreshingPhotos(false);
    }
  }, [accessToken]);

  // Load photos on mount: show cache instantly, then fetch fresh
  useEffect(() => {
    const loadCached = async () => {
      const cached = await GalleryCache.getPhotos();
      if (cached && cached.photos.length > 0) {
        setPhotos(cached.photos);
        setHasMorePhotos(cached.hasMore);
        setNextPhotoCursor(cached.nextCursor);
        setPhotoTotalCount(cached.totalCount);
      }
    };
    loadCached();
    fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh photos when app comes back to foreground
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        accessToken
      ) {
        fetchPhotos(undefined, true);
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [accessToken, fetchPhotos]);

  // ─── Videos: data ───
  const activeJobs = useMemo(
    () => Object.values(jobs).filter(j => j.status === 'pending' || j.status === 'processing'),
    [jobs],
  );

  const readyJobs = useMemo(
    () => Object.values(jobs)
      .filter(j => j.status === 'ready' && j.videoUrl)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [jobs],
  );

  const failedJobs = useMemo(
    () => Object.values(jobs)
      .filter(j => j.status === 'failed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [jobs],
  );

  const readyJobIds = useMemo(() => new Set(readyJobs.map(j => j.videoId)), [readyJobs]);

  const dedupedGalleryVideos = useMemo(
    () => galleryVideos.filter(v => !readyJobIds.has(v.videoId)),
    [galleryVideos, readyJobIds],
  );

  const videoListData: VideoListItem[] = useMemo(() => {
    const items: VideoListItem[] = [];
    activeJobs.forEach(job => items.push({type: 'active', job}));
    failedJobs.forEach(job => items.push({type: 'failed', job}));
    readyJobs.forEach(job => items.push({type: 'ready', job}));
    dedupedGalleryVideos.forEach(video => items.push({type: 'gallery', video}));
    return items;
  }, [activeJobs, failedJobs, readyJobs, dedupedGalleryVideos]);

  const videoTotalCount = readyJobs.length + dedupedGalleryVideos.length;

  // Load videos only when the videos tab is active: show cache instantly, then fetch fresh
  const [videosLoaded, setVideosLoaded] = useState(false);
  useEffect(() => {
    if (activeTab === 'videos' && !videosLoaded) {
      dispatch(loadCachedVideoGallery());
      dispatch(fetchVideoGallery({}));
      setVideosLoaded(true);
    }
  }, [activeTab, videosLoaded, dispatch]);

  // ─── Photos: handlers ───
  const showMessage = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    setMessageDialog({visible: true, type, title, message});
  };

  const hideMessage = () => {
    setMessageDialog(prev => ({...prev, visible: false}));
  };

  const handlePhotoDelete = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogVisible(true);
  };

  const confirmPhotoDelete = async () => {
    if (!itemToDelete || !accessToken) return;
    setIsDeleting(true);
    try {
      await deleteUserPhoto(accessToken, itemToDelete);
      setPhotos(prev => prev.filter(p => p.id !== itemToDelete));
      setPhotoTotalCount(prev => prev - 1);
      showMessage('success', 'Deleted', 'Photo deleted successfully');
    } catch {
      showMessage('error', 'Error', 'Failed to delete photo');
    } finally {
      setIsDeleting(false);
      setDeleteDialogVisible(false);
      setItemToDelete(null);
    }
  };

  const cancelPhotoDelete = () => {
    setDeleteDialogVisible(false);
    setItemToDelete(null);
  };

  const handleClearAll = () => {
    setClearAllDialogVisible(true);
  };

  const confirmClearAll = async () => {
    if (!accessToken) return;
    setIsDeleting(true);
    try {
      const response = await deleteAllUserPhotos(accessToken);
      setPhotos([]);
      setPhotoTotalCount(0);
      setHasMorePhotos(false);
      setNextPhotoCursor(null);
      GalleryCache.clearPhotos();
      showMessage('success', 'Cleared', response.message || 'All photos deleted successfully');
    } catch {
      showMessage('error', 'Error', 'Failed to delete all photos');
    } finally {
      setIsDeleting(false);
      setClearAllDialogVisible(false);
    }
  };

  const cancelClearAll = () => {
    setClearAllDialogVisible(false);
  };

  const handlePhotoRefresh = useCallback(() => {
    fetchPhotos(undefined, true);
  }, [fetchPhotos]);

  const handlePhotoLoadMore = useCallback(() => {
    if (!isLoadingMorePhotos && hasMorePhotos && nextPhotoCursor) {
      fetchPhotos(nextPhotoCursor);
    }
  }, [isLoadingMorePhotos, hasMorePhotos, nextPhotoCursor, fetchPhotos]);

  // ─── Photos: active image jobs ───
  const activeImageJobs = useMemo(
    () => Object.values(imageJobs).filter(
      j => j.status === 'pending' || j.status === 'processing',
    ),
    [imageJobs],
  );

  const photoListData: PhotoListItem[] = useMemo(() => {
    const items: PhotoListItem[] = [];
    activeImageJobs.forEach(job => items.push({type: 'activeImage', job}));
    photos.forEach(photo => items.push({type: 'photo', photo}));
    return items;
  }, [activeImageJobs, photos]);

  // ─── Videos: handlers ───
  const handleVideoRefresh = useCallback(() => {
    setIsRefreshingVideos(true);
    dispatch(resetGallery());
    dispatch(fetchVideoGallery({})).finally(() => setIsRefreshingVideos(false));
  }, [dispatch]);

  const handleVideoLoadMore = useCallback(() => {
    if (!isLoadingGallery && galleryHasMore && galleryNextCursor) {
      dispatch(fetchVideoGallery({cursor: galleryNextCursor}));
    }
  }, [isLoadingGallery, galleryHasMore, galleryNextCursor, dispatch]);

  const handlePlayVideo = (videoUrl: string, fileName: string, mimeType: string, durationSeconds: number, videoId?: string) => {
    setSelectedVideo({videoUrl, fileName, mimeType, durationSeconds});
    setShowVideoPlayer(true);
    if (videoId) {
      handleMarkViewed(videoId);
    }
  };

  const handleVideoDelete = (videoId: string) => {
    setVideoItemToDelete(videoId);
    setVideoDeleteDialogVisible(true);
  };

  const confirmVideoDelete = async () => {
    if (!videoItemToDelete) return;
    setIsDeletingVideo(true);
    try {
      await dispatch(deleteVideo(videoItemToDelete)).unwrap();
    } catch {
      dispatch(removeJob(videoItemToDelete));
    } finally {
      setIsDeletingVideo(false);
      setVideoDeleteDialogVisible(false);
      setVideoItemToDelete(null);
    }
  };

  const cancelVideoDelete = () => {
    setVideoDeleteDialogVisible(false);
    setVideoItemToDelete(null);
  };

  const handleClearVideoHistory = () => {
    setClearVideosDialogVisible(true);
  };

  const confirmClearVideoHistory = async () => {
    setIsDeletingAllVideos(true);
    try {
      const allVideoIds = [
        ...Object.values(jobs).filter(j => j.status === 'ready').map(j => j.videoId),
        ...galleryVideos.map(v => v.videoId),
      ];
      await Promise.all(allVideoIds.map(id => dispatch(deleteVideo(id)).unwrap().catch(() => dispatch(removeJob(id)))));
      dispatch(clearAllVideoNotifications());
      dispatch(resetGallery());
      GalleryCache.clearVideos();
      showMessage('success', 'Cleared', 'All videos deleted successfully');
    } catch {
      showMessage('error', 'Error', 'Failed to delete all videos');
    } finally {
      setIsDeletingAllVideos(false);
      setClearVideosDialogVisible(false);
    }
  };

  const cancelClearVideoHistory = () => {
    setClearVideosDialogVisible(false);
  };

  // ─── Helpers ───
  const getFullUrl = (url?: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${config.apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // ─── Formatters ───
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Photos: render items ───
  const renderPhotoItem = ({item}: {item: PhotoListItem}) => {
    if (item.type === 'activeImage') {
      return (
        <View style={[styles.gridItem, {backgroundColor: colors.backgroundTertiary}]}>
          <View style={[styles.gridImage, {justifyContent: 'center', alignItems: 'center'}]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <View style={[styles.gridOverlay, {backgroundColor: 'rgba(0,0,0,0.5)'}]}>
            <Text style={styles.gridLabel} numberOfLines={1}>
              {item.job.status === 'pending' ? 'Queued...' : 'Processing...'}
            </Text>
          </View>
        </View>
      );
    }

    const photo = item.photo;
    const isPending = photo.status === 'Pending' || photo.status === 'Processing';
    const isFailed = photo.status === 'Failed';
    const isUnopened = !isPending && !isFailed && !photo.hasBeenViewed && !viewedPhotoIds[photo.id];
    // Index within actual photos array for PhotoDetail navigation
    const photoIndex = photos.indexOf(photo);

    return (
      <TouchableOpacity
        style={[
          styles.gridItem,
          {backgroundColor: colors.backgroundTertiary},
          isUnopened && {borderColor: colors.primary, borderWidth: 2},
          isFailed && {borderColor: colors.error, borderWidth: 2},
        ]}
        onPress={() => {
          if (!isPending && !isFailed) {
            if (isUnopened) {
              handleMarkPhotoOpened(photo.id);
            }
            navigation.navigate('PhotoDetail', {photos, currentIndex: photoIndex});
          }
        }}
        activeOpacity={isPending || isFailed ? 1 : 0.8}>
        {isPending ? (
          <View style={[styles.gridImage, {justifyContent: 'center', alignItems: 'center'}]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : isFailed ? (
          <View style={[styles.gridImage, {justifyContent: 'center', alignItems: 'center'}]}>
            <Ionicons name="alert-circle" size={32} color={colors.error} />
          </View>
        ) : (
          <FastImage
            source={{uri: photo.thumbnailFullUrl ?? photo.fullUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable}}
            style={styles.gridImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        )}
        {/* FAILED badge for failed photos */}
        {isFailed && (
          <View style={styles.photoFailedBadge}>
            <Text style={styles.photoFailedBadgeText}>FAILED</Text>
          </View>
        )}
        {/* NEW badge for unopened photos */}
        {isUnopened && (
          <View style={styles.photoNewBadge}>
            <Text style={styles.photoNewBadgeText}>NEW</Text>
          </View>
        )}
        <View style={[styles.gridOverlay, {backgroundColor: 'rgba(0,0,0,0.5)'}]}>
          <Text style={styles.gridLabel} numberOfLines={1}>
            {isPending ? (photo.status === 'Pending' ? 'Queued...' : 'Processing...') : isFailed ? 'Failed' : photo.generationType || 'Generated'}
          </Text>
          <Text style={styles.gridDate}>{formatDate(photo.createdAt)}</Text>
        </View>
        {!isPending && (
          <TouchableOpacity
            style={styles.gridDeleteButton}
            onPress={e => {
              e.stopPropagation();
              handlePhotoDelete(photo.id);
            }}
            activeOpacity={0.7}>
            <View style={styles.gridDeleteButtonInner}>
              <Text style={styles.gridDeleteIcon}>✕</Text>
            </View>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderPhotoFooter = () => {
    if (!isLoadingMorePhotos) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, {color: colors.textSecondary}]}>Loading more...</Text>
      </View>
    );
  };

  // ─── Videos: render items ───
  const renderVideoItem = ({item}: {item: VideoListItem}) => {
    if (item.type === 'active') {
      return (
        <View style={[styles.videoGridItem, {backgroundColor: colors.backgroundTertiary}]}>
          <View style={[styles.videoGridThumb, {justifyContent: 'center', alignItems: 'center'}]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <View style={styles.videoGridOverlay}>
            <Text style={styles.videoGridStatus}>
              {item.job.status === 'pending' ? 'Queued...' : 'Processing...'}
            </Text>
          </View>
        </View>
      );
    }

    if (item.type === 'failed') {
      return (
        <View style={[styles.videoGridItem, {backgroundColor: colors.backgroundTertiary, borderColor: colors.error, borderWidth: 2}]}>
          <View style={[styles.videoGridThumb, {justifyContent: 'center', alignItems: 'center'}]}>
            <Ionicons name="alert-circle" size={32} color={colors.error} />
          </View>
          <View style={styles.videoFailedBadge}>
            <Text style={styles.videoFailedBadgeText}>FAILED</Text>
          </View>
          <View style={styles.videoGridOverlay}>
            <Text style={styles.videoGridStatus}>Failed</Text>
          </View>
          <TouchableOpacity
            style={styles.videoGridDeleteButton}
            onPress={e => {
              e.stopPropagation();
              handleVideoDelete(item.job.videoId);
            }}
            activeOpacity={0.7}>
            <View style={styles.videoGridDeleteInner}>
              <Text style={styles.videoGridDeleteIcon}>✕</Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    const videoUrl = item.type === 'ready' ? item.job.videoUrl! : item.video.videoUrl;
    const fileName = item.type === 'ready' ? item.job.fileName || 'Animated Video' : item.video.fileName || 'Animated Video';
    const mimeType = item.type === 'ready' ? item.job.mimeType || 'video/mp4' : item.video.mimeType;
    const durationSeconds = item.type === 'ready' ? item.job.durationSeconds || 5 : item.video.durationSeconds;
    const videoId = item.type === 'ready' ? item.job.videoId : item.video.videoId;
    // For ready jobs, look up sourcePhotoUrl / thumbnailUrl from gallery data
    const sourcePhotoUrl = item.type === 'gallery'
      ? item.video.sourcePhotoUrl
      : galleryByVideoId.get(item.job.videoId)?.sourcePhotoUrl;
    const thumbnailUrl = item.type === 'gallery'
      ? getFullUrl(item.video.thumbnailUrl)
      : getFullUrl(item.job.thumbnailUrl) || getFullUrl(galleryByVideoId.get(item.job.videoId)?.thumbnailUrl);
    // Check if gallery video failed
    const isGalleryFailed = item.type === 'gallery' && item.video.status === 'Failed';
    // NEW for ready jobs (in-session) or unviewed gallery items (backend isPlayed + local)
    const isNew = !isGalleryFailed && (item.type === 'ready'
      ? !item.job.isViewed
      : !item.video.isPlayed && !viewedVideoIds[item.video.videoId]);

    return (
      <TouchableOpacity
        style={[
          styles.videoGridItem,
          {backgroundColor: colors.backgroundTertiary},
          isNew && {borderColor: colors.primary, borderWidth: 2},
          isGalleryFailed && {borderColor: colors.error, borderWidth: 2},
        ]}
        onPress={() => !isGalleryFailed && handlePlayVideo(videoUrl, fileName, mimeType, durationSeconds, videoId)}
        activeOpacity={isGalleryFailed ? 1 : 0.8}>
        {isGalleryFailed ? (
          <View style={[styles.videoGridThumb, {justifyContent: 'center', alignItems: 'center'}]}>
            <Ionicons name="alert-circle" size={32} color={colors.error} />
          </View>
        ) : sourcePhotoUrl ? (
          <FastImage
            source={{uri: sourcePhotoUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable}}
            style={styles.videoGridThumb}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : thumbnailUrl ? (
          <FastImage
            source={{uri: thumbnailUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable}}
            style={styles.videoGridThumb}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.videoGridThumb, {justifyContent: 'center', alignItems: 'center'}]}>
            <Ionicons name="videocam" size={32} color={colors.textTertiary} />
          </View>
        )}
        {/* FAILED badge for failed gallery videos */}
        {isGalleryFailed && (
          <View style={styles.videoFailedBadge}>
            <Text style={styles.videoFailedBadgeText}>FAILED</Text>
          </View>
        )}
        {/* Play button overlay */}
        {!isGalleryFailed && (
          <View style={styles.videoPlayOverlay}>
            <View style={styles.videoPlayButton}>
              <Ionicons name="play" size={24} color="#fff" style={{marginLeft: 2}} />
            </View>
          </View>
        )}
        {/* NEW badge for unviewed videos */}
        {isNew && (
          <View style={styles.videoNewBadge}>
            <Text style={styles.videoNewBadgeText}>NEW</Text>
          </View>
        )}
        {/* Duration badge */}
        {!isGalleryFailed && (
          <View style={styles.videoDurationBadge}>
            <Text style={styles.videoDurationBadgeText}>{formatDuration(durationSeconds)}</Text>
          </View>
        )}
        {/* Delete button */}
        <TouchableOpacity
          style={styles.videoGridDeleteButton}
          onPress={e => {
            e.stopPropagation();
            handleVideoDelete(videoId);
          }}
          activeOpacity={0.7}>
          <View style={styles.videoGridDeleteInner}>
            <Text style={styles.videoGridDeleteIcon}>✕</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const videoKeyExtractor = (item: VideoListItem) =>
    item.type === 'gallery' ? item.video.videoId : `${item.type}-${item.job.videoId}`;

  const renderVideoFooter = () => {
    if (!isLoadingGallery || videoListData.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, {color: colors.textSecondary}]}>Loading more...</Text>
      </View>
    );
  };

  const renderVideoEmpty = () => {
    if (isLoadingGallery) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconContainer, {backgroundColor: colors.primary + '15'}]}>
          <Ionicons name="videocam-outline" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>No Videos Yet</Text>
        <Text style={[styles.emptySubtitle, {color: colors.textTertiary}]}>
          Your animated videos will appear here
        </Text>
      </View>
    );
  };

  // ─── Photos tab content ───
  const renderPhotosTab = () => {
    if (isLoadingPhotos && photos.length === 0 && activeImageJobs.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>Loading photos...</Text>
        </View>
      );
    }

    if (photoError) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, {backgroundColor: colors.error + '15'}]}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          </View>
          <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>Error Loading Photos</Text>
          <Text style={[styles.emptySubtitle, {color: colors.textTertiary}]}>{photoError}</Text>
          <TouchableOpacity
            style={[styles.retryButton, {backgroundColor: colors.primary}]}
            onPress={() => fetchPhotos()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (photos.length === 0 && activeImageJobs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, {backgroundColor: colors.primary + '15'}]}>
            <Ionicons name="images-outline" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>No Photos Yet</Text>
          <Text style={[styles.emptySubtitle, {color: colors.textTertiary}]}>
            Your generated photos will appear here
          </Text>
        </View>
      );
    }

    return (
      <>
        <FlatList
          key="photos-grid"
          data={photoListData}
          extraData={viewedPhotoIds}
          renderItem={renderPhotoItem}
          keyExtractor={item => item.type === 'activeImage' ? `img-job-${item.job.photoId}` : item.photo.id}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          onEndReached={handlePhotoLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderPhotoFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingPhotos}
              onRefresh={handlePhotoRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />

        {photos.length > 0 && (
          <TouchableOpacity
            style={[styles.clearButton, {borderColor: colors.error}]}
            onPress={handleClearAll}
            disabled={isDeleting}>
            <Text style={[styles.clearButtonText, {color: colors.error}]}>
              {isDeleting ? 'Deleting...' : 'Clear All History'}
            </Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  // ─── Videos tab content ───
  const renderVideosTab = () => {
    if (isLoadingGallery && videoListData.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>Loading videos...</Text>
        </View>
      );
    }

    return (
      <>
        <FlatList
          key="videos-grid"
          data={videoListData}
          extraData={viewedVideoIds}
          renderItem={renderVideoItem}
          keyExtractor={videoKeyExtractor}
          numColumns={3}
          contentContainerStyle={videoListData.length === 0 ? styles.emptyListContent : styles.gridContent}
          columnWrapperStyle={videoListData.length > 0 ? styles.gridRow : undefined}
          showsVerticalScrollIndicator={false}
          onEndReached={handleVideoLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderVideoFooter}
          ListEmptyComponent={renderVideoEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingVideos}
              onRefresh={handleVideoRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />

        {videoListData.length > 0 && (
          <TouchableOpacity
            style={[styles.clearButton, {borderColor: colors.error}]}
            onPress={handleClearVideoHistory}
            disabled={isDeletingAllVideos}>
            <Text style={[styles.clearButtonText, {color: colors.error}]}>
              {isDeletingAllVideos ? 'Deleting...' : 'Clear Video History'}
            </Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.backgroundSecondary}]}>
        <TouchableOpacity
          style={[styles.backButton, {backgroundColor: colors.backgroundTertiary}]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>My Creations</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, {backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border}]}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('photos')}
          activeOpacity={0.7}>
          <View style={styles.tabLabelContainer}>
            <Text
              style={[
                styles.tabText,
                {color: activeTab === 'photos' ? colors.primary : colors.textTertiary},
              ]}>
              Photos
            </Text>
            {unopenedPhotosCount > 0 && (
              <View style={[styles.tabBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.tabBadgeText}>
                  {unopenedPhotosCount > 99 ? '99+' : unopenedPhotosCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('videos')}
          activeOpacity={0.7}>
          <View style={styles.tabLabelContainer}>
            <Text
              style={[
                styles.tabText,
              {color: activeTab === 'videos' ? colors.primary : colors.textTertiary},
            ]}>
            Videos
          </Text>
            {unplayedVideosCount > 0 && (
              <View style={[styles.tabBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.tabBadgeText}>
                  {unplayedVideosCount > 99 ? '99+' : unplayedVideosCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              backgroundColor: colors.primary,
              transform: [
                {
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ],
              left: activeTab === 'photos' ? '0%' : '50%',
              width: '50%',
            },
          ]}
        />
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'photos' ? renderPhotosTab() : renderVideosTab()}
      </View>

      {/* Photo Delete Confirmation Dialog */}
      <CustomDialog
        visible={deleteDialogVisible}
        icon="trash-outline"
        iconColor={colors.error}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        buttons={[
          {text: isDeleting ? 'Deleting...' : 'Delete', onPress: confirmPhotoDelete, style: 'cancel'},
          {text: 'Cancel', onPress: cancelPhotoDelete, style: 'default'},
        ]}
        onClose={cancelPhotoDelete}
      />

      {/* Clear All Confirmation Dialog */}
      <CustomDialog
        visible={clearAllDialogVisible}
        icon="warning-outline"
        iconColor={colors.error}
        title="Clear All History"
        message="Are you sure you want to delete all your photos? This action cannot be undone."
        buttons={[
          {text: isDeleting ? 'Deleting...' : 'Clear All', onPress: confirmClearAll, style: 'cancel'},
          {text: 'Cancel', onPress: cancelClearAll, style: 'default'},
        ]}
        onClose={cancelClearAll}
      />

      {/* Clear Video History Confirmation Dialog */}
      <CustomDialog
        visible={clearVideosDialogVisible}
        icon="warning-outline"
        iconColor={colors.error}
        title="Clear Video History"
        message="Are you sure you want to delete all your videos? This action cannot be undone."
        buttons={[
          {text: isDeletingAllVideos ? 'Deleting...' : 'Clear All', onPress: confirmClearVideoHistory, style: 'cancel'},
          {text: 'Cancel', onPress: cancelClearVideoHistory, style: 'default'},
        ]}
        onClose={cancelClearVideoHistory}
      />

      {/* Message Dialog */}
      <CustomDialog
        visible={messageDialog.visible}
        icon={messageDialog.type === 'success' ? 'checkmark-circle' : messageDialog.type === 'warning' ? 'warning' : 'alert-circle'}
        iconColor={messageDialog.type === 'success' ? '#10B981' : messageDialog.type === 'warning' ? '#F59200' : colors.error}
        title={messageDialog.title}
        message={messageDialog.message}
        buttons={[
          {text: messageDialog.type === 'success' ? 'Done' : 'Got it', onPress: hideMessage, style: 'default'},
        ]}
        onClose={hideMessage}
      />

      {/* Video Player Modal */}
      <AnimateResultModal
        visible={showVideoPlayer}
        onClose={() => {
          setShowVideoPlayer(false);
          setSelectedVideo(null);
        }}
        videoResult={selectedVideo}
      />

      {/* Video Delete Confirmation */}
      <CustomDialog
        visible={videoDeleteDialogVisible}
        icon="trash-outline"
        iconColor={colors.error}
        title="Delete Video"
        message="Are you sure you want to delete this video? This action cannot be undone."
        buttons={[
          {text: isDeletingVideo ? 'Deleting...' : 'Delete', onPress: confirmVideoDelete, style: 'cancel'},
          {text: 'Cancel', onPress: cancelVideoDelete, style: 'default'},
        ]}
        onClose={cancelVideoDelete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    position: 'relative',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tabContent: {
    flex: 1,
  },
  // Photos grid
  gridContent: {
    padding: 16,
    paddingBottom: 80,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  gridItem: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  gridDeleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    zIndex: 10,
  },
  gridDeleteButtonInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 71, 87, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridDeleteIcon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  photoNewBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF1B6D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 5,
  },
  photoNewBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  photoFailedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF4747',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 5,
  },
  photoFailedBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
  },
  gridLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  gridDate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
  },
  // Videos grid
  emptyListContent: {
    flexGrow: 1,
    padding: 16,
  },
  videoGridItem: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  videoGridThumb: {
    width: '100%',
    height: '100%',
  },
  videoGridOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoNewBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF1B6D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoNewBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  videoFailedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF4747',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 5,
  },
  videoFailedBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDurationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  videoGridDeleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    zIndex: 10,
  },
  videoGridDeleteInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 71, 87, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoGridDeleteIcon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  videoGridStatus: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  // Shared
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
  },
  clearButton: {
    marginHorizontal: 24,
    marginTop: 10,
    marginBottom: 100,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MyCreationsScreen;
