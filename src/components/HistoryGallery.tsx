import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  RefreshControl,
  AppState,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Share from 'react-native-share';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {useAppSelector} from '../store/hooks';
import {
  getUserPhotos,
  deleteUserPhoto,
  deleteAllUserPhotos,
  UserPhoto,
} from '../services/userPhotosApi';
import CustomDialog from './CustomDialog';
import FullScreenImageModal from './FullScreenImageModal';

interface HistoryGalleryProps {
  visible: boolean;
  onClose: () => void;
}

const HistoryGallery: React.FC<HistoryGalleryProps> = ({visible, onClose}) => {
  const {colors} = useTheme();
  const accessToken = useAppSelector(state => state.auth.accessToken);

  // API state
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedItem, setSelectedItem] = useState<UserPhoto | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [clearAllDialogVisible, setClearAllDialogVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const previewLoadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messageDialog, setMessageDialog] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }>({visible: false, type: 'error', title: '', message: ''});

  const showMessage = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    setMessageDialog({visible: true, type, title, message});
  };

  const hideMessage = () => {
    setMessageDialog(prev => ({...prev, visible: false}));
  };


  // Fetch photos from API
  const fetchPhotos = useCallback(async (cursor?: string, isRefresh = false) => {
    if (!accessToken) {
      setError('Please log in to view your photos.');
      return;
    }

    if (isRefresh) {
      setIsRefreshing(true);
    } else if (!cursor) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const response = await getUserPhotos(accessToken, cursor);

      // Handle undefined or malformed response
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response from server');
      }

      const photos = response.photos ?? [];
      const hasMorePhotos = response.hasMore ?? false;
      const nextCursorValue = response.nextCursor ?? null;
      const total = response.totalCount ?? 0;

      if (isRefresh || !cursor) {
        setPhotos(photos);
      } else {
        setPhotos(prev => [...prev, ...photos]);
      }

      setHasMore(hasMorePhotos);
      setNextCursor(nextCursorValue);
      setTotalCount(total);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to load photos. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  // Load photos when modal becomes visible
  useEffect(() => {
    if (visible) {
      fetchPhotos();
    } else {
      // Reset state when modal closes
      setPhotos([]);
      setSelectedItem(null);
      setNextCursor(null);
      setHasMore(true);
    }
  }, [visible, fetchPhotos]);

  // Refresh photos when app comes back to foreground while modal is open
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        visible &&
        accessToken
      ) {
        fetchPhotos(undefined, true);
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [visible, accessToken, fetchPhotos]);

  // Handle pull to refresh
  const handleRefresh = useCallback(() => {
    fetchPhotos(undefined, true);
  }, [fetchPhotos]);

  // Handle load more (infinite scroll)
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && nextCursor) {
      fetchPhotos(nextCursor);
    }
  }, [isLoadingMore, hasMore, nextCursor, fetchPhotos]);

  const requestAndroidPermission = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version >= 33) return true;

    const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
    const hasPermission = await PermissionsAndroid.check(permission);
    if (hasPermission) return true;

    const status = await PermissionsAndroid.request(permission);
    return status === 'granted';
  };

  const handleSave = async (imageUrl: string) => {
    try {
      const hasPermission = await requestAndroidPermission();
      if (!hasPermission) {
        showMessage('warning', 'Permission Denied', 'Cannot save without permission');
        return;
      }

      // Check if it's a local file or remote URL
      const isLocalFile = imageUrl.startsWith('file://') || imageUrl.startsWith('/');

      if (isLocalFile) {
        // For local files, save directly to camera roll
        const localPath = imageUrl.startsWith('file://') ? imageUrl : `file://${imageUrl}`;
        await CameraRoll.saveAsset(localPath, {type: 'photo'});
      } else {
        // For remote URLs, download first then save
        const fileName = `transformed_${Date.now()}.png`;
        const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

        const downloadResult = await RNFS.downloadFile({
          fromUrl: imageUrl,
          toFile: filePath,
        }).promise;

        if (downloadResult.statusCode !== 200) {
          throw new Error('Failed to download image');
        }

        await CameraRoll.saveAsset(`file://${filePath}`, {type: 'photo'});
        await RNFS.unlink(filePath);
      }

      showMessage('success', 'Saved!', 'Photo saved to your gallery');
    } catch {
      showMessage('error', 'Error', 'Failed to save photo');
    }
  };

  const handleShare = async (item: UserPhoto) => {
    try {
      const shareTitle = item.prompt
        ? `My AI-transformed photo`
        : 'My AI-transformed photo';
      const shareMessage = item.prompt
        ? `Check out my AI-transformed photo! ${item.prompt}`
        : 'Check out my AI-transformed photo!';

      // For remote URLs, download first then share
      const fileName = `transformed_${Date.now()}.png`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: item.fullUrl,
        toFile: filePath,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error('Failed to download image');
      }

      await Share.open({
        title: shareTitle,
        message: shareMessage,
        url: `file://${filePath}`,
        type: item.mimeType || 'image/png',
      });

      await RNFS.unlink(filePath);
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        showMessage('error', 'Error', 'Failed to share photo');
      }
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !accessToken) return;

    setIsDeleting(true);
    try {
      await deleteUserPhoto(accessToken, itemToDelete);

      // Remove from local state
      setPhotos(prev => prev.filter(p => p.id !== itemToDelete));
      setTotalCount(prev => prev - 1);

      if (selectedItem?.id === itemToDelete) {
        setSelectedItem(null);
      }

      showMessage('success', 'Deleted', 'Photo deleted successfully');
    } catch (err) {
      showMessage('error', 'Error', 'Failed to delete photo');
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

  const handleClearAll = () => {
    setClearAllDialogVisible(true);
  };

  const confirmClearAll = async () => {
    if (!accessToken) return;

    setIsDeleting(true);
    try {
      const response = await deleteAllUserPhotos(accessToken);

      // Clear local state
      setPhotos([]);
      setSelectedItem(null);
      setTotalCount(0);
      setHasMore(false);
      setNextCursor(null);

      showMessage('success', 'Cleared', response.message || 'All photos deleted successfully');
    } catch (err) {
      showMessage('error', 'Error', 'Failed to delete all photos');
    } finally {
      setIsDeleting(false);
      setClearAllDialogVisible(false);
    }
  };

  const cancelClearAll = () => {
    setClearAllDialogVisible(false);
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderHistoryItem = ({item}: {item: UserPhoto}) => (
    <TouchableOpacity
      style={[
        styles.gridItem,
        {backgroundColor: colors.backgroundTertiary},
        selectedItem?.id === item.id && {borderColor: colors.primary, borderWidth: 3},
      ]}
      onPress={() => {
        if (previewLoadingTimer.current) clearTimeout(previewLoadingTimer.current);
        setIsPreviewLoading(true);
        // If no thumbnail, skip the black placeholder phase
        setPreviewReady(!item.thumbnailFullUrl);
        setSelectedItem(item);
      }}
      activeOpacity={0.8}>
      <FastImage
        source={{uri: item.thumbnailFullUrl ?? item.fullUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable}}
        style={styles.gridImage}
        resizeMode={FastImage.resizeMode.cover}
      />
      <View style={[styles.gridOverlay, {backgroundColor: 'rgba(0,0,0,0.5)'}]}>
        <Text style={styles.gridLabel} numberOfLines={1}>
          {item.generationType || 'Generated'}
        </Text>
        <Text style={styles.gridDate}>{formatDate(item.createdAt)}</Text>
      </View>
      {/* Delete button */}
      <TouchableOpacity
        style={styles.gridDeleteButton}
        onPress={(e) => {
          e.stopPropagation();
          handleDelete(item.id);
        }}
        activeOpacity={0.7}>
        <View style={styles.gridDeleteButtonInner}>
          <Text style={styles.gridDeleteIcon}>✕</Text>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, {color: colors.textSecondary}]}>
          Loading more...
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
              History
            </Text>
            <Text style={[styles.subtitle, {color: colors.textTertiary}]}>
              {totalCount} photo{totalCount !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
              onPress={onClose}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={[styles.closeButtonText, {color: colors.textPrimary}]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
                Loading history...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, {backgroundColor: colors.error + '15'}]}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
              </View>
              <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
                Error Loading Photos
              </Text>
              <Text style={[styles.emptySubtitle, {color: colors.textTertiary}]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, {backgroundColor: colors.primary}]}
                onPress={() => fetchPhotos()}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : photos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, {backgroundColor: colors.primary + '15'}]}>
                <Ionicons name="images-outline" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
                No Photos Yet
              </Text>
              <Text style={[styles.emptySubtitle, {color: colors.textTertiary}]}>
                Your generated photos will appear here
              </Text>
            </View>
          ) : (
            <>
              {/* Selected Item Preview */}
              {selectedItem && (
                <View style={[styles.previewContainer, {backgroundColor: colors.background}]}>
                  <TouchableOpacity
                    style={styles.previewImageContainer}
                    onPress={() => setFullScreenImage(selectedItem.fullUrl)}
                    activeOpacity={0.9}>
                    <View style={styles.previewImageZoomContainer}>
                      {previewReady ? (
                        <>
                          {/* Thumbnail shown while full image loads */}
                          {isPreviewLoading && selectedItem.thumbnailFullUrl && (
                            <FastImage
                              key={`thumb-${selectedItem.id}`}
                              source={{uri: selectedItem.thumbnailFullUrl, priority: FastImage.priority.high, cache: FastImage.cacheControl.immutable}}
                              style={[styles.previewImage, {position: 'absolute', top: 0, left: 0, zIndex: 2}]}
                              resizeMode={FastImage.resizeMode.contain}
                            />
                          )}
                          {/* Full resolution image */}
                          <FastImage
                            key={selectedItem.id}
                            source={{uri: selectedItem.fullUrl, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable}}
                            style={[styles.previewImage, isPreviewLoading && {opacity: 0}]}
                            resizeMode={FastImage.resizeMode.contain}
                            onLoadEnd={() => {
                              previewLoadingTimer.current = setTimeout(() => setIsPreviewLoading(false), 500);
                            }}
                          />
                        </>
                      ) : (
                        <View style={styles.previewCover} />
                      )}
                    </View>
                    {/* Hidden preloader — loads thumbnail to trigger previewReady */}
                    {!previewReady && selectedItem.thumbnailFullUrl && (
                      <FastImage
                        key={`preload-${selectedItem.id}`}
                        source={{uri: selectedItem.thumbnailFullUrl, priority: FastImage.priority.high, cache: FastImage.cacheControl.immutable}}
                        style={{width: 0, height: 0, position: 'absolute'}}
                        onLoadEnd={() => setPreviewReady(true)}
                      />
                    )}
                    {/* Tap to zoom hint */}
                    <View style={styles.previewZoomHint}>
                      <Ionicons name="expand-outline" size={10} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.previewZoomHintText}>Tap to zoom</Text>
                    </View>
                    {/* Photo info */}
                    <View style={styles.previewInfoBadge}>
                      <Text style={styles.previewInfoText}>
                        {formatFileSize(selectedItem.fileSizeBytes)}
                      </Text>
                    </View>
                    <View
                      style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}>
                      <Ionicons name="expand" size={16} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  <View style={styles.previewActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, {backgroundColor: colors.primary + '15'}]}
                      onPress={() => handleSave(selectedItem.fullUrl)}
                      activeOpacity={0.7}>
                      <View style={[styles.actionIconContainer, {backgroundColor: colors.primary}]}>
                        <Ionicons name="download-outline" size={18} color="#fff" />
                      </View>
                      <Text style={[styles.actionLabel, {color: colors.textPrimary}]}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, {backgroundColor: colors.secondary + '15'}]}
                      onPress={() => handleShare(selectedItem)}
                      activeOpacity={0.7}>
                      <View style={[styles.actionIconContainer, {backgroundColor: colors.secondary || '#8B5CF6'}]}>
                        <Ionicons name="share-social-outline" size={18} color="#fff" />
                      </View>
                      <Text style={[styles.actionLabel, {color: colors.textPrimary}]}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, {backgroundColor: colors.error + '15'}]}
                      onPress={() => handleDelete(selectedItem.id)}
                      activeOpacity={0.7}>
                      <View style={[styles.actionIconContainer, {backgroundColor: colors.error}]}>
                        <Ionicons name="trash-outline" size={18} color="#fff" />
                      </View>
                      <Text style={[styles.actionLabel, {color: colors.textPrimary}]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Grid */}
              <FlatList
                data={photos}
                renderItem={renderHistoryItem}
                keyExtractor={item => item.id}
                numColumns={3}
                contentContainerStyle={styles.gridContent}
                columnWrapperStyle={styles.gridRow}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                  />
                }
              />

              {/* Clear All Button */}
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
          )}
        </View>
      </View>

      {/* Delete Confirmation Dialog */}
      <CustomDialog
        visible={deleteDialogVisible}
        icon="trash-outline"
        iconColor={colors.error}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
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

      {/* Clear All Confirmation Dialog */}
      <CustomDialog
        visible={clearAllDialogVisible}
        icon="warning-outline"
        iconColor={colors.error}
        title="Clear All History"
        message="Are you sure you want to delete all your photos? This action cannot be undone."
        buttons={[
          {
            text: isDeleting ? 'Deleting...' : 'Clear All',
            onPress: confirmClearAll,
            style: 'cancel',
          },
          {
            text: 'Cancel',
            onPress: cancelClearAll,
            style: 'default',
          },
        ]}
        onClose={cancelClearAll}
      />

      {/* Full Screen Image Modal */}
      <FullScreenImageModal
        visible={!!fullScreenImage}
        imageUri={fullScreenImage}
        onClose={() => setFullScreenImage(null)}
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

      {/* Full-screen loading overlay */}
      {isPreviewLoading && (
        <View style={styles.fullScreenLoader}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
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
  previewContainer: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImageContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  previewImageZoomContainer: {
    width: '100%',
    height: 200,
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  previewCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1,
  },
  fullScreenLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 9999,
    elevation: 9999,
  },
  previewZoomHint: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  previewZoomHintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
  },
  previewInfoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewInfoText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  fullScreenBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
  },
  actionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
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
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HistoryGallery;
