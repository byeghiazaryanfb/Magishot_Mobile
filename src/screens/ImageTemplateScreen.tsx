import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  PanResponder,
  Animated,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSelector} from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../theme/ThemeContext';
import GifPlayer from '../components/GifPlayer';
import GradientButton from '../components/GradientButton';
import PhotoPickerModal from '../components/PhotoPickerModal';
import CustomDialog from '../components/CustomDialog';
import FullScreenImageModal from '../components/FullScreenImageModal';
import {ImageAsset} from '../services/imageTransform';
import {config} from '../utils/config';
import {RootStackParamList} from '../navigation/RootNavigator';
import type {RootState} from '../store';
import {useAppDispatch} from '../store/hooks';
import {addPendingImageJob} from '../store/slices/imageNotificationSlice';
import {fetchCoinBalance} from '../store/slices/authSlice';

type ImageTemplateDetailRouteProp = RouteProp<RootStackParamList, 'ImageTemplateDetail'>;

interface ImageSlot {
  id: number;
  uri: string | null;
  label: string;
}

const HEADER_HEIGHT = 56;
const BUTTON_AREA_HEIGHT = 100; // button + bottom padding

const ImageTemplateScreen: React.FC = () => {
  const {colors, isDark} = useTheme();
  const {width, height: screenHeight} = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ImageTemplateDetailRouteProp>();
  const {template: initialTemplate, templates, currentIndex: initialIndex} = route.params;
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const dispatch = useAppDispatch();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [creationAnimation, setCreationAnimation] = useState(true);
  const [dialog, setDialog] = useState<{visible: boolean; title: string; message: string; type: 'error' | 'success'}>({visible: false, title: '', message: '', type: 'success'});
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [fullScreenUri, setFullScreenUri] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const template = templates[currentIndex] || initialTemplate;
  const photoCount = template.requiredPhotoCount || template.maxImages || 1;
  const minRequired = template.requiredPhotoCount || template.minImages || 1;
  const isMultiPhoto = photoCount > 1;

  const [imageSlots, setImageSlots] = useState<ImageSlot[]>(
    Array.from({length: photoCount}, (_, i) => ({
      id: i,
      uri: null,
      label: `Photo ${i + 1}`,
    })),
  );

  const prevPhotoCountRef = useRef(photoCount);
  if (prevPhotoCountRef.current !== photoCount) {
    prevPhotoCountRef.current = photoCount;
    setImageSlots(
      Array.from({length: photoCount}, (_, i) => ({
        id: i,
        uri: null,
        label: `Photo ${i + 1}`,
      })),
    );
  }

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // ── Sizing: everything must fit on screen ──
  const availableHeight = screenHeight - HEADER_HEIGHT - BUTTON_AREA_HEIGHT;
  // Reserve space: description ~30, progress ~40 (multi only), checkbox ~36, section label ~24, gaps ~30
  const chromeHeight = (template.description ? 30 : 0)
    + (isMultiPhoto ? 36 : 0)
    + (template.videoAnimationEnabled ? 36 : 0)
    + 24 // section label
    + 30; // misc gaps
  const contentHeight = availableHeight - chromeHeight;

  // Split remaining space: dominant preview, compact slots
  const previewFraction = isMultiPhoto ? 0.72 : 0.78;
  const gifAreaHeight = contentHeight * previewFraction;
  const slotsAreaHeight = contentHeight * (1 - previewFraction);

  // GIF preview: fit within gifAreaHeight with 3:4 aspect ratio
  const gifMaxWidth = isMultiPhoto ? width * 0.75 : width * 0.8;
  const gifHeightFromWidth = gifMaxWidth * (4 / 3);
  const gifHeight = Math.min(gifAreaHeight - 16, gifHeightFromWidth);
  const gifWidth = gifHeight * (3 / 4);

  // Slot sizing: compact — fit within slotsAreaHeight with hard cap
  const slotPadding = 20;
  const slotGap = 8;
  const slotsPerRow = photoCount <= 2 ? photoCount : photoCount <= 4 ? 2 : 3;
  const numRows = Math.ceil(photoCount / slotsPerRow);
  const totalVerticalGaps = (numRows - 1) * slotGap;
  const slotsAvailableH = slotsAreaHeight - totalVerticalGaps - 20; // 20 for label + padding
  const maxSlotHeight = Math.min(slotsAvailableH / numRows, 90); // hard cap at 90
  const totalHorizontalGaps = (slotsPerRow - 1) * slotGap;
  const maxSlotWidthFromRow = (width - slotPadding * 2 - totalHorizontalGaps) / slotsPerRow;
  const slotWidthFromHeight = maxSlotHeight / 1.1;
  const slotWidth = Math.min(slotWidthFromHeight, maxSlotWidthFromRow, 140); // cap width too
  const slotHeight = slotWidth * 1.1;

  const SWIPE_THRESHOLD = 80;

  const filledSlots = imageSlots.filter(slot => slot.uri !== null).length;
  const canGenerate = filledSlots >= minRequired;
  const progress = filledSlots / photoCount;

  const goToNextTemplate = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx < templates.length - 1 && !isAnimating) {
      setIsAnimating(true);
      Animated.parallel([
        Animated.timing(translateY, {toValue: -screenHeight, duration: 200, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0, duration: 200, useNativeDriver: true}),
      ]).start(() => {
        const newIndex = idx + 1;
        setCurrentIndex(newIndex);
        currentIndexRef.current = newIndex;
        const t = templates[newIndex] || initialTemplate;
        const c = t.requiredPhotoCount || t.maxImages || 1;
        setImageSlots(Array.from({length: c}, (_, i) => ({id: i, uri: null, label: `Photo ${i + 1}`})));
        translateY.setValue(screenHeight);
        Animated.parallel([
          Animated.timing(translateY, {toValue: 0, duration: 200, useNativeDriver: true}),
          Animated.timing(opacity, {toValue: 1, duration: 200, useNativeDriver: true}),
        ]).start(() => setIsAnimating(false));
      });
    } else {
      Animated.spring(translateY, {toValue: 0, useNativeDriver: true}).start();
    }
  }, [templates.length, translateY, opacity, screenHeight, isAnimating, initialTemplate, templates]);

  const goToPrevTemplate = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx > 0 && !isAnimating) {
      setIsAnimating(true);
      Animated.parallel([
        Animated.timing(translateY, {toValue: screenHeight, duration: 200, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0, duration: 200, useNativeDriver: true}),
      ]).start(() => {
        const newIndex = idx - 1;
        setCurrentIndex(newIndex);
        currentIndexRef.current = newIndex;
        const t = templates[newIndex] || initialTemplate;
        const c = t.requiredPhotoCount || t.maxImages || 1;
        setImageSlots(Array.from({length: c}, (_, i) => ({id: i, uri: null, label: `Photo ${i + 1}`})));
        translateY.setValue(-screenHeight);
        Animated.parallel([
          Animated.timing(translateY, {toValue: 0, duration: 200, useNativeDriver: true}),
          Animated.timing(opacity, {toValue: 1, duration: 200, useNativeDriver: true}),
        ]).start(() => setIsAnimating(false));
      });
    } else {
      Animated.spring(translateY, {toValue: 0, useNativeDriver: true}).start();
    }
  }, [translateY, opacity, screenHeight, isAnimating, initialTemplate, templates]);

  const goToNextRef = useRef(goToNextTemplate);
  const goToPrevRef = useRef(goToPrevTemplate);
  goToNextRef.current = goToNextTemplate;
  goToPrevRef.current = goToPrevTemplate;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => translateY.setValue(gs.dy * 0.5),
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -SWIPE_THRESHOLD) goToNextRef.current();
        else if (gs.dy > SWIPE_THRESHOLD) goToPrevRef.current();
        else Animated.spring(translateY, {toValue: 0, useNativeDriver: true}).start();
      },
    }),
  ).current;

  const handlePickImage = (slotId?: number) => {
    setSelectedSlotId(slotId ?? 0);
    setShowPhotoPicker(true);
  };

  const handlePhotoSelected = (photo: ImageAsset) => {
    const targetSlot = selectedSlotId ?? 0;
    setImageSlots(prev =>
      prev.map(slot => (slot.id === targetSlot ? {...slot, uri: photo.uri} : slot)),
    );
    setShowPhotoPicker(false);
    setSelectedSlotId(null);
  };

  const handleRemoveImage = (slotId: number) => {
    setImageSlots(prev =>
      prev.map(slot => (slot.id === slotId ? {...slot, uri: null} : slot)),
    );
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      handlePickImage(imageSlots.find(s => !s.uri)?.id ?? 0);
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      const filledImages = imageSlots.filter(slot => slot.uri !== null);

      if (isMultiPhoto) {
        filledImages.forEach((slot, index) => {
          if (slot.uri) {
            formData.append('images', {uri: slot.uri, type: 'image/jpeg', name: `photo_${index + 1}.jpg`} as any);
          }
        });
      } else {
        formData.append('image', {uri: filledImages[0].uri, type: 'image/jpeg', name: 'user_photo.jpg'} as any);
      }

      if (template.videoAnimationEnabled) {
        formData.append('creationAnimation', String(creationAnimation));
      }

      const headers: Record<string, string> = {'Content-Type': 'multipart/form-data'};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const url = `${config.apiBaseUrl}/api/VideoTemplates/${template.id}/generate-image`;
      console.log('[ImageTemplate] POST', url);
      console.log('[ImageTemplate] photos:', filledImages.length, 'templateId:', template.id);

      const response = await fetch(url, {method: 'POST', body: formData, headers});

      console.log('[ImageTemplate] response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.log('[ImageTemplate] error body:', errorText);
        let errorMessage = 'Failed to generate image';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || `Server error: ${response.status}`;
        } catch {
          errorMessage = errorText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.photoId) dispatch(addPendingImageJob({photoId: result.photoId}));
      if (accessToken) dispatch(fetchCoinBalance(accessToken));

      setDialog({visible: true, title: 'Generation Started', message: "You'll be notified when your image is ready.", type: 'success'});
      // Navigate back to templates list after short delay
      setTimeout(() => navigation.goBack(), 1500);
    } catch (error) {
      console.error('Image generation error:', error);
      setDialog({visible: true, title: 'Generation Failed', message: error instanceof Error ? error.message : 'Failed to generate image. Please try again.', type: 'error'});
    } finally {
      setIsGenerating(false);
    }
  };

  const renderSlot = (slot: ImageSlot, index: number) => (
    <TouchableOpacity
      key={slot.id}
      style={[
        styles.slot,
        {
          width: slotWidth,
          height: slotHeight,
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: slot.uri
            ? colors.primary
            : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
          marginRight: (index + 1) % slotsPerRow === 0 ? 0 : slotGap,
        },
      ]}
      onPress={() =>
        slot.uri
          ? (() => { setFullScreenUri(slot.uri); setShowFullScreen(true); })()
          : handlePickImage(slot.id)
      }
      activeOpacity={0.7}>
      {slot.uri ? (
        <>
          <Image source={{uri: slot.uri}} style={styles.slotImage} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)']} style={styles.slotOverlay} />
          {isMultiPhoto && (
            <View style={styles.slotNumberBadge}>
              <Text style={styles.slotNumberText}>{index + 1}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveImage(slot.id)}>
            <Ionicons name="close" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.replaceButton} onPress={() => handlePickImage(slot.id)}>
            <Ionicons name="camera-outline" size={14} color="#fff" />
          </TouchableOpacity>
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
          </View>
        </>
      ) : (
        <View style={styles.emptySlot}>
          {isMultiPhoto && (
            <View style={[styles.emptySlotNumber, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}>
              <Text style={[styles.emptySlotNumberText, {color: colors.textTertiary}]}>{index + 1}</Text>
            </View>
          )}
          <View style={[styles.addIconCircle, {borderColor: colors.textTertiary, width: slotWidth * 0.35, height: slotWidth * 0.35, borderRadius: slotWidth * 0.175}]}>
            <Ionicons name="add" size={slotWidth * 0.2} color={colors.textTertiary} />
          </View>
          <Text style={[styles.slotText, {color: colors.textTertiary}]}>
            {isMultiPhoto ? 'Add' : 'Add Photo'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.backgroundSecondary, height: HEADER_HEIGHT}]}>
        <TouchableOpacity
          style={[styles.backButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
          onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]} numberOfLines={1}>
            {template.displayName}
          </Text>
          <Text style={[styles.templateCounter, {color: colors.textSecondary}]}>
            {currentIndex + 1} / {templates.length}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main content — no scroll, flex-fitted */}
      <Animated.View
        style={[styles.content, {transform: [{translateY}], opacity}]}
        {...panResponder.panHandlers}>

        {/* GIF Preview */}
        <View style={[styles.gifSection, {height: gifAreaHeight}]}>
          <View
            style={[
              styles.gifWrapper,
              {width: gifWidth, height: gifHeight, shadowColor: isDark ? '#000' : '#333'},
            ]}>
            <GifPlayer uri={template.gifUrl} style={styles.gif} resizeMode="cover" />
            {isMultiPhoto && (
              <View style={styles.photoCountBadge}>
                <Ionicons name="images-outline" size={11} color="#fff" />
                <Text style={styles.photoCountText}>{photoCount} photos</Text>
              </View>
            )}
          </View>
          {templates.length > 1 && (
            <View style={styles.swipeIndicators}>
              {currentIndex > 0 && (
                <View style={styles.swipeHint}>
                  <Ionicons name="chevron-up" size={12} color={colors.textTertiary} />
                  <Text style={[styles.swipeHintText, {color: colors.textTertiary}]}>Prev</Text>
                </View>
              )}
              {currentIndex < templates.length - 1 && (
                <View style={styles.swipeHint}>
                  <Text style={[styles.swipeHintText, {color: colors.textTertiary}]}>Next</Text>
                  <Ionicons name="chevron-down" size={12} color={colors.textTertiary} />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Description */}
        {template.description ? (
          <Text style={[styles.description, {color: colors.textSecondary}]} numberOfLines={2}>
            {template.description}
          </Text>
        ) : null}

        {/* Progress (multi-photo only) */}
        {isMultiPhoto && (
          <View style={styles.progressSection}>
            <View style={[styles.progressBarContainer, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}]}>
              <LinearGradient
                colors={['#FF1B6D', '#A855F7']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={[styles.progressBar, {width: `${progress * 100}%`}]}
              />
            </View>
            <Text style={[styles.progressText, {color: colors.textSecondary}]}>
              {filledSlots === 0
                ? `Add ${photoCount} photos to get started`
                : filledSlots < minRequired
                  ? `Add ${minRequired - filledSlots} more to continue`
                  : canGenerate && filledSlots < photoCount
                    ? `${filledSlots}/${photoCount} \u2013 add ${photoCount - filledSlots} more (optional)`
                    : 'Ready to generate!'}
            </Text>
          </View>
        )}

        {/* Photo Slots */}
        <View style={[styles.slotsSection, {height: slotsAreaHeight, paddingHorizontal: slotPadding}]}>
          <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>
            {isMultiPhoto ? 'YOUR PHOTOS' : 'YOUR PHOTO'}
          </Text>
          <View style={styles.slotsContainer}>
            {imageSlots.map((slot, index) => renderSlot(slot, index))}
          </View>
        </View>

        {/* Creation Animation Checkbox */}
        {template.videoAnimationEnabled && (
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setCreationAnimation(prev => !prev)}
            activeOpacity={0.7}>
            <Ionicons
              name={creationAnimation ? 'checkbox' : 'square-outline'}
              size={22}
              color={creationAnimation ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.checkboxLabel, {color: colors.textPrimary}]}>
              Creation Animation
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Generate Button — fixed at bottom */}
      <View style={[styles.buttonSection, {height: BUTTON_AREA_HEIGHT, backgroundColor: colors.background}]}>
        <GradientButton
          title={
            isGenerating
              ? 'Submitting...'
              : !canGenerate
                ? `Add ${minRequired - filledSlots} Photo${minRequired - filledSlots !== 1 ? 's' : ''}`
                : 'Generate'
          }
          onPress={handleGenerate}
          disabled={isGenerating}
          loading={isGenerating}
        />
      </View>

      {/* Modals */}
      <PhotoPickerModal
        visible={showPhotoPicker}
        onClose={() => { setShowPhotoPicker(false); setSelectedSlotId(null); }}
        onSelectPhoto={handlePhotoSelected}
        title={isMultiPhoto && selectedSlotId !== null ? `Select Photo ${selectedSlotId + 1}` : 'Select Photo'}
      />
      <FullScreenImageModal
        visible={showFullScreen}
        imageUri={fullScreenUri}
        onClose={() => { setShowFullScreen(false); setFullScreenUri(null); }}
      />
      <CustomDialog
        visible={dialog.visible}
        icon={dialog.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
        iconColor={dialog.type === 'success' ? colors.success : colors.error}
        title={dialog.title}
        message={dialog.message}
        buttons={[{text: 'Got it', onPress: () => setDialog(prev => ({...prev, visible: false})), style: 'default'}]}
        onClose={() => setDialog(prev => ({...prev, visible: false}))}
        autoDismissMs={dialog.type === 'success' ? 2500 : undefined}
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
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  templateCounter: {
    fontSize: 11,
    marginTop: 1,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
  // GIF
  gifSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: '#000',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  photoCountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  swipeIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    gap: 20,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  swipeHintText: {
    fontSize: 10,
  },
  // Description
  description: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  // Progress
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
  },
  // Slots
  slotsSection: {
    justifyContent: 'flex-start',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  slot: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 8,
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  slotOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  slotNumberBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotNumberText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  emptySlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  emptySlotNumber: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySlotNumberText: {
    fontSize: 10,
    fontWeight: '600',
  },
  addIconCircle: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  slotText: {
    fontSize: 10,
    fontWeight: '500',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,71,87,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replaceButton: {
    position: 'absolute',
    top: 6,
    right: 32,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    position: 'absolute',
    bottom: 6,
    right: 6,
  },
  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Button
  buttonSection: {
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});

export default ImageTemplateScreen;
