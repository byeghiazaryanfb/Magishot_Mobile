import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  PanResponder,
  Platform,
  PermissionsAndroid,
  Dimensions,
  StatusBar,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import Share from 'react-native-share';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {UserPhoto, deleteUserPhoto, markPhotoOpened} from '../services/userPhotosApi';
import {fetchUnreadCounts, markPhotoViewed} from '../store/slices/appSlice';
import CustomDialog from '../components/CustomDialog';
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

  // Zoom state
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const lastTap = useRef(0);
  const initialPinchDistance = useRef(0);
  const pinchScaleStart = useRef(1);

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

  const resetZoom = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {toValue: 1, useNativeDriver: true}),
      Animated.spring(translateX, {toValue: 0, useNativeDriver: true}),
      Animated.spring(translateY, {toValue: 0, useNativeDriver: true}),
    ]).start();
    lastScale.current = 1;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
    initialPinchDistance.current = 0;
    pinchScaleStart.current = 1;
  }, [scale, translateX, translateY]);

  const resetZoomRef = useRef(resetZoom);
  resetZoomRef.current = resetZoom;

  useEffect(() => {
    resetZoom();
    setShowBefore(false);
  }, [currentIndex, resetZoom]);

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
        resetZoomRef.current();
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
        resetZoomRef.current();
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

  // Helper: distance between two touch points
  const getTouchDistance = (touches: any[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // ─── Unified PanResponder: handles zoom (pinch + double-tap + pan) and swipe navigation ───
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Double-tap detection
        const now = Date.now();
        if (now - lastTap.current < 300) {
          if (lastScale.current > 1) {
            resetZoomRef.current();
          } else {
            Animated.spring(scale, {toValue: 2.5, useNativeDriver: true}).start();
            lastScale.current = 2.5;
          }
        }
        lastTap.current = now;
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          const currentDistance = getTouchDistance(touches);
          if (initialPinchDistance.current === 0) {
            // Pinch just started — record baseline
            initialPinchDistance.current = currentDistance;
            pinchScaleStart.current = lastScale.current;
          } else {
            // Scale proportionally to finger spread
            const ratio = currentDistance / initialPinchDistance.current;
            const newScale = Math.max(1, Math.min(pinchScaleStart.current * ratio, 5));
            scale.setValue(newScale);
            lastScale.current = newScale;
          }
        } else {
          // Reset pinch baseline when not 2 fingers
          initialPinchDistance.current = 0;

          if (lastScale.current > 1) {
            // Pan when zoomed in
            const newX = lastTranslateX.current + gestureState.dx;
            const newY = lastTranslateY.current + gestureState.dy;
            translateX.setValue(newX);
            translateY.setValue(newY);
          } else {
            // Swipe navigation when not zoomed
            const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            if (isVertical && Math.abs(gestureState.dy) > 10) {
              swipeTranslateY.setValue(gestureState.dy * 0.5);
            }
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Reset pinch tracking
        initialPinchDistance.current = 0;

        // Persist translate values for next gesture
        lastTranslateX.current += gestureState.dx * (lastScale.current > 1 ? 1 : 0);
        lastTranslateY.current += gestureState.dy * (lastScale.current > 1 ? 1 : 0);

        if (lastScale.current <= 1) {
          // Snap back zoom if under-zoomed
          resetZoomRef.current();

          // Handle swipe navigation
          if (gestureState.dy < -SWIPE_THRESHOLD) {
            goToNextRef.current();
          } else if (gestureState.dy > SWIPE_THRESHOLD) {
            goToPrevRef.current();
          } else {
            Animated.spring(swipeTranslateY, {toValue: 0, useNativeDriver: true}).start();
          }
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
        <Animated.View
          style={[
            styles.zoomContainer,
            {
              transform: [
                {scale: scale},
                {translateX: translateX},
                {translateY: translateY},
              ],
            },
          ]}>
          <Image
            source={{uri: currentPhoto.fullUrl}}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </Animated.View>
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
        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetZoom}
          activeOpacity={0.7}>
          <Ionicons name="contract-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Swipe hints */}
      {currentIndex > 0 && (
        <View style={styles.swipeHintTop}>
          <Ionicons name="chevron-up" size={22} color="rgba(255,255,255,0.5)" />
        </View>
      )}
      {currentIndex < photos.length - 1 && (
        <View style={styles.swipeHintBottom}>
          <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.5)" />
        </View>
      )}

      {/* Zoom hint */}
      <View style={styles.zoomHint}>
        <Ionicons name="search-outline" size={12} color="rgba(255,255,255,0.5)" />
        <Text style={styles.zoomHintText}>Pinch or double-tap to zoom</Text>
      </View>

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
  // Full-screen image area
  fullScreenArea: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  // Overlaid header
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
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Swipe hints
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
  // Zoom hint
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
  // Overlaid actions
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
  // Before/after comparison
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
