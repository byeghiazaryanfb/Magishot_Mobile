import React, {useState, useRef, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Share from 'react-native-share';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {useNavigation} from '@react-navigation/native';
import {launchCamera, launchImageLibrary, Asset} from 'react-native-image-picker';
import {CopilotStep, walkthroughable} from 'react-native-copilot';

// Create walkthroughable components
const WalkthroughableView = walkthroughable(View);
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {fetchCoinBalance} from '../store/slices/authSlice';
import {
  setSourceImage,
  clearTransformState,
  setStyleMode,
  SelectedAccessory,
} from '../store/slices/transformSlice';
import {useTheme} from '../theme/ThemeContext';
import {ImageAsset} from '../services/imageTransform';
import AccessoriesBar from './AccessoriesBar';
import ActionsBar, {SynthesizeAction} from './ActionsBar';
import CharacterPickerModal from './CharacterPickerModal';
import PhotoPickerModal from './PhotoPickerModal';
import FullScreenImageModal from './FullScreenImageModal';
import CustomDialog from './CustomDialog';
import {CharacterItem, getFullCharacterImageUrl} from '../services/charactersApi';
import {config} from '../utils/config';
import {useServicePrices} from '../hooks/useServicePrices';
import {addPendingJob} from '../store/slices/videoNotificationSlice';
import {addPendingImageJob, addPendingSynthesizeJobs} from '../store/slices/imageNotificationSlice';
import {SvgXml} from 'react-native-svg';
import MaskDrawingCanvas, {MaskDrawingCanvasRef} from './MaskDrawingCanvas';
import AnimateResultModal from './AnimateResultModal';

interface RemovalShortcut {
  id: string;
  name: string;
  thumbnailUrl?: string;
  icon?: string;
  prompt?: string;
}

const EXTEND_ASPECT_RATIOS = [
  {id: '9:16', label: 'Reels', icon: 'phone-portrait-outline'},
  {id: '16:9', label: 'YouTube', icon: 'phone-landscape-outline'},
  {id: '1:1', label: 'Square', icon: 'square-outline'},
  {id: '4:5', label: 'Post', icon: 'tablet-portrait-outline'},
];

const ANIMATE_ASPECT_RATIOS = [
  {id: '16:9', label: 'Landscape', icon: 'phone-landscape-outline'},
  {id: '9:16', label: 'Portrait', icon: 'phone-portrait-outline'},
  {id: '1:1', label: 'Square', icon: 'square-outline'},
];

const CameraArea: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const {colors, isDark} = useTheme();
  const {width} = useWindowDimensions();
  const selectedSight = useAppSelector(state => state.transform.selectedSight);
  const sourceImage = useAppSelector(state => state.transform.sourceImage);
  const isTransforming = useAppSelector(state => state.transform.isTransforming);
  const error = useAppSelector(state => state.transform.error);
  const selectedAccessories = useAppSelector(state => state.transform.selectedAccessories);
  const styleMode = useAppSelector(state => state.transform.styleMode);
  const accessToken = useAppSelector(state => state.auth.accessToken);
  const {openEyesPrice, extendPrice, restorePrice, animationPrice, refinePrice} = useServicePrices();

  // Calculate accumulated coin cost from selected template + accessories (Effects mode)
  const totalCoins = (() => {
    let coins = 0;
    if (selectedSight?.estimatedCoins && !selectedSight?.isFree) {
      coins += selectedSight.estimatedCoins;
    }
    for (const acc of selectedAccessories) {
      if (acc.estimatedCoins && !acc.isFree) {
        coins += acc.estimatedCoins;
      }
    }
    return coins;
  })();

  // Separate photo state for each mode to prevent interference
  const [effectsPhoto, setEffectsPhoto] = useState<ImageAsset | null>(null);
  const [synthesizePhoto2, setSynthesizePhoto2] = useState<ImageAsset | null>(null);

  // Reference photos for "Look Like This" feature (Photo 1 in Synthesize mode)
  const [referencePhotos, setReferencePhotos] = useState<ImageAsset[]>([]);
  const [wizardStep, setWizardStep] = useState(1); // 1: Choose photos, 2: Choose action & generate
  const [selectedSynthesizeAction, setSelectedSynthesizeAction] = useState<SynthesizeAction | null>(null);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoPickerSlot, setPhotoPickerSlot] = useState<1 | 2 | 'effects'>(1);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [showSelectTemplateModal, setShowSelectTemplateModal] = useState(false);
  const [showSynthesizeModal, setShowSynthesizeModal] = useState(false);
  const [synthesizeModalMessage, setSynthesizeModalMessage] = useState('');
  const [isOpenEyesLoading, setIsOpenEyesLoading] = useState(false);
  const [openEyesPhoto, setOpenEyesPhoto] = useState<ImageAsset | null>(null);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [restorePhoto, setRestorePhoto] = useState<ImageAsset | null>(null);
  const [refinePhoto, setRefinePhoto] = useState<ImageAsset | null>(null);
  const [isRefineLoading, setIsRefineLoading] = useState(false);
  const [isCleanBgLoading, setIsCleanBgLoading] = useState(false);
  const [cleanBgPhoto, setCleanBgPhoto] = useState<ImageAsset | null>(null);
  const [showMaskModal, setShowMaskModal] = useState(false);
  const [cleanBgResultUrl, setCleanBgResultUrl] = useState<string | null>(null);
  const [showPhotoSourcePicker, setShowPhotoSourcePicker] = useState(false);
  const maskCanvasRef = useRef<MaskDrawingCanvasRef>(null);
  const [hasMaskDrawn, setHasMaskDrawn] = useState(false);
  const [cleanBgPhotoDimensions, setCleanBgPhotoDimensions] = useState<{w: number; h: number} | null>(null);
  const [brushSize, setBrushSize] = useState(20);

  // Removal shortcuts
  const [removalShortcuts, setRemovalShortcuts] = useState<RemovalShortcut[]>([]);
  const [selectedShortcut, setSelectedShortcut] = useState<RemovalShortcut | null>(null);

  // Extender aspect ratio
  const [extendAspectRatio, setExtendAspectRatio] = useState<string>('9:16');

  // Animate mode state
  const [animatePhoto, setAnimatePhoto] = useState<ImageAsset | null>(null);
  const [isAnimateLoading, setIsAnimateLoading] = useState(false);
  const [isEffectsGenerating, setIsEffectsGenerating] = useState(false);
  const [animateAspectRatio, setAnimateAspectRatio] = useState<string>('16:9');
  const [showAnimateResult, setShowAnimateResult] = useState(false);
  const [animateVideoResult, setAnimateVideoResult] = useState<{
    videoUrl: string;
    fileName: string;
    mimeType: string;
    durationSeconds: number;
  } | null>(null);

  // Animated progress bar for loading state
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    if (isTransforming) {
      progressWidth.value = 0;
      progressWidth.value = withTiming(95, {duration: 15000});
    } else {
      progressWidth.value = withTiming(100, {duration: 200});
    }
  }, [isTransforming, progressWidth]);

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as any,
  }));

  useEffect(() => {
    if (styleMode !== 'cleanBg') { return; }
    setRemovalShortcuts([]);
  }, [styleMode, accessToken]);

  // Brush slider — shared value drives the thumb on the UI thread
  const sliderRatio = useSharedValue((20 - 5) / 55); // initial brush=20
  const sliderTrackWidth = useSharedValue(1);

  const sliderGesture = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({top: 20, bottom: 20})
        .minDistance(0)
        .onStart(e => {
          const ratio = Math.max(0, Math.min(e.x / sliderTrackWidth.value, 1));
          sliderRatio.value = ratio;
          setBrushSize(Math.max(5, Math.min(60, Math.round(5 + ratio * 55))));
        })
        .onUpdate(e => {
          const ratio = Math.max(0, Math.min(e.x / sliderTrackWidth.value, 1));
          sliderRatio.value = ratio;
        })
        .onEnd(() => {
          const newSize = Math.round(5 + sliderRatio.value * 55);
          setBrushSize(Math.max(5, Math.min(60, newSize)));
        })
        .runOnJS(true),
    [],
  );

  const sliderFillStyle = useAnimatedStyle(() => ({
    width: `${sliderRatio.value * 100}%`,
  }));

  const sliderThumbStyle = useAnimatedStyle(() => ({
    left: `${sliderRatio.value * 100}%`,
  }));

  // Pinch-to-zoom shared values for mask modal
  const zoomScale = useSharedValue(1);
  const zoomSavedScale = useSharedValue(1);
  const zoomTranslateX = useSharedValue(0);
  const zoomTranslateY = useSharedValue(0);
  const zoomSavedTranslateX = useSharedValue(0);
  const zoomSavedTranslateY = useSharedValue(0);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          zoomSavedScale.value = zoomScale.value;
        })
        .onUpdate(e => {
          zoomScale.value = Math.min(
            Math.max(zoomSavedScale.value * e.scale, 1),
            5,
          );
        })
        .onEnd(() => {
          if (zoomScale.value < 1.1) {
            zoomScale.value = withTiming(1);
            zoomTranslateX.value = withTiming(0);
            zoomTranslateY.value = withTiming(0);
          }
          zoomSavedScale.value = zoomScale.value;
        }),
    [],
  );

  const twoFingerPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(2)
        .maxPointers(2)
        .onStart(() => {
          zoomSavedTranslateX.value = zoomTranslateX.value;
          zoomSavedTranslateY.value = zoomTranslateY.value;
        })
        .onUpdate(e => {
          zoomTranslateX.value = zoomSavedTranslateX.value + e.translationX;
          zoomTranslateY.value = zoomSavedTranslateY.value + e.translationY;
        }),
    [],
  );

  const zoomComposedGesture = useMemo(
    () => Gesture.Simultaneous(pinchGesture, twoFingerPanGesture),
    [pinchGesture, twoFingerPanGesture],
  );

  const zoomAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: zoomTranslateX.value},
      {translateY: zoomTranslateY.value},
      {scale: zoomScale.value},
    ],
  }));

  const [errorDialog, setErrorDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'error' | 'success';
  }>({visible: false, title: '', message: '', type: 'error'});

  // Calculate canvas dimensions for the full-screen modal
  // (must be declared before early returns to keep hook count stable)
  const getCanvasDimensions = useCallback(() => {
    if (!cleanBgPhotoDimensions) {
      return {canvasW: 0, canvasH: 0};
    }
    const screenHeight = Dimensions.get('window').height;
    const availableWidth = width - 32; // modal padding
    const maxHeight = screenHeight * 0.6;
    const aspect = cleanBgPhotoDimensions.w / cleanBgPhotoDimensions.h;
    let canvasW = availableWidth;
    let canvasH = canvasW / aspect;
    if (canvasH > maxHeight) {
      canvasH = maxHeight;
      canvasW = canvasH * aspect;
    }
    return {canvasW: Math.round(canvasW), canvasH: Math.round(canvasH)};
  }, [cleanBgPhotoDimensions, width]);

  const showError = (title: string, message: string) => {
    setErrorDialog({visible: true, title, message, type: 'error'});
  };

  const showSuccess = (title: string, message: string) => {
    setErrorDialog({visible: true, title, message, type: 'success'});
  };

  const hideErrorDialog = () => {
    setErrorDialog(prev => ({...prev, visible: false}));
  };

  // Responsive sizing for iPad
  const isTablet = width >= 768;
  const isSmallScreen = width < 375;
  const containerPadding = isTablet ? 40 : isSmallScreen ? 12 : 16;
  const iconOuterSize = isTablet ? 160 : 120;
  const iconInnerSize = isTablet ? 120 : 90;
  const iconFontSize = isTablet ? 56 : 40;
  const titleFontSize = isTablet ? 28 : 22;
  const subtitleFontSize = isTablet ? 18 : 15;
  const clearButtonSize = isTablet ? 52 : 40;

  const handleImageSelected = (asset: Asset) => {
    if (!asset.uri) {
      showError('Error', 'Failed to get image');
      return;
    }

    const imageAsset = {
      uri: asset.uri,
      type: asset.type,
      fileName: asset.fileName,
    };

    dispatch(setSourceImage(imageAsset));

    // Get all selected accessory IDs
    const accessoryIds = selectedAccessories.map(a => a.id);

    // Check if template or accessory is selected
    if (selectedSight || accessoryIds.length > 0) {
      console.log('Selected sight ID:', selectedSight?.id);
      console.log('Selected accessory IDs:', accessoryIds);

      // Fire-and-forget async generate
      fireEffectsGenerate(imageAsset);
    } else {
      setShowSelectTemplateModal(true);
    }
  };

  // Check if we can transform (template/accessories only apply to effects mode)
  const canTransform = (styleMode === 'effects' && (selectedSight || selectedAccessories.length > 0)) || (styleMode === 'synthesize' && referencePhotos.length > 0) || (styleMode !== 'effects' && styleMode !== 'synthesize');

  // Get the current photo for the active mode
  const currentModePhoto = styleMode === 'synthesize' ? synthesizePhoto2 : styleMode === 'restore' ? restorePhoto : styleMode === 'refine' ? refinePhoto : styleMode === 'openeyes' ? openEyesPhoto : styleMode === 'cleanBg' ? cleanBgPhoto : styleMode === 'animate' ? animatePhoto : effectsPhoto;

  const showImagePickerOptions = () => {
    // Always allow photo picking
    setPhotoPickerSlot('effects');
    setShowPhotoPicker(true);
  };

  // Handle photo selection for effects mode (from PhotoPickerModal)
  // Just set the local effects photo, don't auto-generate
  const handleEffectsPhotoSelect = (photo: ImageAsset) => {
    const imageAsset = {
      uri: photo.uri,
      type: photo.type,
      fileName: photo.fileName,
    };

    setEffectsPhoto(imageAsset);
  };

  // Shared fire-and-forget helper for effects generate (async 202 pattern)
  const fireEffectsGenerate = async (photo: ImageAsset) => {
    try {
      setIsEffectsGenerating(true);

      const accessoryIds = selectedAccessories.map(a => a.id);

      const formData = new FormData();
      formData.append('image', {
        uri: photo.uri,
        type: photo.type || 'image/jpeg',
        name: photo.fileName || 'photo.jpg',
      } as any);
      if (selectedSight?.id) {
        formData.append('promptId', selectedSight.id);
      }
      if (accessoryIds.length > 0) {
        accessoryIds.forEach(id => formData.append('accessoryIds', id));
      }

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiImage/generate`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to generate image';
        try {
          const errorText = await response.text();
          console.log('Generate API error response:', errorText);
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error || `Server error: ${response.status}`;
        } catch {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      dispatch(addPendingImageJob({photoId: result.photoId}));
      showSuccess('Effects Started', "You'll be notified when it's ready.");

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error: any) {
      showError(
        'Processing Failed',
        error instanceof Error ? error.message : 'Failed to generate image. Please try again.',
      );
    } finally {
      setIsEffectsGenerating(false);
    }
  };

  // Handle generate button press - actually starts the transformation
  const handleGenerate = async () => {
    if (!effectsPhoto) {
      // If no photo, open photo picker
      showImagePickerOptions();
      return;
    }

    // Get all selected accessory IDs
    const accessoryIds = selectedAccessories.map(a => a.id);

    // Check if template or accessory is selected
    if (!selectedSight && accessoryIds.length === 0) {
      // Show modal asking to select template or accessory
      setShowSelectTemplateModal(true);
      return;
    }

    // Fresh balance check from server
    if (totalCoins > 0 && accessToken) {
      const balanceResult = await dispatch(fetchCoinBalance(accessToken));
      const freshBalance = balanceResult.payload as number | undefined;
      if (freshBalance === undefined || freshBalance < totalCoins) {
        showError('Insufficient Balance', `You need ${totalCoins} ★ but have ${freshBalance ?? 0} ★.`);
        return;
      }
    }

    // Set the source image in Redux for the transformation
    dispatch(setSourceImage(effectsPhoto));

    // Fire-and-forget async generate
    fireEffectsGenerate(effectsPhoto);
  };

  const openCamera = async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
        includeBase64: false,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        showError('Error', result.errorMessage || 'Failed to open camera');
        return;
      }

      if (result.assets && result.assets[0]) {
        handleImageSelected(result.assets[0]);
      }
    } catch {
      showError('Error', 'Failed to open camera');
    }
  };

  const openGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
        includeBase64: false,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        showError('Error', result.errorMessage || 'Failed to open gallery');
        return;
      }

      if (result.assets && result.assets[0]) {
        handleImageSelected(result.assets[0]);
      }
    } catch {
      showError('Error', 'Failed to open gallery');
    }
  };

  const handleClearImage = () => {
    setEffectsPhoto(null);
    dispatch(clearTransformState());
  };

  // Add reference photo
  const addReferencePhoto = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
        includeBase64: false,
      });

      if (result.didCancel || !result.assets?.[0]?.uri) {
        return;
      }

      const asset = result.assets[0];
      const newRef: ImageAsset = {
        uri: asset.uri!,
        type: asset.type,
        fileName: asset.fileName,
      };

      setReferencePhotos(prev => [...prev, newRef]);
    } catch {
      showError('Error', 'Failed to add reference photo');
    }
  };

  // Remove reference photo
  const removeReferencePhoto = (index: number) => {
    setReferencePhotos(prev => prev.filter((_, i) => i !== index));
  };

  if (isTransforming) {
    return (
      <View style={[styles.container, {backgroundColor: colors.background, padding: containerPadding}]}>
        <View
          style={[
            styles.loadingCard,
            {
              backgroundColor: colors.cardBackground,
              shadowColor: colors.shadow,
              maxWidth: isTablet ? 500 : '100%',
              alignSelf: 'center',
              width: '100%',
            },
          ]}>
          {/* Show template thumbnail while generating */}
          {selectedSight?.thumbnailUrl && (
            <Image
              source={{uri: selectedSight.thumbnailUrl}}
              style={styles.loadingTemplateThumbnail}
              resizeMode="cover"
            />
          )}
          <View
            style={[
              styles.loadingIconContainer,
              {backgroundColor: colors.primary + '15'},
            ]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text style={[styles.loadingTitle, {color: colors.textPrimary, fontSize: isTablet ? 28 : 24}]}>
            Creating Magic
          </Text>
          <Text style={[styles.loadingText, {color: colors.textSecondary, fontSize: isTablet ? 18 : 16}]}>
            {selectedSight?.name ? `Transforming to ${selectedSight.name}...` : 'Applying effects...'}
          </Text>
          <View style={[styles.progressBar, {backgroundColor: colors.border}]}>
            <Animated.View
              style={[styles.progressFill, {backgroundColor: colors.primary}, progressAnimatedStyle]}
            />
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, {backgroundColor: colors.background, padding: containerPadding}]}>
        <View
          style={[
            styles.errorCard,
            {
              backgroundColor: colors.error + '10',
              borderColor: colors.error,
              maxWidth: isTablet ? 500 : '100%',
              alignSelf: 'center',
              width: '100%',
            },
          ]}>
          <View
            style={[
              styles.errorIconContainer,
              {backgroundColor: colors.error + '20'},
            ]}>
            <Text style={styles.errorIcon}>!</Text>
          </View>
          <Text style={[styles.errorTitle, {color: colors.error, fontSize: isTablet ? 24 : 20}]}>
            Oops! Something went wrong
          </Text>
          <Text style={[styles.errorText, {color: colors.textSecondary, fontSize: isTablet ? 17 : 15}]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, {backgroundColor: colors.error}]}
            onPress={handleClearImage}
            activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Build description text
  const getPlaceholderTitle = () => {
    if (canTransform) return 'Tap to capture';
    return 'Select something first';
  };

  const getPlaceholderSubtitle = () => {
    if (styleMode === 'synthesize' && referencePhotos.length > 0) {
      return `Style transfer with ${referencePhotos.length} reference(s)`;
    }
    if (styleMode === 'openeyes') return 'Upload a photo to open eyes';
    if (styleMode === 'restore') return 'Upload a photo to restore';
    if (styleMode === 'cleanBg') return 'Upload a photo to extend';
    if (styleMode === 'animate') return 'Upload a photo to animate';
    if (styleMode === 'refine') return 'Upload a photo to refine';
    if (selectedSight && selectedAccessories.length > 0) {
      return `${selectedSight.name} + ${selectedAccessories.length} accessory(ies)`;
    }
    if (selectedSight) {
      return `Transform yourself to ${selectedSight.name}`;
    }
    if (selectedAccessories.length > 0) {
      return `Apply ${selectedAccessories.length} accessory(ies) to your photo`;
    }
    return 'Choose a template or add accessories';
  };

  // Reset wizard when switching modes
  const handleModeSwitch = (mode: 'effects' | 'openeyes' | 'synthesize' | 'cleanBg' | 'restore' | 'animate' | 'refine') => {
    dispatch(setStyleMode(mode));
    if (mode === 'synthesize') {
      setWizardStep(1);
      setSelectedSynthesizeAction(null);
    }
  };

  // Handle wizard navigation
  const goToNextStep = () => {
    if (wizardStep < 3) {
      setWizardStep(wizardStep + 1);
    }
  };

  const goToPrevStep = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
    }
  };

  // Handle Synthesize Generate button
  const handleSynthesizeGenerate = async () => {
    if (!referencePhotos[0] && !synthesizePhoto2) {
      setSynthesizeModalMessage('Please add both photos to create your synthesized image.');
      setShowSynthesizeModal(true);
      return;
    }
    if (!referencePhotos[0]) {
      setSynthesizeModalMessage('Please add Photo 1 to continue.');
      setShowSynthesizeModal(true);
      return;
    }
    if (!synthesizePhoto2) {
      setSynthesizeModalMessage('Please add Photo 2 to continue.');
      setShowSynthesizeModal(true);
      return;
    }
    if (!selectedSynthesizeAction) {
      setSynthesizeModalMessage('Please select an action to combine your photos.');
      setShowSynthesizeModal(true);
      return;
    }

    // Fresh balance check from server
    const requiredCoins = selectedSynthesizeAction?.estimatedCoins ?? 0;
    if (requiredCoins > 0 && accessToken) {
      const balanceResult = await dispatch(fetchCoinBalance(accessToken));
      const freshBalance = balanceResult.payload as number | undefined;
      if (freshBalance === undefined || freshBalance < requiredCoins) {
        setSynthesizeModalMessage(`You need ${requiredCoins} ★ but have ${freshBalance ?? 0} ★.`);
        setShowSynthesizeModal(true);
        return;
      }
    }

    // All requirements met - fire-and-forget async generate
    try {
      dispatch(setSourceImage(synthesizePhoto2));

      const formData = new FormData();
      formData.append('sourceImage', {
        uri: synthesizePhoto2.uri,
        type: synthesizePhoto2.type || 'image/jpeg',
        name: synthesizePhoto2.fileName || 'source.jpg',
      } as any);
      referencePhotos.forEach(ref => {
        formData.append('referenceImages', {
          uri: ref.uri,
          type: ref.type || 'image/jpeg',
          name: ref.fileName || 'reference.jpg',
        } as any);
      });
      if (selectedSynthesizeAction?.id) {
        formData.append('actionId', selectedSynthesizeAction.id);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiImage/synthesize-multiple-images`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to synthesize images';
        try {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error || `Server error: ${response.status}`;
        } catch {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      dispatch(addPendingSynthesizeJobs({photoIds: result.photoIds}));
      showSuccess('Synthesize Started', "You'll be notified when all images are ready.");

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error) {
      showError(
        'Processing Failed',
        error instanceof Error ? error.message : 'Failed to synthesize images. Please try again.',
      );
    }
  };

  // Handle Open Eyes Generate button
  const handleOpenEyesGenerate = async () => {
    if (!openEyesPhoto) {
      // No photo selected, open image picker
      setPhotoPickerSlot('effects');
      setShowPhotoPicker(true);
      return;
    }

    // Fresh balance check from server
    const requiredCoins = openEyesPrice?.estimatedCoins ?? 0;
    if (requiredCoins > 0 && accessToken) {
      const balanceResult = await dispatch(fetchCoinBalance(accessToken));
      const freshBalance = balanceResult.payload as number | undefined;
      if (freshBalance === undefined || freshBalance < requiredCoins) {
        showError('Insufficient Balance', `You need ${requiredCoins} ★ but have ${freshBalance ?? 0} ★.`);
        return;
      }
    }

    try {
      setIsOpenEyesLoading(true);

      const formData = new FormData();
      formData.append('image', {
        uri: openEyesPhoto.uri,
        type: openEyesPhoto.type || 'image/jpeg',
        name: openEyesPhoto.fileName || 'photo.jpg',
      } as any);

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiImage/open-eyes`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to process image';
        try {
          const errorText = await response.text();
          console.error('Open Eyes API error response:', errorText);
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error || `Server error: ${response.status}`;
        } catch (parseError) {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      dispatch(addPendingImageJob({photoId: result.photoId}));
      showSuccess('Open Eyes Started', "You'll be notified when it's ready.");

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error) {
      console.error('Open Eyes error:', error);
      showError(
        'Processing Failed',
        error instanceof Error ? error.message : 'Failed to open eyes. Please try again.',
      );
    } finally {
      setIsOpenEyesLoading(false);
    }
  };

  // Handle Restore Generate button
  const handleRestoreGenerate = async () => {
    if (!restorePhoto) {
      // No photo selected, open image picker
      setPhotoPickerSlot('effects');
      setShowPhotoPicker(true);
      return;
    }

    // Fresh balance check from server
    const requiredCoins = restorePrice?.estimatedCoins ?? 0;
    if (requiredCoins > 0 && accessToken) {
      const balanceResult = await dispatch(fetchCoinBalance(accessToken));
      const freshBalance = balanceResult.payload as number | undefined;
      if (freshBalance === undefined || freshBalance < requiredCoins) {
        showError('Insufficient Balance', `You need ${requiredCoins} ★ but have ${freshBalance ?? 0} ★.`);
        return;
      }
    }

    try {
      setIsRestoreLoading(true);

      const formData = new FormData();
      formData.append('image', {
        uri: restorePhoto.uri,
        type: restorePhoto.type || 'image/jpeg',
        name: restorePhoto.fileName || 'photo.jpg',
      } as any);

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiImage/restore`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to process image';
        try {
          const errorText = await response.text();
          console.error('Restore API error response:', errorText);
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error || `Server error: ${response.status}`;
        } catch (parseError) {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      dispatch(addPendingImageJob({photoId: result.photoId}));
      showSuccess('Restore Started', "You'll be notified when it's ready.");

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error) {
      console.error('Restore error:', error);
      showError(
        'Processing Failed',
        error instanceof Error ? error.message : 'Failed to restore photo. Please try again.',
      );
    } finally {
      setIsRestoreLoading(false);
    }
  };

  // Handle Refine Generate button
  const handleRefineGenerate = async () => {
    if (!refinePhoto) {
      setPhotoPickerSlot('effects');
      setShowPhotoPicker(true);
      return;
    }

    // Fresh balance check from server
    const requiredCoins = refinePrice?.estimatedCoins ?? 0;
    if (requiredCoins > 0 && accessToken) {
      const balanceResult = await dispatch(fetchCoinBalance(accessToken));
      const freshBalance = balanceResult.payload as number | undefined;
      if (freshBalance === undefined || freshBalance < requiredCoins) {
        showError('Insufficient Balance', `You need ${requiredCoins} ★ but have ${freshBalance ?? 0} ★.`);
        return;
      }
    }

    try {
      setIsRefineLoading(true);

      const formData = new FormData();
      formData.append('image', {
        uri: refinePhoto.uri,
        type: refinePhoto.type || 'image/jpeg',
        name: refinePhoto.fileName || 'photo.jpg',
      } as any);

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiImage/refine`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to process image';
        try {
          const errorText = await response.text();
          console.error('Refine API error response:', errorText);
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error || `Server error: ${response.status}`;
        } catch (parseError) {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      dispatch(addPendingImageJob({photoId: result.photoId}));
      showSuccess('Refine Started', "You'll be notified when it's ready.");

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error) {
      console.error('Refine error:', error);
      showError(
        'Processing Failed',
        error instanceof Error ? error.message : 'Failed to refine photo. Please try again.',
      );
    } finally {
      setIsRefineLoading(false);
    }
  };

  // Handle Animate Generate button
  const handleAnimateGenerate = async () => {
    if (!animatePhoto) {
      setPhotoPickerSlot('effects');
      setShowPhotoPicker(true);
      return;
    }

    // Fresh balance check from server
    const requiredCoins = animationPrice?.estimatedCoins ?? 0;
    if (requiredCoins > 0 && accessToken) {
      const balanceResult = await dispatch(fetchCoinBalance(accessToken));
      const freshBalance = balanceResult.payload as number | undefined;
      if (freshBalance === undefined || freshBalance < requiredCoins) {
        showError('Insufficient Balance', `You need ${requiredCoins} ★ but have ${freshBalance ?? 0} ★.`);
        return;
      }
    }

    try {
      setIsAnimateLoading(true);

      const formData = new FormData();
      formData.append('image', {
        uri: animatePhoto.uri,
        type: animatePhoto.type || 'image/jpeg',
        name: animatePhoto.fileName || 'photo.jpg',
      } as any);
      formData.append('aspectRatio', animateAspectRatio);

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiVideo/animate`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to animate image';
        try {
          const errorText = await response.text();
          console.log('Animate API error response:', errorText);
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error || `Server error: ${response.status}`;
        } catch (parseError) {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      dispatch(addPendingJob({videoId: result.videoId}));
      showSuccess('Animation Started', "You'll be notified when it's ready.");

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error: any) {
      showError(
        'Processing Failed',
        error instanceof Error ? error.message : 'Failed to animate photo. Please try again.',
      );
    } finally {
      setIsAnimateLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      <View style={styles.stepDots}>
        {[1, 2].map((step) => (
          <View
            key={step}
            style={[
              styles.stepDot,
              {backgroundColor: wizardStep >= step ? colors.primary : colors.border},
            ]}
          />
        ))}
      </View>
    </View>
  );

  // Pick photo for a specific slot (1 or 2)
  const pickPhotoForSlot = (slot: 1 | 2) => {
    if (slot === 2) {
      // For Photo 2, offer character library option first
      setShowPhotoSourcePicker(true);
    } else {
      // For Photo 1, show photo picker modal directly
      setPhotoPickerSlot(slot);
      setShowPhotoPicker(true);
    }
  };

  const handlePhotoSourceChoice = (choice: 'character' | 'photos') => {
    setShowPhotoSourcePicker(false);
    if (choice === 'character') {
      setShowCharacterPicker(true);
    } else {
      setPhotoPickerSlot(2);
      setShowPhotoPicker(true);
    }
  };

  // Handle photo selection from PhotoPickerModal
  const handlePhotoPickerSelect = (photo: ImageAsset) => {
    if (photoPickerSlot === 1) {
      setReferencePhotos([photo]);
    } else if (photoPickerSlot === 2) {
      setSynthesizePhoto2(photo);
      setSelectedCharacter(null);
    } else if (photoPickerSlot === 'effects') {
      if (styleMode === 'cleanBg') {
        handleCleanBgPhotoSelect(photo);
      } else if (styleMode === 'restore') {
        setRestorePhoto({uri: photo.uri, type: photo.type, fileName: photo.fileName});
      } else if (styleMode === 'openeyes') {
        setOpenEyesPhoto({uri: photo.uri, type: photo.type, fileName: photo.fileName});
      } else if (styleMode === 'animate') {
        setAnimatePhoto({uri: photo.uri, type: photo.type, fileName: photo.fileName});
      } else if (styleMode === 'refine') {
        setRefinePhoto({uri: photo.uri, type: photo.type, fileName: photo.fileName});
      } else {
        handleEffectsPhotoSelect(photo);
      }
    }
  };

  // Handle character selection from library
  const handleCharacterSelected = (character: CharacterItem) => {
    setSelectedCharacter(character);
    // Set the character image as synthesize photo 2
    const imageUrl = getFullCharacterImageUrl(character.imageUrl);
    if (imageUrl) {
      setSynthesizePhoto2({
        uri: imageUrl,
        type: 'image/jpeg',
        fileName: `${character.characterId}.jpg`,
      });
    }
  };

  const handleSlotPhotoPick = async (slot: 1 | 2, useCamera: boolean) => {
    try {
      const options = {
        mediaType: 'photo' as const,
        quality: 1 as const,
        maxWidth: 1920,
        maxHeight: 1920,
        includeBase64: false,
      };

      const result = useCamera
        ? await launchCamera(options)
        : await launchImageLibrary(options);

      if (result.didCancel || !result.assets?.[0]?.uri) {
        return;
      }

      const asset = result.assets[0];
      const imageAsset = {
        uri: asset.uri!,
        type: asset.type,
        fileName: asset.fileName,
      };

      if (slot === 1) {
        // First photo goes to referencePhotos[0]
        setReferencePhotos([imageAsset]);
      } else {
        // Second photo goes to synthesizePhoto2
        setSynthesizePhoto2(imageAsset);
      }
    } catch {
      showError('Error', 'Failed to get photo');
    }
  };

  const clearPhoto1 = () => {
    setReferencePhotos([]);
  };

  const clearPhoto2 = () => {
    setSynthesizePhoto2(null);
    setSelectedCharacter(null);
  };

  // Check if both photos are selected for Synthesize mode
  const hasBothPhotos = referencePhotos.length > 0 && synthesizePhoto2;

  // Render Step 1: Choose both photos side by side
  const renderStep1 = () => (
    <View style={styles.wizardStepContent}>
      {/* Actions Bar - at the top */}
      <ActionsBar
        selectedAction={selectedSynthesizeAction}
        onSelectAction={setSelectedSynthesizeAction}
      />

      <View style={styles.twoPhotosContainer}>
        {/* Photo 1 */}
        <View style={styles.photoSlot}>
          {referencePhotos[0] ? (
            <TouchableOpacity
              style={styles.photoSlotWrapper}
              onPress={() => pickPhotoForSlot(1)}
              activeOpacity={0.8}>
              <View style={[styles.photoSlotFilled, {borderColor: 'transparent'}]}>
                <Image source={{uri: referencePhotos[0].uri}} style={styles.photoSlotImage} resizeMode="cover" />
                <TouchableOpacity
                  style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setFullScreenImage(referencePhotos[0].uri);
                  }}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removePhotoBtn, {backgroundColor: colors.error}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    clearPhoto1();
                  }}>
                  <Text style={styles.removePhotoBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Photo 1</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.photoSlotEmpty, {backgroundColor: colors.cardBackground, borderColor: colors.border}]}
              onPress={() => pickPhotoForSlot(1)}
              activeOpacity={0.8}>
              <Ionicons name="camera" size={36} color={colors.textTertiary} />
              <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>Add</Text>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.textTertiary}]}>
                <Text style={styles.photoSlotLabelText}>Photo 1</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Plus sign between photos */}
        <View style={styles.photosPlusSign}>
          <Text style={[styles.photosPlusText, {color: colors.textTertiary}]}>+</Text>
        </View>

        {/* Photo 2 */}
        <View style={styles.photoSlot}>
          {synthesizePhoto2 ? (
            <TouchableOpacity
              style={styles.photoSlotWrapper}
              onPress={() => pickPhotoForSlot(2)}
              activeOpacity={0.8}>
              <View style={[styles.photoSlotFilled, {borderColor: selectedCharacter ? colors.success : colors.primary}]}>
                <Image source={{uri: synthesizePhoto2.uri}} style={styles.photoSlotImage} resizeMode="cover" />
                {selectedCharacter && (
                  <View style={[styles.characterBadge, {backgroundColor: colors.success}]}>
                    <Text style={styles.characterBadgeText}>⭐</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setFullScreenImage(synthesizePhoto2.uri);
                  }}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removePhotoBtn, {backgroundColor: colors.error}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    clearPhoto2();
                  }}>
                  <Text style={styles.removePhotoBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: selectedCharacter ? colors.success : colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>{selectedCharacter ? selectedCharacter.name : 'Photo 2'}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.photoSlotEmpty, {backgroundColor: colors.cardBackground, borderColor: colors.border}]}
              onPress={() => pickPhotoForSlot(2)}
              activeOpacity={0.8}>
              <Ionicons name="camera" size={36} color={colors.textTertiary} />
              <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>Add</Text>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.textTertiary}]}>
                <Text style={styles.photoSlotLabelText}>Photo 2</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.wizardNavButtonsFull}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.nextButtonGradient}>
          <TouchableOpacity
            style={styles.nextButtonTouchable}
            onPress={handleSynthesizeGenerate}
            activeOpacity={0.9}>
            <Text style={[styles.nextButtonText, {color: '#fff'}]}>
              {'Generate'}
              {selectedSynthesizeAction?.estimatedCoins && !selectedSynthesizeAction?.isFree ? (
                <Text style={{color: '#FFD700'}}>{` (${selectedSynthesizeAction.estimatedCoins} ★)`}</Text>
              ) : (
                <Text style={{color: '#22C55E'}}>{' (Free)'}</Text>
              )}
              {' →'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );

  // Render Step 2: Choose action & Generate
  const renderStep2 = () => (
    <View style={styles.step2Container}>
      {/* Top content area */}
      <View style={styles.step2TopContent}>
        {/* Actions bar inside step 2 */}
        <ActionsBar
          selectedAction={selectedSynthesizeAction}
          onSelectAction={setSelectedSynthesizeAction}
        />
        <View style={styles.step2Content}>
          {/* Selected action display */}
          {selectedSynthesizeAction ? (
            <View style={[styles.selectedActionBox, {backgroundColor: colors.primary + '15', borderColor: colors.primary}]}>
              <Text style={styles.selectedActionIcon}>{selectedSynthesizeAction.icon}</Text>
              <Text style={[styles.selectedActionLabel, {color: colors.primary}]}>
                {selectedSynthesizeAction.label}
              </Text>
            </View>
          ) : (
            <View style={[styles.noActionBox, {backgroundColor: colors.backgroundTertiary, borderColor: colors.border}]}>
              <Text style={[styles.noActionText, {color: colors.textTertiary}]}>
                Select an action
              </Text>
            </View>
          )}

          {/* Combined prompt hint */}
          {selectedSynthesizeAction && (
            <Text style={[styles.combinedHint, {color: colors.textTertiary}]}>
              {selectedSynthesizeAction.label}
            </Text>
          )}
        </View>
      </View>

      {/* Fixed bottom buttons */}
      <View style={styles.step2Buttons}>
        <View style={styles.wizardNavButtonsFull}>
          <LinearGradient
            colors={selectedSynthesizeAction ? [colors.gradientStart, colors.gradientEnd] : [colors.backgroundTertiary, colors.backgroundTertiary]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={[
              styles.nextButtonGradient,
              !selectedSynthesizeAction && styles.nextButtonDisabled,
            ]}>
            <TouchableOpacity
              style={styles.nextButtonTouchable}
              onPress={() => {
                if (synthesizePhoto2 && referencePhotos.length > 0 && selectedSynthesizeAction) {
                  handleSynthesizeGenerate();
                }
              }}
              disabled={!selectedSynthesizeAction}
              activeOpacity={0.9}>
              <Text style={[styles.nextButtonText, {color: selectedSynthesizeAction ? '#fff' : colors.textTertiary}]}>
                {'Generate'}
                {selectedSynthesizeAction ? (
                  selectedSynthesizeAction.estimatedCoins && !selectedSynthesizeAction.isFree ? (
                    <Text style={{color: '#FFD700'}}>{` (${selectedSynthesizeAction.estimatedCoins} ★)`}</Text>
                  ) : (
                    <Text style={{color: '#22C55E'}}>{' (Free)'}</Text>
                  )
                ) : null}
                {' →'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
        <TouchableOpacity
          style={[styles.step2BackButton, {borderColor: colors.primary}]}
          onPress={goToPrevStep}
          activeOpacity={0.8}>
          <Text style={[styles.wizardBackButtonText, {color: colors.primary}]}>← Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render Open Eyes mode
  const renderOpenEyesMode = () => (
    <View style={[styles.effectsTabContainer, {maxWidth: isTablet ? 600 : '100%', alignSelf: 'center', width: '100%'}]}>
      {/* Photo Picker - centered */}
      <View style={styles.effectsPhotoSection}>
        <View style={[styles.photoSlot, {maxWidth: '100%', flex: 1, width: '100%'}]}>
          {openEyesPhoto ? (
            <TouchableOpacity
              style={[styles.photoSlotWrapper, {flex: 1}]}
              onPress={() => { setPhotoPickerSlot('effects'); setShowPhotoPicker(true); }}
              activeOpacity={0.8}>
              <View style={[styles.photoSlotFilled, {borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}>
                <Image source={{uri: openEyesPhoto.uri}} style={styles.photoSlotImage} resizeMode="contain" />
                <TouchableOpacity
                  style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setFullScreenImage(openEyesPhoto.uri);
                  }}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removePhotoBtn, {backgroundColor: 'rgba(255,27,109,0.9)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setOpenEyesPhoto(null);
                  }}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.photoSlotEmpty, {backgroundColor: colors.cardBackground, borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}
              onPress={() => { setPhotoPickerSlot('effects'); setShowPhotoPicker(true); }}
              activeOpacity={0.8}>
              <Ionicons name="eye" size={48} color={colors.primary} />
              <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>
                Add Photo
              </Text>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Generate Button - same style as Effects tab */}
      <View style={styles.wizardNavButtonsFull}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.nextButtonGradient}>
          <TouchableOpacity
            style={styles.nextButtonTouchable}
            onPress={handleOpenEyesGenerate}
            disabled={isOpenEyesLoading}
            activeOpacity={0.9}>
            {isOpenEyesLoading ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.nextButtonText, {color: '#fff'}]}>Processing...</Text>
              </View>
            ) : (
              <Text style={[styles.nextButtonText, {color: '#fff'}]}>
                {openEyesPhoto
                  ? <>{'Open Eyes'}
                      {openEyesPrice && !openEyesPrice.isFree && openEyesPrice.estimatedCoins > 0 ? (
                        <Text style={{color: '#FFD700'}}>{` (${openEyesPrice.estimatedCoins} ★)`}</Text>
                      ) : (
                        <Text style={{color: '#22C55E'}}>{' (Free)'}</Text>
                      )}
                      {' →'}</>
                  : 'Add Photo →'}
              </Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );

  // Render Restore mode
  const renderRestoreMode = () => (
    <View style={[styles.effectsTabContainer, {maxWidth: isTablet ? 600 : '100%', alignSelf: 'center', width: '100%'}]}>
      {/* Photo Picker - centered */}
      <View style={styles.effectsPhotoSection}>
        <View style={[styles.photoSlot, {maxWidth: '100%', flex: 1, width: '100%'}]}>
          {restorePhoto ? (
            <TouchableOpacity
              style={[styles.photoSlotWrapper, {flex: 1}]}
              onPress={() => { setPhotoPickerSlot('effects'); setShowPhotoPicker(true); }}
              activeOpacity={0.8}>
              <View style={[styles.photoSlotFilled, {borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}>
                <Image source={{uri: restorePhoto.uri}} style={styles.photoSlotImage} resizeMode="contain" />
                <TouchableOpacity
                  style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setFullScreenImage(restorePhoto.uri);
                  }}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removePhotoBtn, {backgroundColor: 'rgba(255,27,109,0.9)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setRestorePhoto(null);
                  }}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.photoSlotEmpty, {backgroundColor: colors.cardBackground, borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}
              onPress={() => { setPhotoPickerSlot('effects'); setShowPhotoPicker(true); }}
              activeOpacity={0.8}>
              <Ionicons name="time-outline" size={48} color={colors.primary} />
              <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>
                Add Photo
              </Text>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Generate Button - same style as Open Eyes */}
      <View style={styles.wizardNavButtonsFull}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.nextButtonGradient}>
          <TouchableOpacity
            style={styles.nextButtonTouchable}
            onPress={handleRestoreGenerate}
            disabled={isRestoreLoading}
            activeOpacity={0.9}>
            {isRestoreLoading ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.nextButtonText, {color: '#fff'}]}>Processing...</Text>
              </View>
            ) : (
              <Text style={[styles.nextButtonText, {color: '#fff'}]}>
                {restorePhoto
                  ? <>{'Restore'}
                      {restorePrice && !restorePrice.isFree && restorePrice.estimatedCoins > 0 ? (
                        <Text style={{color: '#FFD700'}}>{` (${restorePrice.estimatedCoins} ★)`}</Text>
                      ) : (
                        <Text style={{color: '#22C55E'}}>{' (Free)'}</Text>
                      )}
                      {' →'}</>
                  : 'Add Photo →'}
              </Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );

  // Render Refine mode
  const renderRefineMode = () => (
    <View style={[styles.effectsTabContainer, {maxWidth: isTablet ? 600 : '100%', alignSelf: 'center', width: '100%'}]}>
      {/* Photo Picker - centered */}
      <View style={styles.effectsPhotoSection}>
        <View style={[styles.photoSlot, {maxWidth: '100%', flex: 1, width: '100%'}]}>
          {refinePhoto ? (
            <TouchableOpacity
              style={[styles.photoSlotWrapper, {flex: 1}]}
              onPress={() => { setPhotoPickerSlot('effects'); setShowPhotoPicker(true); }}
              activeOpacity={0.8}>
              <View style={[styles.photoSlotFilled, {borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}>
                <Image source={{uri: refinePhoto.uri}} style={styles.photoSlotImage} resizeMode="contain" />
                <TouchableOpacity
                  style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setFullScreenImage(refinePhoto.uri);
                  }}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removePhotoBtn, {backgroundColor: 'rgba(255,27,109,0.9)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setRefinePhoto(null);
                  }}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.photoSlotEmpty, {backgroundColor: colors.cardBackground, borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}
              onPress={() => { setPhotoPickerSlot('effects'); setShowPhotoPicker(true); }}
              activeOpacity={0.8}>
              <Ionicons name="color-filter" size={48} color={colors.primary} />
              <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>
                Add Photo
              </Text>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Generate Button - same style as Restore */}
      <View style={styles.wizardNavButtonsFull}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.nextButtonGradient}>
          <TouchableOpacity
            style={styles.nextButtonTouchable}
            onPress={handleRefineGenerate}
            disabled={isRefineLoading}
            activeOpacity={0.9}>
            {isRefineLoading ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.nextButtonText, {color: '#fff'}]}>Processing...</Text>
              </View>
            ) : (
              <Text style={[styles.nextButtonText, {color: '#fff'}]}>
                {refinePhoto
                  ? <>{'Refine'}
                      {refinePrice && !refinePrice.isFree && refinePrice.estimatedCoins > 0 ? (
                        <Text style={{color: '#FFD700'}}>{` (${refinePrice.estimatedCoins} ★)`}</Text>
                      ) : (
                        <Text style={{color: '#22C55E'}}>{' (Free)'}</Text>
                      )}
                      {' →'}</>
                  : 'Add Photo →'}
              </Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );

  // Render Animate mode
  const renderAnimateMode = () => (
    <View style={[styles.effectsTabContainer, {maxWidth: isTablet ? 600 : '100%', alignSelf: 'center', width: '100%'}]}>
      {/* Photo Picker - centered */}
      <View style={styles.effectsPhotoSection}>
        <View style={[styles.photoSlot, {maxWidth: '100%', flex: 1, width: '100%'}]}>
          {animatePhoto ? (
            <TouchableOpacity
              style={[styles.photoSlotWrapper, {flex: 1}]}
              onPress={() => { setPhotoPickerSlot('effects'); setShowPhotoPicker(true); }}
              activeOpacity={0.8}>
              <View style={[styles.photoSlotFilled, {borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}>
                <Image source={{uri: animatePhoto.uri}} style={styles.photoSlotImage} resizeMode="contain" />
                <TouchableOpacity
                  style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setFullScreenImage(animatePhoto.uri);
                  }}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removePhotoBtn, {backgroundColor: 'rgba(255,27,109,0.9)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setAnimatePhoto(null);
                  }}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.photoSlotEmpty, {backgroundColor: colors.cardBackground, borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}
              onPress={() => { setPhotoPickerSlot('effects'); setShowPhotoPicker(true); }}
              activeOpacity={0.8}>
              <Ionicons name="videocam" size={48} color={colors.primary} />
              <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>
                Add Photo
              </Text>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Aspect Ratio Selector */}
      <View style={{paddingHorizontal: 16, paddingBottom: 8}}>
        <View style={{flexDirection: 'row', gap: 10}}>
          {ANIMATE_ASPECT_RATIOS.map(option => (
            <TouchableOpacity
              key={option.id}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 10,
                borderWidth: 1,
                gap: 6,
                backgroundColor: animateAspectRatio === option.id
                  ? colors.primary
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: animateAspectRatio === option.id
                  ? colors.primary
                  : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              }}
              onPress={() => setAnimateAspectRatio(option.id)}
              activeOpacity={0.7}>
              <Ionicons
                name={option.icon as any}
                size={16}
                color={animateAspectRatio === option.id ? '#fff' : colors.textSecondary}
              />
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: animateAspectRatio === option.id ? '#fff' : colors.textSecondary,
              }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Generate Button */}
      <View style={styles.wizardNavButtonsFull}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.nextButtonGradient}>
          <TouchableOpacity
            style={styles.nextButtonTouchable}
            onPress={handleAnimateGenerate}
            disabled={isAnimateLoading}
            activeOpacity={0.9}>
            {isAnimateLoading ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.nextButtonText, {color: '#fff'}]}>Submitting...</Text>
              </View>
            ) : (
              <Text style={[styles.nextButtonText, {color: '#fff'}]}>
                {animatePhoto ? 'Animate' : 'Add Photo →'}
                {animatePhoto && animationPrice && !animationPrice.isFree && animationPrice.estimatedCoins > 0 ? (
                  <Text style={{color: '#FFD700'}}>{` (${animationPrice.estimatedCoins} ★)`}</Text>
                ) : null}
                {animatePhoto ? ' →' : ''}
              </Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );

  // Handle Clean Background Generate button (sends image only, no mask)
  const handleCleanBgGenerate = async () => {
    if (!cleanBgPhoto) {
      setPhotoPickerSlot('effects');
      setShowPhotoPicker(true);
      return;
    }

    // Fresh balance check from server
    const requiredCoins = extendPrice?.estimatedCoins ?? 0;
    if (requiredCoins > 0 && accessToken) {
      const balanceResult = await dispatch(fetchCoinBalance(accessToken));
      const freshBalance = balanceResult.payload as number | undefined;
      if (freshBalance === undefined || freshBalance < requiredCoins) {
        showError('Insufficient Balance', `You need ${requiredCoins} ★ but have ${freshBalance ?? 0} ★.`);
        return;
      }
    }

    try {
      setIsCleanBgLoading(true);

      const formData = new FormData();
      formData.append('image', {
        uri: cleanBgPhoto.uri,
        type: cleanBgPhoto.type || 'image/jpeg',
        name: cleanBgPhoto.fileName || 'photo.jpg',
      } as any);
      formData.append('aspectRatio', extendAspectRatio);

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiImage/extend`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to process image';
        try {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error || `Server error: ${response.status}`;
        } catch {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      dispatch(addPendingImageJob({photoId: result.photoId}));
      showSuccess('Extend Started', "You'll be notified when it's ready.");

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error) {
      console.error('Extend error:', error);
      showError(
        'Processing Failed',
        error instanceof Error ? error.message : 'Failed to extend image. Please try again.',
      );
    } finally {
      setIsCleanBgLoading(false);
    }
  };

  // Handle mask-based Remove Object (captures photo+highlights composite, sends to remove-object)
  const handleMaskCleanGenerate = async () => {
    if (!cleanBgPhoto) {
      return;
    }

    try {
      setIsCleanBgLoading(true);

      // Reset zoom to 1x before capturing so the screenshot matches the original framing
      zoomScale.value = 1;
      zoomTranslateX.value = 0;
      zoomTranslateY.value = 0;

      // Small delay to let the zoom reset render before capture
      await new Promise<void>(r => setTimeout(r, 150));

      // Capture the composite image (photo + red highlighted strokes) via Skia canvas
      const compositeUri = await maskCanvasRef.current?.captureHighlighted();
      if (!compositeUri) {
        throw new Error('Failed to capture highlighted image');
      }

      const formData = new FormData();
      formData.append('image', {
        uri: compositeUri,
        type: 'image/png',
        name: 'highlighted.png',
      } as any);
      formData.append('isHighlighted', 'true');

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiImage/remove-object`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to process image';
        try {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error || `Server error: ${response.status}`;
        } catch {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      dispatch(addPendingImageJob({photoId: result.photoId}));
      showSuccess('Object Removal Started', "You'll be notified when it's ready.");

      maskCanvasRef.current?.clearAll();
      setHasMaskDrawn(false);

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error) {
      console.error('Remove Object error:', error);
      showError(
        'Processing Failed',
        error instanceof Error ? error.message : 'Failed to remove object. Please try again.',
      );
    } finally {
      setIsCleanBgLoading(false);
    }
  };

  // Save cleaned result to camera roll
  const handleCleanBgSave = async () => {
    if (!cleanBgResultUrl) { return; }
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showError('Permission Denied', 'Cannot save without permission');
          return;
        }
      }
      // Download to local file first — CameraRoll needs a file:// URI on iOS
      const fileName = `cleaned_${Date.now()}.png`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const dl = await RNFS.downloadFile({fromUrl: cleanBgResultUrl, toFile: filePath}).promise;
      if (dl.statusCode !== 200) { throw new Error('Failed to download image'); }
      await CameraRoll.saveAsset(`file://${filePath}`, {type: 'photo'});
      await RNFS.unlink(filePath).catch(() => {});
      setShowMaskModal(false);
      // Small delay so the modal closes before the dialog appears
      setTimeout(() => showSuccess('Saved!', 'Photo saved to your gallery'), 300);
    } catch (e) {
      console.error('Save error:', e);
      showError('Error', 'Failed to save photo');
    }
  };

  // Share cleaned result
  const handleCleanBgShare = async () => {
    if (!cleanBgResultUrl) { return; }
    try {
      const fileName = `cleaned_${Date.now()}.png`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const dl = await RNFS.downloadFile({fromUrl: cleanBgResultUrl, toFile: filePath}).promise;
      if (dl.statusCode !== 200) { throw new Error('Download failed'); }
      await Share.open({
        title: 'My cleaned photo',
        message: 'Check out my AI-cleaned photo!',
        url: `file://${filePath}`,
        type: 'image/png',
      });
      await RNFS.unlink(filePath).catch(() => {});
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        console.error('Share error:', e);
        showError('Error', 'Failed to share photo');
      }
    }
  };

  // Handle photo selection for clean bg mode
  const handleCleanBgPhotoSelect = (photo: ImageAsset) => {
    const imageAsset = {
      uri: photo.uri,
      type: photo.type,
      fileName: photo.fileName,
    };
    setCleanBgPhoto(imageAsset);
    setCleanBgResultUrl(null);
    setHasMaskDrawn(false);
    maskCanvasRef.current?.clearAll();

    // Get actual image dimensions for aspect ratio
    Image.getSize(
      photo.uri,
      (w, h) => setCleanBgPhotoDimensions({w, h}),
      () => setCleanBgPhotoDimensions(null),
    );
  };

  // Render Clean Background mode — small photo slot (like Open Eyes) + wand button
  const renderCleanBgMode = () => (
    <View style={[styles.effectsTabContainer, {maxWidth: isTablet ? 600 : '100%', alignSelf: 'center', width: '100%'}]}>
      {/* Photo Picker */}
      <View style={styles.effectsPhotoSection}>
        <View style={[styles.photoSlot, {maxWidth: '100%', flex: 1, width: '100%'}]}>
          {cleanBgPhoto ? (
            <TouchableOpacity
              style={[styles.photoSlotWrapper, {flex: 1}]}
              onPress={() => {
                setPhotoPickerSlot('effects');
                setShowPhotoPicker(true);
              }}
              activeOpacity={0.8}>
              <View style={[styles.photoSlotFilled, {borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}>
                <Image source={{uri: cleanBgPhoto.uri}} style={styles.photoSlotImage} resizeMode="contain" />
                {/* Close / remove photo button */}
                <TouchableOpacity
                  style={[styles.removePhotoBtn, {backgroundColor: 'rgba(255,27,109,0.9)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setCleanBgPhoto(null);
                    setCleanBgPhotoDimensions(null);
                    setCleanBgResultUrl(null);
                    setHasMaskDrawn(false);
                    maskCanvasRef.current?.clearAll();
                  }}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
                {/* Full screen button — bottom-right */}
                <TouchableOpacity
                  style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setFullScreenImage(cleanBgPhoto.uri);
                  }}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.photoSlotEmpty, {backgroundColor: colors.cardBackground, borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}
              onPress={() => {
                setPhotoPickerSlot('effects');
                setShowPhotoPicker(true);
              }}
              activeOpacity={0.8}>
              <Ionicons name="people" size={48} color={colors.primary} />
              <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>
                Add Photo
              </Text>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Aspect Ratio Selector */}
      <View style={{paddingHorizontal: 16, paddingBottom: 8}}>
        <View style={{flexDirection: 'row', gap: 10}}>
          {EXTEND_ASPECT_RATIOS.map(option => (
            <TouchableOpacity
              key={option.id}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 10,
                borderWidth: 1,
                gap: 6,
                backgroundColor: extendAspectRatio === option.id
                  ? colors.primary
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: extendAspectRatio === option.id
                  ? colors.primary
                  : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              }}
              onPress={() => setExtendAspectRatio(option.id)}
              activeOpacity={0.7}>
              <Ionicons
                name={option.icon as any}
                size={16}
                color={extendAspectRatio === option.id ? '#fff' : colors.textSecondary}
              />
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: extendAspectRatio === option.id ? '#fff' : colors.textSecondary,
              }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Generate Button */}
      <View style={styles.wizardNavButtonsFull}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.nextButtonGradient}>
          <TouchableOpacity
            style={styles.nextButtonTouchable}
            onPress={cleanBgPhoto ? handleCleanBgGenerate : () => {
              setPhotoPickerSlot('effects');
              setShowPhotoPicker(true);
            }}
            disabled={isCleanBgLoading}
            activeOpacity={0.9}>
            {isCleanBgLoading ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.nextButtonText, {color: '#fff'}]}>Processing...</Text>
              </View>
            ) : (
              <Text style={[styles.nextButtonText, {color: '#fff'}]}>
                {cleanBgPhoto ? 'Extend' : 'Add Photo →'}
                {cleanBgPhoto && extendPrice && !extendPrice.isFree && extendPrice.estimatedCoins > 0 ? (
                  <Text style={{color: '#FFD700'}}>{` (${extendPrice.estimatedCoins} ★)`}</Text>
                ) : cleanBgPhoto ? (
                  <Text style={{color: '#22C55E'}}>{' (Free)'}</Text>
                ) : null}
              </Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );

  // Render style mode wizard
  const renderStyleModeWizard = () => (
    <View style={[styles.wizardContainer, {maxWidth: isTablet ? 600 : '100%'}]}>
      {renderStep1()}
    </View>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background, padding: containerPadding}]}>
      {/* Style Mode Toggle */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.styleModeToggle, {maxWidth: isTablet ? 700 : '100%', alignSelf: 'center', width: '100%'}]}
        contentContainerStyle={styles.styleModeToggleContent}>
        <TouchableOpacity
          style={[
            styles.styleModeButton,
            {
              backgroundColor: styleMode === 'effects' ? colors.primary : colors.backgroundTertiary,
            },
          ]}
          onPress={() => handleModeSwitch('effects')}
          activeOpacity={0.8}>
          <Ionicons
            name="color-wand"
            size={16}
            color={styleMode === 'effects' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.styleModeButtonText, {color: styleMode === 'effects' ? '#fff' : colors.textSecondary}]}>
            Effects
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.styleModeButton,
            {
              backgroundColor: styleMode === 'synthesize' ? colors.primary : colors.backgroundTertiary,
            },
          ]}
          onPress={() => handleModeSwitch('synthesize')}
          activeOpacity={0.8}>
          <Ionicons
            name="git-compare"
            size={16}
            color={styleMode === 'synthesize' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.styleModeButtonText, {color: styleMode === 'synthesize' ? '#fff' : colors.textSecondary}]}>
            Fusion
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.styleModeButton,
            {
              backgroundColor: styleMode === 'openeyes' ? colors.primary : colors.backgroundTertiary,
            },
          ]}
          onPress={() => handleModeSwitch('openeyes')}
          activeOpacity={0.8}>
          <Ionicons
            name="eye"
            size={16}
            color={styleMode === 'openeyes' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.styleModeButtonText, {color: styleMode === 'openeyes' ? '#fff' : colors.textSecondary}]}>
            Open Eyes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.styleModeButton,
            {
              backgroundColor: styleMode === 'restore' ? colors.primary : colors.backgroundTertiary,
            },
          ]}
          onPress={() => handleModeSwitch('restore')}
          activeOpacity={0.8}>
          <Ionicons
            name="time-outline"
            size={16}
            color={styleMode === 'restore' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.styleModeButtonText, {color: styleMode === 'restore' ? '#fff' : colors.textSecondary}]}>
            Restore
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.styleModeButton,
            {
              backgroundColor: styleMode === 'refine' ? colors.primary : colors.backgroundTertiary,
            },
          ]}
          onPress={() => handleModeSwitch('refine')}
          activeOpacity={0.8}>
          <Ionicons
            name="color-filter"
            size={16}
            color={styleMode === 'refine' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.styleModeButtonText, {color: styleMode === 'refine' ? '#fff' : colors.textSecondary}]}>
            Refine
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.styleModeButton,
            {
              backgroundColor: styleMode === 'cleanBg' ? colors.primary : colors.backgroundTertiary,
            },
          ]}
          onPress={() => handleModeSwitch('cleanBg')}
          activeOpacity={0.8}>
          <Ionicons
            name="expand-outline"
            size={16}
            color={styleMode === 'cleanBg' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.styleModeButtonText, {color: styleMode === 'cleanBg' ? '#fff' : colors.textSecondary}]}>
            Extender
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.styleModeButton,
            {
              backgroundColor: styleMode === 'animate' ? colors.primary : colors.backgroundTertiary,
            },
          ]}
          onPress={() => handleModeSwitch('animate')}
          activeOpacity={0.8}>
          <Ionicons
            name="videocam"
            size={16}
            color={styleMode === 'animate' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.styleModeButtonText, {color: styleMode === 'animate' ? '#fff' : colors.textSecondary}]}>
            Animate
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.styleModeButton, {backgroundColor: colors.backgroundTertiary}]}
          onPress={() => (navigation as any).navigate('Subtitle')}
          activeOpacity={0.8}>
          <Ionicons name="text" size={16} color={colors.textSecondary} />
          <Text style={[styles.styleModeButtonText, {color: colors.textSecondary}]}>
            Subtitles
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Style Mode: Wizard UI */}
      {styleMode === 'synthesize' ? (
        renderStyleModeWizard()
      ) : styleMode === 'openeyes' ? (
        renderOpenEyesMode()
      ) : styleMode === 'restore' ? (
        renderRestoreMode()
      ) : styleMode === 'refine' ? (
        renderRefineMode()
      ) : styleMode === 'cleanBg' ? (
        renderCleanBgMode()
      ) : styleMode === 'animate' ? (
        renderAnimateMode()
      ) : (
        /* Normal Mode: Original Camera Area */
        <View style={[styles.effectsTabContainer, {maxWidth: isTablet ? 600 : '100%', alignSelf: 'center', width: '100%'}]}>
          {/* Step 2: Accessories Bar */}
          <CopilotStep
            text="Add fun accessories like hats, glasses, or jewelry to enhance your transformed photo."
            order={2}
            name="👒 Accessories">
            <WalkthroughableView>
              <AccessoriesBar />
            </WalkthroughableView>
          </CopilotStep>

          {/* Photo Picker - centered */}
          <View style={styles.effectsPhotoSection}>
            {/* Step 3: Add Photo */}
            <CopilotStep
              text="Tap here to add your photo from the camera or gallery. This is the photo that will be transformed."
              order={3}
              name="📸 Add Photo">
              <WalkthroughableView style={[styles.photoSlot, {maxWidth: '100%', flex: 1, width: '100%'}]}>
                {effectsPhoto ? (
                  <TouchableOpacity
                    style={[styles.photoSlotWrapper, {flex: 1}]}
                    onPress={showImagePickerOptions}
                    activeOpacity={0.8}>
                    <View style={[styles.photoSlotFilled, {borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}>
                      <Image source={{uri: effectsPhoto.uri}} style={styles.photoSlotImage} resizeMode="contain" />
                      <TouchableOpacity
                        style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                        onPress={(e) => {
                          e.stopPropagation();
                          setFullScreenImage(effectsPhoto.uri);
                        }}>
                        <Ionicons name="expand" size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.removePhotoBtn, {backgroundColor: colors.error}]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleClearImage();
                        }}>
                        <Text style={styles.removePhotoBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                      <Text style={styles.photoSlotLabelText}>Your Photo</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.photoSlotEmpty, {backgroundColor: colors.cardBackground, borderColor: 'transparent', aspectRatio: undefined, flex: 1}]}
                    onPress={showImagePickerOptions}
                    activeOpacity={0.8}>
                    <Ionicons name="camera" size={36} color={colors.primary} />
                    <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>
                      Add Photo
                    </Text>
                    <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                      <Text style={styles.photoSlotLabelText}>Your Photo</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </WalkthroughableView>
            </CopilotStep>
          </View>

          {/* Step 4: Generate Button - same style as Next button */}
          <CopilotStep
            text="Once you've selected a template and added your photo, tap Generate to create your magical transformation!"
            order={4}
            name="✨ Generate">
            <WalkthroughableView style={styles.wizardNavButtonsFull}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.nextButtonGradient}>
                <TouchableOpacity
                  style={styles.nextButtonTouchable}
                  onPress={handleGenerate}
                  disabled={isEffectsGenerating}
                  activeOpacity={0.9}>
                  {isEffectsGenerating ? (
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={[styles.nextButtonText, {color: '#fff'}]}>Submitting...</Text>
                    </View>
                  ) : (
                    <Text style={[styles.nextButtonText, {color: '#fff'}]}>
                      {effectsPhoto
                        ? <>{'Generate'}
                            {totalCoins > 0 ? (
                              <Text style={{color: '#FFD700'}}>{` (${totalCoins} ★)`}</Text>
                            ) : (
                              <Text style={{color: '#22C55E'}}>{' (Free)'}</Text>
                            )}
                            {' →'}</>
                        : 'Add Photo →'}
                    </Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </WalkthroughableView>
          </CopilotStep>
        </View>
      )}

      {/* Character Picker Modal */}
      <CharacterPickerModal
        visible={showCharacterPicker}
        onClose={() => setShowCharacterPicker(false)}
        onSelectCharacter={handleCharacterSelected}
      />

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        visible={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        onSelectPhoto={handlePhotoPickerSelect}
        title={photoPickerSlot === 'effects' ? 'Select Photo' : `Add Photo ${photoPickerSlot}`}
      />

      {/* Full Screen Image Modal */}
      <FullScreenImageModal
        visible={!!fullScreenImage}
        imageUri={fullScreenImage}
        onClose={() => setFullScreenImage(null)}
      />

      {/* Select Template/Accessory Modal */}
      <Modal
        visible={showSelectTemplateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSelectTemplateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.selectTemplateModal, {backgroundColor: colors.cardBackground}]}>
            <View style={[styles.selectTemplateIconContainer, {backgroundColor: colors.primary + '20'}]}>
              <Ionicons name="information-circle" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.selectTemplateTitle, {color: colors.textPrimary}]}>
              One More Step
            </Text>
            <Text style={[styles.selectTemplateText, {color: colors.textSecondary}]}>
              Please choose a scenario, an accessory, or both to transform your photo.
            </Text>
            <TouchableOpacity
              style={[styles.selectTemplateButton, {backgroundColor: colors.primary}]}
              onPress={() => setShowSelectTemplateModal(false)}
              activeOpacity={0.8}>
              <Text style={styles.selectTemplateButtonText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Synthesize Modal */}
      <Modal
        visible={showSynthesizeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSynthesizeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.selectTemplateModal, {backgroundColor: colors.cardBackground}]}>
            <View style={[styles.selectTemplateIconContainer, {backgroundColor: colors.primary + '20'}]}>
              <Ionicons name="information-circle" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.selectTemplateTitle, {color: colors.textPrimary}]}>
              One More Step
            </Text>
            <Text style={[styles.selectTemplateText, {color: colors.textSecondary}]}>
              {synthesizeModalMessage}
            </Text>
            <TouchableOpacity
              style={[styles.selectTemplateButton, {backgroundColor: colors.primary}]}
              onPress={() => setShowSynthesizeModal(false)}
              activeOpacity={0.8}>
              <Text style={styles.selectTemplateButtonText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full-Screen Mask Drawing Modal */}
      <Modal
        visible={showMaskModal && !!cleanBgPhoto && !!cleanBgPhotoDimensions}
        animationType="slide"
        onRequestClose={() => setShowMaskModal(false)}>
        {(() => {
          if (!cleanBgPhoto || !cleanBgPhotoDimensions) {
            return null;
          }
          const {canvasW, canvasH} = getCanvasDimensions();
          return (
            <View style={[styles.maskModalContainer, {backgroundColor: colors.background}]}>
              {/* Close button */}
              <TouchableOpacity
                style={styles.maskModalCloseBtn}
                onPress={() => setShowMaskModal(false)}
                activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              {/* Canvas area with pinch-to-zoom wrapping both Image and Canvas */}
              <View style={styles.maskModalCanvasArea}>
                <GestureDetector gesture={zoomComposedGesture}>
                  <Animated.View style={[{width: canvasW, height: canvasH, borderRadius: 12, overflow: 'hidden'}, zoomAnimatedStyle]}>
                    <Image
                      source={{uri: cleanBgPhoto!.uri}}
                      style={{width: canvasW, height: canvasH}}
                      resizeMode="contain"
                    />
                    <View style={[StyleSheet.absoluteFill]}>
                      <MaskDrawingCanvas
                        ref={maskCanvasRef}
                        canvasWidth={canvasW}
                        canvasHeight={canvasH}
                        brushSize={brushSize}
                        onDrawChange={setHasMaskDrawn}
                        imageUri={cleanBgPhoto!.uri}
                      />
                    </View>
                  </Animated.View>
                </GestureDetector>
                {!hasMaskDrawn && (
                  <Text style={[styles.cleanBgHint, {color: colors.textTertiary}]}>
                    Paint over areas you want removed
                  </Text>
                )}
              </View>

              {/* Controls row: Undo / Brush slider / Clear */}
              <View style={styles.cleanBgControlsRow}>
                <TouchableOpacity
                  style={[styles.cleanBgActionBtn, {backgroundColor: colors.backgroundTertiary}]}
                  onPress={() => maskCanvasRef.current?.undo()}
                  activeOpacity={0.7}>
                  <Ionicons name="arrow-undo" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cleanBgActionBtnText, {color: colors.textSecondary}]}>Undo</Text>
                </TouchableOpacity>

                <View style={styles.cleanBgSliderContainer}>
                  <Ionicons name="ellipse" size={8} color={colors.textTertiary} />
                  <GestureDetector gesture={sliderGesture}>
                    <Animated.View
                      style={[styles.cleanBgSliderTrack, {backgroundColor: colors.border}]}
                      onLayout={(e) => {
                        sliderTrackWidth.value = e.nativeEvent.layout.width;
                      }}>
                      <Animated.View
                        style={[
                          styles.cleanBgSliderFill,
                          {backgroundColor: colors.primary},
                          sliderFillStyle,
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.cleanBgSliderThumb,
                          {backgroundColor: colors.primary},
                          sliderThumbStyle,
                        ]}
                      />
                    </Animated.View>
                  </GestureDetector>
                  <Ionicons name="ellipse" size={18} color={colors.textTertiary} />
                </View>

                <TouchableOpacity
                  style={[styles.cleanBgActionBtn, {backgroundColor: colors.backgroundTertiary}]}
                  onPress={() => {
                    maskCanvasRef.current?.clearAll();
                    setHasMaskDrawn(false);
                  }}
                  activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cleanBgActionBtnText, {color: colors.textSecondary}]}>Clear</Text>
                </TouchableOpacity>
              </View>

              {/* Save / Share buttons — visible after result arrives */}
              {cleanBgResultUrl && (
                <View style={{flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12}}>
                  <TouchableOpacity
                    style={[styles.cleanBgActionBtn, {backgroundColor: colors.backgroundTertiary, paddingHorizontal: 20}]}
                    onPress={handleCleanBgSave}
                    activeOpacity={0.7}>
                    <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.cleanBgActionBtnText, {color: colors.textSecondary}]}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cleanBgActionBtn, {backgroundColor: colors.backgroundTertiary, paddingHorizontal: 20}]}
                    onPress={handleCleanBgShare}
                    activeOpacity={0.7}>
                    <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.cleanBgActionBtnText, {color: colors.textSecondary}]}>Share</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Clean button */}
              <View style={styles.maskModalButtonContainer}>
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.nextButtonGradient}>
                  <TouchableOpacity
                    style={styles.nextButtonTouchable}
                    onPress={handleMaskCleanGenerate}
                    disabled={isCleanBgLoading}
                    activeOpacity={0.9}>
                    {isCleanBgLoading ? (
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={[styles.nextButtonText, {color: '#fff'}]}>Processing...</Text>
                      </View>
                    ) : (
                      <Text style={[styles.nextButtonText, {color: '#fff'}]}>
                        Remove →
                      </Text>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* Animate Result Modal */}
      <AnimateResultModal
        visible={showAnimateResult}
        onClose={() => {
          setShowAnimateResult(false);
          setAnimateVideoResult(null);
        }}
        videoResult={animateVideoResult}
      />

      {/* Error Dialog */}
      <CustomDialog
        visible={errorDialog.visible}
        icon={errorDialog.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
        iconColor={errorDialog.type === 'success' ? colors.success : colors.error}
        title={errorDialog.title}
        message={errorDialog.message}
        buttons={[
          {text: 'Got it', onPress: hideErrorDialog, style: 'default'},
        ]}
        onClose={hideErrorDialog}
        autoDismissMs={errorDialog.type === 'success' ? 2500 : undefined}
      />

      {/* Photo Source Picker Modal */}
      <Modal
        visible={showPhotoSourcePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoSourcePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.photoSourceModal, {backgroundColor: colors.cardBackground}]}>
            <Text style={[styles.photoSourceTitle, {color: colors.textPrimary}]}>
              Add Photo 2
            </Text>
            <Text style={[styles.photoSourceSubtitle, {color: colors.textSecondary}]}>
              Choose source
            </Text>
            <TouchableOpacity
              style={[styles.photoSourceOption, {backgroundColor: colors.primary + '15'}]}
              onPress={() => handlePhotoSourceChoice('character')}
              activeOpacity={0.8}>
              <View style={[styles.photoSourceIconContainer, {backgroundColor: colors.primary}]}>
                <Ionicons name="star" size={20} color="#fff" />
              </View>
              <Text style={[styles.photoSourceOptionText, {color: colors.textPrimary}]}>
                Celebrity / Character
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoSourceOption, {backgroundColor: colors.secondary + '15'}]}
              onPress={() => handlePhotoSourceChoice('photos')}
              activeOpacity={0.8}>
              <View style={[styles.photoSourceIconContainer, {backgroundColor: colors.secondary || '#8B5CF6'}]}>
                <Ionicons name="images" size={20} color="#fff" />
              </View>
              <Text style={[styles.photoSourceOptionText, {color: colors.textPrimary}]}>
                My Photos
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoSourceCancelButton, {borderColor: colors.border}]}
              onPress={() => setShowPhotoSourcePicker(false)}
              activeOpacity={0.8}>
              <Text style={[styles.photoSourceCancelText, {color: colors.textSecondary}]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  shortcutItem: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    width: 74,
  },
  shortcutThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  shortcutName: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  shortcutCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    paddingBottom: 8,
  },
  cameraArea: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    minHeight: 200,
    paddingBottom: 60,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  cameraAreaDisabled: {
    opacity: 0.6,
  },
  // Effects tab styles
  effectsTabContainer: {
    flex: 1,
  },
  effectsPhotoSection: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  photoPreviewArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonInside: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  placeholderContainer: {
    alignItems: 'center',
    padding: 20,
  },
  placeholderHint: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
  },
  // Selection Preview
  selectionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  previewItemImage: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  previewItemIcon: {
    fontSize: 20,
  },
  previewItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 100,
  },
  previewAccessories: {
    flexDirection: 'row',
    gap: 6,
  },
  previewAccessoryItem: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewAccessoryIcon: {
    fontSize: 18,
  },
  previewAccessoryMore: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Generate Button
  generateButtonContainer: {
    alignSelf: 'center',
    width: '100%',
    marginTop: 16,
  },
  generateButtonMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
  },
  generateButtonMainText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  cameraIconOuter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  flatCameraIcon: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cameraBody: {
    width: '100%',
    height: '75%',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraLens: {
    width: '45%',
    aspectRatio: 1,
    borderRadius: 100,
    borderWidth: 3,
  },
  cameraFlash: {
    position: 'absolute',
    top: 0,
    left: '15%',
    width: '25%',
    height: '20%',
    borderRadius: 2,
  },
  placeholderTitle: {
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  placeholderSubtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  actionHint: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionHintText: {
    fontWeight: '600',
  },
  imagePreviewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  // Selection Overlay (on photo)
  selectionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  selectionOverlayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  overlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  overlayItemIcon: {
    fontSize: 16,
  },
  overlayItemLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 80,
  },
  overlayAccessories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overlayAccessoryItem: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayAccessoryIcon: {
    fontSize: 16,
  },
  overlayMoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  overlayHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
  clearButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingCard: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 24,
    marginHorizontal: 20,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  loadingTemplateThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginBottom: 20,
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  loadingText: {
    marginBottom: 24,
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  errorCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
    marginHorizontal: 20,
    borderWidth: 1,
  },
  errorIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 32,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  errorTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Style Mode Toggle
  styleModeToggle: {
    flexGrow: 0,
    marginBottom: 8,
  },
  styleModeToggleContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  styleModeButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  styleModeButtonText: {
    fontSize: 9,
    fontWeight: '600',
  },
  // Reference Section
  referenceSection: {
    marginBottom: 16,
  },
  referenceSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  referenceSectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  referenceScrollView: {
    flexDirection: 'row',
  },
  referencePhotoContainer: {
    position: 'relative',
    marginRight: 12,
  },
  referencePhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  removeRefButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeRefButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addReferenceButton: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addReferenceIcon: {
    fontSize: 28,
    fontWeight: '300',
  },
  addReferenceText: {
    fontSize: 11,
    marginTop: 2,
  },
  yourPhotoLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  yourPhotoLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Ideas Section
  ideasSection: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  ideasTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  ideasText: {
    fontSize: 13,
    lineHeight: 20,
  },
  // Wizard Styles
  wizardContainer: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
  },
  stepIndicatorContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  wizardStepContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  referencePhotosGrid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  referencePhotoLarge: {
    width: 120,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  referencePhotoLargeImage: {
    width: '100%',
    height: '100%',
  },
  removeRefButtonLarge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addReferenceLarge: {
    width: 120,
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addReferenceIconLarge: {
    fontSize: 32,
    fontWeight: '300',
    marginBottom: 4,
  },
  addReferenceLargeText: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  wizardNavButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  wizardNavButtonsFull: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
  },
  nextButtonGradient: {
    borderRadius: 16,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonTouchable: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    shadowOpacity: 0,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  wizardBackButton: {
    flex: 1,
    maxWidth: 160,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  wizardBackButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  yourPhotoArea: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yourPhotoAreaEmpty: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yourPhotoPlaceholder: {
    alignItems: 'center',
  },
  yourPhotoIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  yourPhotoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  reviewPhotoBox: {
    alignItems: 'center',
  },
  reviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewPhoto: {
    width: 100,
    height: 130,
    borderRadius: 10,
  },
  reviewArrow: {
    paddingHorizontal: 6,
  },
  reviewArrowText: {
    fontSize: 24,
    fontWeight: '300',
  },
  generateButtonGradient: {
    flex: 1,
    borderRadius: 16,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  generateButtonTouchable: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    shadowOpacity: 0,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  // Two photos layout (Step 1)
  twoPhotosContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
    maxHeight: '70%',
  },
  photoSlot: {
    alignItems: 'center',
    flex: 1,
    maxWidth: '50%',
  },
  photoSlotLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photoSlotWrapper: {
    width: '100%',
    position: 'relative',
    marginTop: 10,
  },
  photoSlotLabelBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  photoSlotLabelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photoSlotEmpty: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoSlotFilled: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  photoSlotImage: {
    width: '100%',
    height: '100%',
  },
  photoSlotIcon: {
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 4,
  },
  photoSlotText: {
    fontSize: 12,
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
  removePhotoBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  characterBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterBadgeText: {
    fontSize: 12,
  },
  photosPlusSign: {
    paddingHorizontal: 4,
  },
  photosPlusText: {
    fontSize: 24,
    fontWeight: '300',
  },
  // Step 2 layout
  step2Container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 80,
  },
  step2TopContent: {
    flex: 1,
  },
  step2Content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  step2Buttons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  step2BackButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  selectedActionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  selectedActionIcon: {
    fontSize: 32,
  },
  selectedActionLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  noActionBox: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  noActionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedDestinationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
    marginTop: 12,
  },
  selectedDestinationIcon: {
    fontSize: 18,
  },
  selectedDestinationLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  combinedHint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  generateButtonLarge: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  generateButtonLargeText: {
    fontSize: 18,
    fontWeight: '700',
  },
  swipeHint: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  selectTemplateModal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  selectTemplateIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  selectTemplateTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  selectTemplateText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  selectTemplateButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  selectTemplateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoSourceModal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  photoSourceTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  photoSourceSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  photoSourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    gap: 12,
  },
  photoSourceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoSourceOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  photoSourceCancelButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 4,
  },
  photoSourceCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Clean BG mask drawing styles
  cleanBgCanvasSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cleanBgCanvasContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cleanBgOverlayBtn: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cleanBgCloseBtn: {
    top: 8,
    right: 8,
  },
  cleanBgExpandBtn: {
    top: 8,
    left: 8,
  },
  cleanBgHint: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cleanBgControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  cleanBgActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  cleanBgActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cleanBgSliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cleanBgSliderTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  cleanBgSliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  cleanBgSliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    top: -7,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  // Full-screen mask drawing modal
  maskModalContainer: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 34,
  },
  maskModalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  maskModalCanvasArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  maskModalButtonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});

export default CameraArea;
