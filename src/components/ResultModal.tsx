import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableWithoutFeedback,
} from 'react-native';
import Share from 'react-native-share';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {
  hideResultModal,
  setSourceImage,
} from '../store/slices/transformSlice';
import {addToHistory} from '../store/slices/historySlice';
import {useTheme} from '../theme/ThemeContext';
import {GeneratedImage} from '../services/imageTransform';
import ZoomableImage from './ZoomableImage';


const {width: SCREEN_WIDTH} = Dimensions.get('window');

const ResultModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const {colors} = useTheme();
  const showModal = useAppSelector(state => state.transform.showResultModal);
  const transformedImageUrl = useAppSelector(
    state => state.transform.transformedImageUrl,
  );
  const synthesizedImages = useAppSelector(state => state.transform.synthesizedImages);
  const selectedSight = useAppSelector(state => state.transform.selectedSight);
  const sourceImage = useAppSelector(state => state.transform.sourceImage);
  const isTransforming = useAppSelector(state => state.transform.isTransforming);
  const selectedAccessories = useAppSelector(state => state.transform.selectedAccessories);
  const styleMode = useAppSelector(state => state.transform.styleMode);
  const accessToken = useAppSelector(state => state.auth.accessToken);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track if we've already saved this transformation to history
  const savedToHistoryRef = useRef<string | null>(null);

  // Image carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  // Press-and-hold comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH);

  // Dialog state
  const [dialog, setDialog] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }>({visible: false, type: 'error', title: '', message: ''});

  const showDialog = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    setDialog({visible: true, type, title, message});
  };

  const hideDialog = () => {
    setDialog(prev => ({...prev, visible: false}));
  };

  // Reset carousel when modal opens with new images
  useEffect(() => {
    if (showModal && (transformedImageUrl || synthesizedImages.length > 0)) {
      setShowComparison(false);
      setCurrentImageIndex(0);
      carouselRef.current?.scrollTo({x: 0, animated: false});
    }
  }, [showModal, transformedImageUrl, synthesizedImages]);

  // Get the currently displayed image URL
  const currentImageUrl = synthesizedImages.length > 0
    ? synthesizedImages[currentImageIndex]?.imageUrl
    : transformedImageUrl;

  // Handle carousel scroll
  const handleCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / containerWidth);
    if (index !== currentImageIndex && index >= 0 && index < synthesizedImages.length) {
      setCurrentImageIndex(index);
    }
  };

  // Auto-save to history when transformation completes
  useEffect(() => {
    if (!sourceImage || isTransforming) return;

    // For synthesized images (multiple results)
    if (synthesizedImages.length > 0) {
      const savedKey = synthesizedImages.map(img => img.imageUrl).join(',');
      if (savedToHistoryRef.current === savedKey) return;
      savedToHistoryRef.current = savedKey;

      // Save each synthesized image as a separate history item
      synthesizedImages.forEach((img, index) => {
        dispatch(
          addToHistory({
            sourceImage: sourceImage.uri,
            transformedImage: img.imageUrl,
            sightName: selectedSight?.name ? `${selectedSight.name} (${index + 1}/${synthesizedImages.length})` : null,
            sightId: selectedSight?.id || null,
            accessories: selectedAccessories.map(a => a.label),
            prompt: selectedSight?.prompt || '',
          })
        );
      });
    } else if (transformedImageUrl && savedToHistoryRef.current !== transformedImageUrl) {
      // Single image result
      savedToHistoryRef.current = transformedImageUrl;

      dispatch(
        addToHistory({
          sourceImage: sourceImage.uri,
          transformedImage: transformedImageUrl,
          sightName: selectedSight?.name || null,
          sightId: selectedSight?.id || null,
          accessories: selectedAccessories.map(a => a.label),
          prompt: selectedSight?.prompt || '',
        })
      );
    }
  }, [transformedImageUrl, synthesizedImages, sourceImage, isTransforming, selectedSight, selectedAccessories, dispatch]);

  // Reset saved ref when modal closes
  // Only hide modal and clear result, keep source image for next generation
  const handleClose = () => {
    savedToHistoryRef.current = null;
    dispatch(hideResultModal());
  };

  const requestAndroidPermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;

    if (Platform.Version >= 33) {
      return true;
    }

    const hasPermission = await PermissionsAndroid.check(permission);
    if (hasPermission) {
      return true;
    }

    const status = await PermissionsAndroid.request(permission);
    return status === 'granted';
  };

  const handleSave = useCallback(async () => {
    if (!currentImageUrl) {
      showDialog('error', 'Error', 'No image to save');
      return;
    }

    try {
      const hasPermission = await requestAndroidPermission();
      if (!hasPermission) {
        showDialog('warning', 'Permission Denied', 'Cannot save without permission');
        return;
      }

      const fileName = `transformed_${Date.now()}.png`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: currentImageUrl,
        toFile: filePath,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error('Failed to download image');
      }

      await CameraRoll.saveAsset(`file://${filePath}`, {type: 'photo'});
      await RNFS.unlink(filePath);

      showDialog('success', 'Saved!', 'Photo saved to your gallery');
    } catch (error) {
      console.error('Save error:', error);
      showDialog('error', 'Error', 'Failed to save photo');
    }
  }, [currentImageUrl]);

  const handleShare = useCallback(async () => {
    if (!currentImageUrl) {
      showDialog('error', 'Error', 'No image to share');
      return;
    }

    try {
      const fileName = `transformed_${Date.now()}.png`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: currentImageUrl,
        toFile: filePath,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error('Failed to download image');
      }

      await Share.open({
        url: `file://${filePath}`,
        type: 'image/png',
      });

      await RNFS.unlink(filePath).catch(() => {});
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Share error:', error);
        showDialog('error', 'Error', 'Failed to share photo');
      }
    }
  }, [currentImageUrl, selectedSight]);

  // All modes now use async fire-and-forget; refresh from ResultModal is not applicable
  const handleRefresh = useCallback(async () => {
    return;
  }, []);

  if (!showModal || (!currentImageUrl && !isTransforming)) {
    return null;
  }

  const hasMultipleImages = synthesizedImages.length > 1;

  return (
    <Modal
      visible={showModal}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <View style={[styles.overlay, {backgroundColor: colors.overlay}]}>
        <View
          style={[
            styles.modalContainer,
            {backgroundColor: colors.backgroundSecondary},
          ]}>
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <View style={styles.headerContent}>
              <Text style={[styles.title, {color: colors.textPrimary}]}>
                Your Masterpiece
              </Text>
              <Text style={[styles.subtitle, {color: colors.textTertiary}]}>
                {selectedSight?.name || (selectedAccessories.length > 0 ? `${selectedAccessories.length} accessory(ies) applied` : 'Your Transformation')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={[
                styles.closeButton,
                {backgroundColor: colors.backgroundTertiary},
              ]}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={[styles.closeButtonText, {color: colors.textSecondary}]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[styles.imageContainer, {backgroundColor: colors.background}]}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
            {isTransforming ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, {color: colors.textPrimary}]}>
                  Regenerating...
                </Text>
                <Text style={[styles.loadingSubtext, {color: colors.textTertiary}]}>
                  Creating a new version
                </Text>
              </View>
            ) : hasMultipleImages ? (
              // Carousel for multiple synthesized images
              <View style={styles.carouselWrapper}>
                <ScrollView
                  ref={carouselRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleCarouselScroll}
                  style={styles.carousel}>
                  {synthesizedImages.map((img, index) => (
                    <View key={img.fileName} style={{width: containerWidth}}>
                      <ZoomableImage
                        source={{uri: img.imageUrl}}
                        style={styles.image}
                        resizeMode="contain"
                      />
                    </View>
                  ))}
                </ScrollView>
                {/* Pagination dots */}
                <View style={styles.paginationContainer}>
                  {synthesizedImages.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        {
                          backgroundColor: index === currentImageIndex
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                {/* Image counter */}
                <View style={[styles.imageCounter, {backgroundColor: 'rgba(0,0,0,0.6)'}]}>
                  <Text style={styles.imageCounterText}>
                    {currentImageIndex + 1} / {synthesizedImages.length}
                  </Text>
                </View>
                {/* Zoom hint */}
                <View style={[styles.zoomHint, {backgroundColor: 'rgba(0,0,0,0.5)'}]}>
                  <Text style={styles.zoomHintText}>Pinch to zoom</Text>
                </View>
              </View>
            ) : (
              <View style={styles.singleImageWrapper}>
                <ZoomableImage
                  source={{uri: currentImageUrl!}}
                  style={styles.image}
                  resizeMode="contain"
                />
                {/* Zoom hint */}
                <View style={[styles.zoomHint, {backgroundColor: 'rgba(0,0,0,0.5)'}]}>
                  <Text style={styles.zoomHintText}>Pinch to zoom</Text>
                </View>
              </View>
            )}
            {/* Before image overlay - shown when holding compare button (not for synthesize) */}
            {showComparison && sourceImage?.uri && !hasMultipleImages && (
              <View style={styles.beforeImageOverlay}>
                <Image
                  source={{uri: sourceImage.uri}}
                  style={styles.beforeImage}
                  resizeMode="contain"
                />
                <View style={[styles.beforeLabel, {backgroundColor: 'rgba(0,0,0,0.7)'}]}>
                  <Text style={styles.beforeLabelText}>BEFORE</Text>
                </View>
              </View>
            )}
            {/* Compare button - press and hold to see before (not for synthesize) */}
            {!isTransforming && sourceImage?.uri && currentImageUrl && !hasMultipleImages && (
              <TouchableOpacity
                style={[styles.compareBtn, {backgroundColor: showComparison ? colors.primary : 'rgba(0,0,0,0.6)'}]}
                onPressIn={() => setShowComparison(true)}
                onPressOut={() => setShowComparison(false)}
                activeOpacity={0.8}>
                <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                {backgroundColor: colors.warning},
                (isTransforming || isRefreshing) && styles.buttonDisabled,
              ]}
              onPress={handleRefresh}
              activeOpacity={0.8}
              disabled={isTransforming || isRefreshing}>
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="refresh-outline" size={20} color="#fff" />
              )}
              <Text style={styles.buttonText}>{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                {backgroundColor: colors.success},
                isTransforming && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={isTransforming}>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                {backgroundColor: colors.primary},
                isTransforming && styles.buttonDisabled,
              ]}
              onPress={handleShare}
              activeOpacity={0.8}
              disabled={isTransforming}>
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Custom Dialog Overlay */}
          {dialog.visible && (
            <TouchableWithoutFeedback onPress={hideDialog}>
              <View style={styles.dialogOverlay}>
                <TouchableWithoutFeedback>
                  <View style={[styles.dialogContainer, {backgroundColor: colors.cardBackground}]}>
                    <View style={[
                      styles.dialogIconOuter,
                      {backgroundColor: dialog.type === 'success' ? '#10B98120' : dialog.type === 'warning' ? '#F5920020' : '#FF475720'}
                    ]}>
                      <View style={[
                        styles.dialogIconInner,
                        {backgroundColor: dialog.type === 'success' ? '#10B981' : dialog.type === 'warning' ? '#F59200' : '#FF4757'}
                      ]}>
                        <Ionicons
                          name={dialog.type === 'success' ? 'checkmark' : dialog.type === 'warning' ? 'warning' : 'alert-circle'}
                          size={28}
                          color="#fff"
                        />
                      </View>
                    </View>
                    <Text style={[styles.dialogTitle, {color: colors.textPrimary}]}>
                      {dialog.title}
                    </Text>
                    <Text style={[styles.dialogMessage, {color: colors.textSecondary}]}>
                      {dialog.message}
                    </Text>
                    <TouchableOpacity
                      style={[styles.dialogButton, {backgroundColor: colors.primary}]}
                      onPress={hideDialog}
                      activeOpacity={0.8}>
                      <Text style={styles.dialogButtonText}>
                        {dialog.type === 'success' ? 'Done' : 'Got it'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
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
  imageContainer: {
    aspectRatio: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Press-and-hold comparison styles
  beforeImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  beforeImage: {
    width: '100%',
    height: '100%',
  },
  beforeLabel: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
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
    bottom: 10,
    right: 50,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Carousel styles
  carouselWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  carousel: {
    width: '100%',
    height: '100%',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  singleImageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  zoomHintText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  dialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dialogContainer: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  dialogIconOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  dialogIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  dialogButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  dialogButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ResultModal;
