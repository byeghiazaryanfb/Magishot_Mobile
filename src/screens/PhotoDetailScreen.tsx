import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  StatusBar,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import Share from 'react-native-share';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ImageZoom} from '@likashefqet/react-native-image-zoom';
import {useTheme} from '../theme/ThemeContext';
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {UserPhoto, deleteUserPhoto, markPhotoOpened} from '../services/userPhotosApi';
import {fetchUnreadCounts, markPhotoViewed} from '../store/slices/appSlice';
import CustomDialog from '../components/CustomDialog';
import {requestPhotoLibraryPermission} from '../utils/permissions';
import type {RootStackParamList} from '../navigation/RootNavigator';

type PhotoDetailRouteProp = RouteProp<RootStackParamList, 'PhotoDetail'>;

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

const PhotoDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PhotoDetailRouteProp>();
  const {colors} = useTheme();
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(state => state.auth.accessToken);

  const [photos, setPhotos] = useState<UserPhoto[]>(route.params.photos);
  const [currentIndex, setCurrentIndex] = useState(route.params.currentIndex);
  const currentPhoto = photos[currentIndex];
  const [showBefore, setShowBefore] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const hasOriginal = !!currentPhoto?.originalImageFullUrl;

  // Mark photo as viewed when it becomes the current photo (on mount + swipe)
  const viewedInSession = useRef<Set<string>>(new Set());

  useEffect(() => {
    const photo = photos[currentIndex];
    if (photo && !photo.hasBeenViewed && !viewedInSession.current.has(photo.id) && accessToken) {
      viewedInSession.current.add(photo.id);
      dispatch(markPhotoViewed(photo.id));
      markPhotoOpened(accessToken, photo.id);
      dispatch(fetchUnreadCounts());
    }
  }, [currentIndex, photos, accessToken, dispatch]);

  // Delete dialog
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Message dialog
  const [messageDialog, setMessageDialog] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }>({visible: false, type: 'error', title: '', message: ''});

  // Swipe navigation state
  const swipeTranslateY = useRef(new Animated.Value(0)).current;
  const swipeOpacity = useRef(new Animated.Value(1)).current;
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const isSwipeAnimatingRef = useRef(false);
  isSwipeAnimatingRef.current = isSwipeAnimating;
  const isZoomedRef = useRef(false);
  isZoomedRef.current = isZoomed;

  // Reset zoom state when switching photos
  useEffect(() => {
    setIsZoomed(false);
    setShowBefore(false);
  }, [currentIndex]);

  // ─── Swipe navigation ───
  const goToNextPhoto = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx < photosRef.current.length - 1 && !isSwipeAnimatingRef.current) {
      isSwipeAnimatingRef.current = true;
      setIsSwipeAnimating(true);
      Animated.parallel([
        Animated.timing(swipeTranslateY, {toValue: -SCREEN_HEIGHT, duration: 200, useNativeDriver: true}),
        Animated.timing(swipeOpacity, {toValue: 0, duration: 200, useNativeDriver: true}),
      ]).start(() => {
        setCurrentIndex(idx + 1);
        swipeTranslateY.setValue(SCREEN_HEIGHT);
        Animated.parallel([
          Animated.timing(swipeTranslateY, {toValue: 0, duration: 200, useNativeDriver: true}),
          Animated.timing(swipeOpacity, {toValue: 1, duration: 200, useNativeDriver: true}),
        ]).start(() => {
          isSwipeAnimatingRef.current = false;
          setIsSwipeAnimating(false);
        });
      });
    } else {
      Animated.spring(swipeTranslateY, {toValue: 0, useNativeDriver: true}).start();
    }
  }, [swipeTranslateY, swipeOpacity]);

  const goToPrevPhoto = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx > 0 && !isSwipeAnimatingRef.current) {
      isSwipeAnimatingRef.current = true;
      setIsSwipeAnimating(true);
      Animated.parallel([
        Animated.timing(swipeTranslateY, {toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true}),
        Animated.timing(swipeOpacity, {toValue: 0, duration: 200, useNativeDriver: true}),
      ]).start(() => {
        setCurrentIndex(idx - 1);
        swipeTranslateY.setValue(-SCREEN_HEIGHT);
        Animated.parallel([
          Animated.timing(swipeTranslateY, {toValue: 0, duration: 200, useNativeDriver: true}),
          Animated.timing(swipeOpacity, {toValue: 1, duration: 200, useNativeDriver: true}),
        ]).start(() => {
          isSwipeAnimatingRef.current = false;
          setIsSwipeAnimating(false);
        });
      });
    } else {
      Animated.spring(swipeTranslateY, {toValue: 0, useNativeDriver: true}).start();
    }
  }, [swipeTranslateY, swipeOpacity]);

  const goToNextRef = useRef(goToNextPhoto);
  const goToPrevRef = useRef(goToPrevPhoto);
  goToNextRef.current = goToNextPhoto;
  goToPrevRef.current = goToPrevPhoto;

  // PanResponder for swipe navigation only (when not zoomed)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture vertical swipes when not zoomed
        if (isZoomedRef.current) return false;
        return Math.abs(gestureState.dy) > 15 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isZoomedRef.current) {
          swipeTranslateY.setValue(gestureState.dy * 0.5);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -SWIPE_THRESHOLD) {
          goToNextRef.current();
        } else if (gestureState.dy > SWIPE_THRESHOLD) {
          goToPrevRef.current();
        } else {
          Animated.spring(swipeTranslateY, {toValue: 0, useNativeDriver: true}).start();
        }
      },
    }),
  ).current;

  // ─── Actions ───
  const showMessage = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    setMessageDialog({visible: true, type, title, message});
  };

  const hideMessage = () => {
    setMessageDialog(prev => ({...prev, visible: false}));
  };

  const handleSave = async (imageUrl: string) => {
    try {
      const hasPermission = await requestPhotoLibraryPermission();
      if (!hasPermission) {
        showMessage('warning', 'Permission Denied', 'Cannot save without permission');
        return;
      }
      const isLocalFile = imageUrl.startsWith('file://') || imageUrl.startsWith('/');
      if (isLocalFile) {
        const localPath = imageUrl.startsWith('file://') ? imageUrl : `file://${imageUrl}`;
        await CameraRoll.saveAsset(localPath, {type: 'photo'});
      } else {
        const fileName = `transformed_${Date.now()}.png`;
        const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
        const downloadResult = await RNFS.downloadFile({fromUrl: imageUrl, toFile: filePath}).promise;
        if (downloadResult.statusCode !== 200) throw new Error('Failed to download image');
        await CameraRoll.saveAsset(`file://${filePath}`, {type: 'photo'});
        await RNFS.unlink(filePath);
      }
      showMessage('success', 'Saved!', 'Photo saved to your gallery');
    } catch {
      showMessage('error', 'Error', 'Failed to save photo');
    }
  };

  const handleShare = async () => {
    const item = photos[currentIndex];
    if (!item) return;

    try {
      const fileName = `transformed_${Date.now()}.png`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const downloadResult = await RNFS.downloadFile({fromUrl: item.fullUrl, toFile: filePath}).promise;
      if (downloadResult.statusCode !== 200) throw new Error('Failed to download image');

      await Share.open({
        url: `file://${filePath}`,
        type: item.mimeType || 'image/png',
      });

      await RNFS.unlink(filePath).catch(() => {});
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        showMessage('error', 'Error', 'Failed to share photo');
      }
    }
  };

  const handleDelete = () => {
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!currentPhoto || !accessToken) return;
    setIsDeleting(true);
    try {
      await deleteUserPhoto(accessToken, currentPhoto.id);
      const newPhotos = photos.filter(p => p.id !== currentPhoto.id);
      if (newPhotos.length === 0) {
        navigation.goBack();
        return;
      }
      const newIndex = currentIndex >= newPhotos.length ? newPhotos.length - 1 : currentIndex;
      setPhotos(newPhotos);
      setCurrentIndex(newIndex);
      showMessage('success', 'Deleted', 'Photo deleted successfully');
    } catch {
      showMessage('error', 'Error', 'Failed to delete photo');
    } finally {
      setIsDeleting(false);
      setDeleteDialogVisible(false);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogVisible(false);
  };

  if (!currentPhoto) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />

      {/* Full-screen zoomable image with swipe */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.fullScreenArea,
          {
            transform: [{translateY: swipeTranslateY}],
            opacity: swipeOpacity,
          },
        ]}>
        <GestureHandlerRootView style={styles.gestureRoot}>
          <ImageZoom
            key={currentPhoto.id}
            uri={currentPhoto.fullUrl}
            minScale={1}
            maxScale={5}
            doubleTapScale={2.5}
            minPanPointers={1}
            maxPanPointers={2}
            isPanEnabled={true}
            isPinchEnabled={true}
            isDoubleTapEnabled={true}
            onInteractionStart={() => setIsZoomed(true)}
            onPinchEnd={(event) => {
              if (event.scale <= 1.05) {
                setIsZoomed(false);
              }
            }}
            onDoubleTap={(event) => {
              setIsZoomed(event.type !== 'zoomOut');
            }}
            style={styles.imageZoom}
            resizeMode="contain"
          />
        </GestureHandlerRootView>
      </Animated.View>

      {/* Before image overlay (shown while holding compare button) */}
      {showBefore && hasOriginal && (
        <View style={styles.beforeOverlay}>
          <Image
            source={{uri: currentPhoto.originalImageFullUrl!}}
            style={styles.fullImage}
            resizeMode="contain"
          />
          <View style={styles.beforeLabel}>
            <Text style={styles.beforeLabelText}>BEFORE</Text>
          </View>
        </View>
      )}

      {/* Compare button - press and hold to see before */}
      {hasOriginal && (
        <TouchableOpacity
          style={[styles.compareBtn, showBefore && {backgroundColor: '#FF1B6D'}]}
          onPressIn={() => setShowBefore(true)}
          onPressOut={() => setShowBefore(false)}
          activeOpacity={0.8}>
          <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Overlaid header */}
      <View style={styles.headerOverlay}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {photos.length}
          </Text>
        </View>
        <View style={{width: 40}} />
      </View>

      {/* Swipe hints */}
      {!isZoomed && currentIndex > 0 && (
        <View style={styles.swipeHintTop}>
          <Ionicons name="chevron-up" size={22} color="rgba(255,255,255,0.5)" />
        </View>
      )}
      {!isZoomed && currentIndex < photos.length - 1 && (
        <View style={styles.swipeHintBottom}>
          <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.5)" />
        </View>
      )}

      {/* Zoom hint */}
      {!isZoomed && (
        <View style={styles.zoomHint}>
          <Ionicons name="search-outline" size={12} color="rgba(255,255,255,0.5)" />
          <Text style={styles.zoomHintText}>Pinch or double-tap to zoom</Text>
        </View>
      )}

      {/* Overlaid action buttons */}
      <View style={styles.actionsOverlay}>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: colors.primary + '30'}]}
          onPress={() => handleSave(currentPhoto.fullUrl)}
          activeOpacity={0.7}>
          <View style={[styles.actionIconContainer, {backgroundColor: colors.primary}]}>
            <Ionicons name="download-outline" size={18} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: (colors.secondary || '#8B5CF6') + '30'}]}
          onPress={handleShare}
          activeOpacity={0.7}>
          <View style={[styles.actionIconContainer, {backgroundColor: colors.secondary || '#8B5CF6'}]}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: colors.error + '30'}]}
          onPress={handleDelete}
          activeOpacity={0.7}>
          <View style={[styles.actionIconContainer, {backgroundColor: colors.error}]}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Delete dialog */}
      <CustomDialog
        visible={deleteDialogVisible}
        icon="trash-outline"
        iconColor={colors.error}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        buttons={[
          {text: isDeleting ? 'Deleting...' : 'Delete', onPress: confirmDelete, style: 'cancel'},
          {text: 'Cancel', onPress: cancelDelete, style: 'default'},
        ]}
        onClose={cancelDelete}
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

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullScreenArea: {
    ...StyleSheet.absoluteFillObject,
  },
  gestureRoot: {
    flex: 1,
  },
  imageZoom: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  swipeHintTop: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  swipeHintBottom: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  zoomHint: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 5,
  },
  zoomHintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  actionsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    zIndex: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
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
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  beforeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 5,
  },
  beforeLabel: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  beforeLabelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  compareBtn: {
    position: 'absolute',
    bottom: '27%',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

export default PhotoDetailScreen;
