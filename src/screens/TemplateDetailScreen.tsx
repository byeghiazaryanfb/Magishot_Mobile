import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../theme/ThemeContext';
import GifPlayer from '../components/GifPlayer';
import GradientButton from '../components/GradientButton';
import PhotoPickerModal from '../components/PhotoPickerModal';
import FullScreenImageModal from '../components/FullScreenImageModal';
import CustomDialog from '../components/CustomDialog';
import AiConsentDialog from '../components/AiConsentDialog';
import {ImageAsset} from '../services/imageTransform';
import {config} from '../utils/config';
import {RootStackParamList} from '../navigation/RootNavigator';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {addPendingJob} from '../store/slices/videoNotificationSlice';
import {fetchCoinBalance} from '../store/slices/authSlice';
import {useAiConsent} from '../hooks/useAiConsent';

type TemplateDetailRouteProp = RouteProp<RootStackParamList, 'TemplateDetail'>;

interface ImageSlot {
  id: number;
  uri: string | null;
  label: string;
}

interface AspectRatioOption {
  id: string;
  label: string;
  value: string;
  icon: string;
}

const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {id: '9:16', label: 'Reels', value: '9:16', icon: 'phone-portrait-outline'},
  {id: '16:9', label: 'YouTube', value: '16:9', icon: 'phone-landscape-outline'},
];

const getPreviewDimensions = (ratio: string, maxHeight: number = 300, maxWidth: number = 340) => {
  const [w, h] = ratio.split(':').map(Number);
  const aspectRatio = w / h;

  if (aspectRatio >= 1) {
    const width = maxWidth;
    const height = width / aspectRatio;
    return { width, height };
  } else {
    const height = maxHeight;
    const width = height * aspectRatio;
    return { width, height };
  }
};

const TemplateDetailScreen: React.FC = () => {
  const {colors, isDark} = useTheme();
  const {width} = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<TemplateDetailRouteProp>();
  const {template} = route.params;
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(state => state.auth.accessToken);
  const {requireConsent, consentVisible, onConsentAccept, onConsentDecline} = useAiConsent();

  const photoCount = template.requiredPhotoCount || template.maxImages;
  const minRequired = template.requiredPhotoCount || template.minImages;

  const [imageSlots, setImageSlots] = useState<ImageSlot[]>(
    Array.from({length: photoCount}, (_, i) => ({
      id: i,
      uri: null,
      label: `Photo ${i + 1}`,
    })),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('9:16');
  const [creationAnimation, setCreationAnimation] = useState(true);
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'error' | 'success';
  }>({visible: false, title: '', message: '', type: 'error'});

  const slotPadding = 20;
  const slotGap = 8;
  const slotsPerRow = photoCount <= 2 ? photoCount : photoCount <= 4 ? 2 : 3;
  const totalGaps = (slotsPerRow - 1) * slotGap;
  const rawSlotWidth = (width - slotPadding * 2 - totalGaps) / slotsPerRow;
  const slotWidth = Math.min(rawSlotWidth, 140);
  const slotHeight = slotWidth * 1.1;

  const handlePickImage = (slotId: number) => {
    setSelectedSlotId(slotId);
    setShowPhotoPicker(true);
  };

  const handlePhotoSelected = (photo: ImageAsset) => {
    if (selectedSlotId !== null) {
      setImageSlots(prev =>
        prev.map(slot =>
          slot.id === selectedSlotId ? {...slot, uri: photo.uri} : slot,
        ),
      );
    }
    setShowPhotoPicker(false);
    setSelectedSlotId(null);
  };

  const handleRemoveImage = (slotId: number) => {
    setImageSlots(prev =>
      prev.map(slot => (slot.id === slotId ? {...slot, uri: null} : slot)),
    );
  };

  const filledSlots = imageSlots.filter(slot => slot.uri !== null).length;
  const canGenerate = filledSlots >= minRequired;
  const progress = filledSlots / photoCount;

  const showDialog = (type: 'success' | 'error', title: string, message: string) => {
    setDialog({visible: true, title, message, type});
  };

  const hideDialog = () => {
    const wasSuccess = dialog.type === 'success';
    setDialog(prev => ({...prev, visible: false}));
    if (wasSuccess) {
      navigation.goBack();
    }
  };

  const handleGenerate = async () => {
    if (!(await requireConsent())) return;
    if (!canGenerate) {
      Alert.alert(
        'More Photos Needed',
        `Please add at least ${minRequired} photo${minRequired > 1 ? 's' : ''} to generate the video.`,
      );
      return;
    }

    try {
      setIsGenerating(true);

      const formData = new FormData();

      const filledImages = imageSlots.filter(slot => slot.uri !== null);
      filledImages.forEach((slot, index) => {
        if (slot.uri) {
          formData.append('images', {
            uri: slot.uri,
            type: 'image/jpeg',
            name: `photo_${index + 1}.jpg`,
          } as any);
        }
      });

      formData.append('templateId', template.id);
      formData.append('durationSeconds', '5');
      formData.append('aspectRatio', selectedAspectRatio);
      if (template.videoAnimationEnabled) {
        formData.append('creationAnimation', String(creationAnimation));
      }

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiVideo/generate`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to generate video';
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
      dispatch(addPendingJob({videoId: result.videoId}));
      showDialog('success', 'Video Queued', "You'll be notified when your video is ready.");

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error: any) {
      showDialog(
        'error',
        'Generation Failed',
        error instanceof Error ? error.message : 'Failed to generate video. Please try again.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.backgroundSecondary}]}>
        <TouchableOpacity
          style={[styles.backButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
          onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]} numberOfLines={1}>
            {template.displayName}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>

        {/* GIF Preview */}
        <View style={styles.gifSection}>
          <View style={styles.gifContainer}>
            <View
              style={[
                styles.gifWrapper,
                {
                  shadowColor: isDark ? '#000' : '#333',
                  ...getPreviewDimensions(selectedAspectRatio),
                },
              ]}>
              <GifPlayer
                uri={template.gifUrl}
                style={styles.gif}
                resizeMode="cover"
              />
            </View>
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.sectionTitle, {color: colors.primary}]} numberOfLines={2}>
              {template.description || 'Add Your Photos'}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={[styles.progressBarContainer, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}]}>
            <LinearGradient
              colors={['#FF1B6D', '#A855F7']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={[styles.progressBar, {width: `${progress * 100}%`}]}
            />
          </View>

          <Text style={[styles.sectionSubtitle, {color: colors.textSecondary}]}>
            {filledSlots === 0
              ? `Tap to add ${photoCount} photo${photoCount > 1 ? 's' : ''}`
              : filledSlots < minRequired
                ? `Add ${minRequired - filledSlots} more photo${minRequired - filledSlots > 1 ? 's' : ''} to continue`
                : canGenerate && filledSlots < photoCount
                  ? `You can add ${photoCount - filledSlots} more photo${photoCount - filledSlots > 1 ? 's' : ''} (optional)`
                  : 'All photos added! Ready to generate'}
          </Text>
        </View>

        {/* Aspect Ratio Selector */}
        <View style={styles.aspectRatioSection}>
          <Text style={[styles.aspectRatioLabel, {color: colors.textSecondary}]}>
            Aspect Ratio
          </Text>
          <View style={styles.aspectRatioOptions}>
            {ASPECT_RATIO_OPTIONS.map(option => {
              const isSelected = selectedAspectRatio === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.aspectRatioOption,
                    {
                      backgroundColor: isSelected
                        ? colors.primary + '18'
                        : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.03)',
                      borderColor: isSelected
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                  onPress={() => setSelectedAspectRatio(option.id)}
                  activeOpacity={0.7}>
                  <Ionicons
                    name={option.icon as any}
                    size={13}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.aspectRatioText,
                      {color: isSelected ? colors.primary : colors.textSecondary},
                    ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Image Slots Grid */}
        <View style={[styles.slotsSection, {paddingHorizontal: slotPadding}]}>
          <View style={styles.slotsContainer}>
            {imageSlots.map((slot, index) => (
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
                onPress={() => slot.uri ? setFullScreenImageUri(slot.uri) : handlePickImage(slot.id)}
                activeOpacity={0.7}>
                {slot.uri ? (
                  <>
                    <Image
                      source={{uri: slot.uri}}
                      style={styles.slotImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.4)']}
                      style={styles.slotOverlay}
                    />
                    <View style={styles.slotNumberBadge}>
                      <Text style={styles.slotNumberText}>{index + 1}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveImage(slot.id)}>
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.replaceButton}
                      onPress={() => handlePickImage(slot.id)}>
                      <Ionicons name="camera-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={24} color="#4ADE80" />
                    </View>
                  </>
                ) : (
                  <View style={styles.emptySlot}>
                    <View style={[styles.emptySlotNumber, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}>
                      <Text style={[styles.emptySlotNumberText, {color: colors.textTertiary}]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={[styles.addIconCircle, {borderColor: colors.textTertiary}]}>
                      <Ionicons
                        name="add"
                        size={28}
                        color={colors.textTertiary}
                      />
                    </View>
                    <Text style={[styles.slotText, {color: colors.textTertiary}]}>
                      Add Photo
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
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
              size={24}
              color={creationAnimation ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.checkboxLabel, {color: colors.textPrimary}]}>
              Creation Animation
            </Text>
          </TouchableOpacity>
        )}

        {/* Generate Button */}
        <View style={styles.buttonSection}>
          <GradientButton
            title={isGenerating ? 'Submitting...' : 'Generate Video'}
            onPress={handleGenerate}
            disabled={!canGenerate || isGenerating}
            loading={isGenerating}
          />
        </View>

        <View style={{height: 120}} />
      </ScrollView>

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        visible={showPhotoPicker}
        onClose={() => {
          setShowPhotoPicker(false);
          setSelectedSlotId(null);
        }}
        onSelectPhoto={handlePhotoSelected}
        title={`Select Photo ${selectedSlotId !== null ? selectedSlotId + 1 : ''}`}
      />

      {/* Full Screen Image Modal */}
      <FullScreenImageModal
        visible={!!fullScreenImageUri}
        imageUri={fullScreenImageUri}
        onClose={() => setFullScreenImageUri(null)}
      />

      {/* Success / Error Dialog */}
      <CustomDialog
        visible={dialog.visible}
        icon={dialog.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
        iconColor={dialog.type === 'success' ? colors.success : colors.error}
        title={dialog.title}
        message={dialog.message}
        buttons={[
          {text: 'Got it', onPress: hideDialog, style: 'default'},
        ]}
        onClose={hideDialog}
      />
      <AiConsentDialog visible={consentVisible} onAccept={onConsentAccept} onDecline={onConsentDecline} />
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
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  gifSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    alignItems: 'center',
  },
  gifContainer: {
    height: 340,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    backgroundColor: '#000',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  progressSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  aspectRatioSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  aspectRatioLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  aspectRatioOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  aspectRatioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  aspectRatioText: {
    fontSize: 11,
    fontWeight: '600',
  },
  slotsSection: {
    paddingBottom: 16,
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  slot: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 12,
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
    height: 40,
  },
  slotNumberBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptySlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  emptySlotNumber: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySlotNumberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotText: {
    fontSize: 12,
    fontWeight: '500',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,71,87,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replaceButton: {
    position: 'absolute',
    top: 8,
    right: 42,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 10,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  buttonSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});

export default TemplateDetailScreen;
