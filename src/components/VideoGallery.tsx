import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {
  fetchVideoGallery,
  loadCachedVideoGallery,
  deleteVideo,
  markVideoViewed,
  persistViewedVideo,
  resetGallery,
  removeJob,
  VideoGalleryItem,
  VideoJob,
} from '../store/slices/videoNotificationSlice';
import {fetchUnreadCounts} from '../store/slices/appSlice';
import AnimateResultModal from './AnimateResultModal';
import CustomDialog from './CustomDialog';
import {config} from '../utils/config';

interface VideoGalleryProps {
  visible: boolean;
  onClose: () => void;
}

// Unified item type for the list
type ListItem =
  | {type: 'active'; job: VideoJob}
  | {type: 'ready'; job: VideoJob}
  | {type: 'gallery'; video: VideoGalleryItem};

const VideoGallery: React.FC<VideoGalleryProps> = ({visible, onClose}) => {
  const {colors} = useTheme();
  const dispatch = useAppDispatch();

  const {jobs, galleryVideos, galleryHasMore, galleryNextCursor, isLoadingGallery, viewedVideoIds} =
    useAppSelector(state => state.videoNotification);

  const [selectedVideo, setSelectedVideo] = useState<{
    videoUrl: string;
    videoId?: string;
    fileName: string;
    mimeType: string;
    durationSeconds: number;
  } | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Categorise jobs from Redux store
  const activeJobs = useMemo(
    () =>
      Object.values(jobs).filter(
        j => j.status === 'pending' || j.status === 'processing',
      ),
    [jobs],
  );

  const readyJobs = useMemo(
    () => Object.values(jobs).filter(j => j.status === 'ready' && j.videoUrl),
    [jobs],
  );

  // IDs of ready jobs so we can de-duplicate against gallery API results
  const readyJobIds = useMemo(
    () => new Set(readyJobs.map(j => j.videoId)),
    [readyJobs],
  );

  // Gallery videos that aren't already covered by a ready job
  const dedupedGalleryVideos = useMemo(
    () => galleryVideos.filter(v => !readyJobIds.has(v.videoId)),
    [galleryVideos, readyJobIds],
  );

  // Build unified list
  const listData: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];
    activeJobs.forEach(job => items.push({type: 'active', job}));
    readyJobs.forEach(job => items.push({type: 'ready', job}));
    dedupedGalleryVideos.forEach(video => items.push({type: 'gallery', video}));
    return items;
  }, [activeJobs, readyJobs, dedupedGalleryVideos]);

  // Total count for header
  const totalCount = readyJobs.length + dedupedGalleryVideos.length;

  // Load gallery when modal opens: show cache instantly, then fetch fresh
  useEffect(() => {
    if (visible) {
      dispatch(loadCachedVideoGallery());
      dispatch(fetchVideoGallery({}));
    }
  }, [visible, dispatch]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    dispatch(resetGallery());
    dispatch(fetchVideoGallery({})).finally(() => setIsRefreshing(false));
  }, [dispatch]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingGallery && galleryHasMore && galleryNextCursor) {
      dispatch(fetchVideoGallery({cursor: galleryNextCursor}));
    }
  }, [isLoadingGallery, galleryHasMore, galleryNextCursor, dispatch]);

  const handlePlayVideo = (videoUrl: string, fileName: string, mimeType: string, durationSeconds: number, videoId?: string) => {
    setSelectedVideo({videoUrl, videoId, fileName, mimeType, durationSeconds});
    setShowVideoPlayer(true);
    if (videoId) {
      dispatch(markVideoViewed(videoId));
      dispatch(persistViewedVideo(videoId)).then(() => {
        dispatch(fetchUnreadCounts());
      });
    }
  };

  const handleDelete = (videoId: string) => {
    setItemToDelete(videoId);
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      // Try server delete (best-effort)
      await dispatch(deleteVideo(itemToDelete)).unwrap();
    } catch {
      // If server delete fails, still remove locally
      dispatch(removeJob(itemToDelete));
    } finally {
      setIsDeleting(false);
      setDeleteDialogVisible(false);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogVisible(false);
    setItemToDelete(null);
  };

  const getFullUrl = (url?: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${config.apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

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

  const renderItem = ({item}: {item: ListItem}) => {
    if (item.type === 'active') {
      return (
        <View style={[styles.gridItem, {backgroundColor: colors.backgroundTertiary}]}>
          <View style={[styles.gridThumb, {justifyContent: 'center', alignItems: 'center'}]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <View style={styles.gridOverlay}>
            <Text style={styles.gridStatus}>
              {item.job.status === 'pending' ? 'Queued...' : 'Processing...'}
            </Text>
          </View>
        </View>
      );
    }

    // Ready job from notification OR gallery item
    // Prefer API-proxied URL (relativeUrl) over direct Azure Blob URL
    let videoUrl: string;
    if (item.type === 'ready') {
      // Check if gallery already has this video with a relativeUrl
      const galleryMatch = galleryVideos.find(v => v.videoId === item.job.videoId);
      videoUrl = (galleryMatch && getFullUrl(galleryMatch.relativeUrl)) || item.job.videoUrl!;
    } else {
      videoUrl = getFullUrl(item.video.relativeUrl) || item.video.videoUrl;
    }

    const fileName =
      item.type === 'ready'
        ? item.job.fileName || 'Animated Video'
        : item.video.fileName || 'Animated Video';
    const mimeType =
      item.type === 'ready'
        ? item.job.mimeType || 'video/mp4'
        : item.video.mimeType;
    const durationSeconds =
      item.type === 'ready'
        ? item.job.durationSeconds || 5
        : item.video.durationSeconds;
    const videoId =
      item.type === 'ready' ? item.job.videoId : item.video.videoId;
    const isNew = item.type === 'ready'
      ? !item.job.isViewed
      : !item.video.isPlayed && !viewedVideoIds[item.video.videoId];
    const thumbnailUrl = item.type === 'ready'
      ? getFullUrl(item.job.thumbnailUrl)
      : getFullUrl(item.video.thumbnailUrl);
    const sourcePhotoUrl = item.type === 'gallery'
      ? item.video.sourcePhotoUrl
      : null;

    return (
      <TouchableOpacity
        style={[
          styles.gridItem,
          {backgroundColor: colors.backgroundTertiary},
          isNew && {borderColor: colors.primary, borderWidth: 2},
        ]}
        onPress={() => handlePlayVideo(videoUrl, fileName, mimeType, durationSeconds, videoId)}
        activeOpacity={0.7}>
        {sourcePhotoUrl ? (
          <FastImage
            source={{uri: sourcePhotoUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable}}
            style={styles.gridThumb}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : thumbnailUrl ? (
          <FastImage
            source={{uri: thumbnailUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable}}
            style={styles.gridThumb}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.gridThumb, {justifyContent: 'center', alignItems: 'center'}]}>
            <Ionicons name="videocam" size={32} color={colors.textTertiary} />
          </View>
        )}
        {/* Play button */}
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={24} color="#fff" style={{marginLeft: 2}} />
          </View>
        </View>
        {/* NEW badge */}
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
        {/* Duration */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationBadgeText}>{formatDuration(durationSeconds)}</Text>
        </View>
        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(videoId)}
          activeOpacity={0.7}>
          <View style={styles.deleteButtonInner}>
            <Text style={styles.deleteIcon}>✕</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const keyExtractor = (item: ListItem) =>
    item.type === 'gallery' ? item.video.videoId : item.job.videoId;

  const renderFooter = () => {
    if (!isLoadingGallery || listData.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, {color: colors.textSecondary}]}>
          Loading more...
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoadingGallery) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconContainer, {backgroundColor: colors.primary + '15'}]}>
          <Ionicons name="videocam-outline" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
          No Videos Yet
        </Text>
        <Text style={[styles.emptySubtitle, {color: colors.textTertiary}]}>
          Your animated videos will appear here
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={[styles.overlay, {backgroundColor: colors.overlay}]}>
        <View style={[styles.container, {backgroundColor: colors.backgroundSecondary}]}>
          {/* Header */}
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              Videos
            </Text>
            <Text style={[styles.subtitle, {color: colors.textTertiary}]}>
              {totalCount} video{totalCount !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
              onPress={onClose}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={[styles.closeButtonText, {color: colors.textPrimary}]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loading state — only show spinner if we have nothing at all */}
          {isLoadingGallery && listData.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
                Loading videos...
              </Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              extraData={viewedVideoIds}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              numColumns={3}
              contentContainerStyle={
                listData.length === 0
                  ? styles.emptyListContent
                  : styles.listContent
              }
              columnWrapperStyle={listData.length > 0 ? styles.gridRow : undefined}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
              ListEmptyComponent={renderEmpty}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
            />
          )}
        </View>
      </View>

      {/* Video Player Modal */}
      <AnimateResultModal
        visible={showVideoPlayer}
        onClose={() => {
          setShowVideoPlayer(false);
          setSelectedVideo(null);
        }}
        videoResult={selectedVideo}
      />

      {/* Delete Confirmation */}
      <CustomDialog
        visible={deleteDialogVisible}
        icon="trash-outline"
        iconColor={colors.error}
        title="Delete Video"
        message="Are you sure you want to delete this video? This action cannot be undone."
        buttons={[
          {
            text: isDeleting ? 'Deleting...' : 'Delete',
            onPress: confirmDelete,
            style: 'cancel',
          },
          {
            text: 'Cancel',
            onPress: cancelDelete,
            style: 'default',
          },
        ]}
        onClose={cancelDelete}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    minHeight: '70%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginLeft: 10,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  emptyListContent: {
    flexGrow: 1,
    padding: 16,
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
  gridThumb: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  gridStatus: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF1B6D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    zIndex: 10,
  },
  deleteButtonInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,71,87,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
});

export default VideoGallery;
