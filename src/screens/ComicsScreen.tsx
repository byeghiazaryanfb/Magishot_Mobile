import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
  StatusBar,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSelector} from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Share from 'react-native-share';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ImageZoom} from '@likashefqet/react-native-image-zoom';
import {useTheme} from '../theme/ThemeContext';
import GradientButton from '../components/GradientButton';
import PhotoPickerModal from '../components/PhotoPickerModal';
import CustomDialog from '../components/CustomDialog';
import {ImageAsset} from '../services/imageTransform';
import {generateComic, fetchComic, editPanel, deleteComic, fetchComicCategories, UserComic, ComicPanel, ComicCategory} from '../services/comicsApi';
import {RootStackParamList} from '../navigation/RootNavigator';
import type {RootState} from '../store';
import {useAppDispatch} from '../store/hooks';
import {addPendingComicJob} from '../store/slices/comicNotificationSlice';
import {fetchCoinBalance} from '../store/slices/authSlice';
import {useServicePrices} from '../hooks/useServicePrices';
import {requestPhotoLibraryPermission} from '../utils/permissions';

const MAX_PHOTOS = 7;
const HEADER_HEIGHT = 56;
const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

interface ImageSlot {
  id: number;
  uri: string | null;
}

type ComicScreenState = 'upload' | 'result';

type ComicsRouteProp = RouteProp<RootStackParamList, 'Comics'>;

const ComicsScreen: React.FC = () => {
  const {colors, isDark} = useTheme();
  const {width} = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ComicsRouteProp>();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const dispatch = useAppDispatch();
  const {comicPrice} = useServicePrices();
  const incomingComicId = route.params?.comicId;

  const [imageSlots, setImageSlots] = useState<ImageSlot[]>(
    Array.from({length: MAX_PHOTOS}, (_, i) => ({id: i, uri: null})),
  );
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [screenState, setScreenState] = useState<ComicScreenState>('upload');
  const [isGenerating, setIsGenerating] = useState(false);
  const [comic, setComic] = useState<UserComic | null>(null);
  const [editingPanel, setEditingPanel] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSavingPanel, setIsSavingPanel] = useState(false);
  const [showFullScreenZoom, setShowFullScreenZoom] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [isLoadingComic, setIsLoadingComic] = useState(!!incomingComicId);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isFullScreenImageLoading, setIsFullScreenImageLoading] = useState(true);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [categories, setCategories] = useState<ComicCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialog, setDialog] = useState<{visible: boolean; title: string; message: string; type: 'error' | 'success'}>({
    visible: false, title: '', message: '', type: 'success',
  });

  // Fetch categories on mount
  React.useEffect(() => {
    if (accessToken) {
      fetchComicCategories(accessToken)
        .then(cats => {
          setCategories(cats);
          if (cats.length > 0) setSelectedCategoryId(cats[0].id);
        })
        .catch(() => {})
        .finally(() => setIsCategoriesLoading(false));
    } else {
      setIsCategoriesLoading(false);
    }
  }, [accessToken]);

  const filledSlots = imageSlots.filter(s => s.uri !== null);
  const canGenerate = filledSlots.length >= 1 && !!selectedCategoryId;

  // Load comic from navigation param
  React.useEffect(() => {
    if (incomingComicId && accessToken) {
      setIsLoadingComic(true);
      fetchComic(incomingComicId, accessToken)
        .then(fullComic => {
          setComic(fullComic);
          setScreenState('result');
        })
        .catch(() => {
          setScreenState('upload');
          setDialog({
            visible: true,
            title: 'Error',
            message: 'Failed to load comic.',
            type: 'error',
          });
        })
        .finally(() => setIsLoadingComic(false));
    }
  }, [incomingComicId, accessToken]);

  // No longer watching for SignalR here — user navigates back after submit
  // and gets notified via the notification badge. They view the result
  // from My Creations > Comics tab.

  // ─── Actions ───

  const showMessage = (type: 'success' | 'error', title: string, message: string) => {
    setDialog({visible: true, title, message, type});
  };

  const handleSave = async () => {
    if (!comic) return;
    try {
      const hasPermission = await requestPhotoLibraryPermission();
      if (!hasPermission) {
        showMessage('error', 'Permission Denied', 'Cannot save without photo library permission');
        return;
      }
      const fileName = `comic_${Date.now()}.png`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const downloadResult = await RNFS.downloadFile({fromUrl: comic.fullUrl, toFile: filePath}).promise;
      if (downloadResult.statusCode !== 200) throw new Error('Download failed');
      await CameraRoll.saveAsset(`file://${filePath}`, {type: 'photo'});
      await RNFS.unlink(filePath).catch(() => {});
      showMessage('success', 'Saved!', 'Comic saved to your photo gallery');
    } catch {
      showMessage('error', 'Error', 'Failed to save comic');
    }
  };

  const handleShare = async () => {
    if (!comic) return;
    try {
      const fileName = `comic_${Date.now()}.png`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const downloadResult = await RNFS.downloadFile({fromUrl: comic.fullUrl, toFile: filePath}).promise;
      if (downloadResult.statusCode !== 200) throw new Error('Download failed');
      await Share.open({
        url: `file://${filePath}`,
        type: comic.mimeType || 'image/png',
      });
      await RNFS.unlink(filePath).catch(() => {});
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        showMessage('error', 'Error', 'Failed to share comic');
      }
    }
  };

  const handleDelete = () => {
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!comic || !accessToken) return;
    setIsDeleting(true);
    try {
      await deleteComic(comic.id, accessToken);
      setDeleteDialogVisible(false);
      showMessage('success', 'Deleted', 'Comic deleted successfully');
      // Go back to upload state after brief delay
      setTimeout(() => {
        handleNewComic();
      }, 1500);
    } catch {
      showMessage('error', 'Error', 'Failed to delete comic');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePickImage = (slotId: number) => {
    setSelectedSlotId(slotId);
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
    if (!canGenerate || !accessToken) return;

    setIsGenerating(true);

    try {
      const images = filledSlots.map(slot => ({
        uri: slot.uri!,
        type: 'image/jpeg',
        fileName: `photo_${slot.id + 1}.jpg`,
      }));

      const result = await generateComic(images, accessToken, selectedCategoryId || undefined);
      dispatch(addPendingComicJob({comicId: result.comicId}));
      dispatch(fetchCoinBalance(accessToken));

      // Show success toast and navigate back so user can continue using the app
      setDialog({
        visible: true,
        title: 'Comic Submitted',
        message: "You'll be notified when your comic is ready.",
        type: 'success',
      });
      setTimeout(() => navigation.goBack(), 1500);
    } catch (error) {
      setIsGenerating(false);
      setDialog({
        visible: true,
        title: 'Generation Failed',
        message: error instanceof Error ? error.message : 'Failed to generate comic.',
        type: 'error',
      });
    }
  };

  const handleStartEditPanel = (panel: ComicPanel) => {
    setEditingPanel(panel.id);
    setEditText(panel.text);
  };

  const handleSavePanel = async () => {
    if (!editingPanel || !comic || !accessToken) return;

    setIsSavingPanel(true);
    try {
      const updatedComic = await editPanel(comic.id, editingPanel, editText, accessToken);
      setComic(updatedComic);
      setEditingPanel(null);
    } catch (error) {
      setDialog({
        visible: true,
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Failed to save panel text.',
        type: 'error',
      });
    } finally {
      setIsSavingPanel(false);
    }
  };

  const handleNewComic = () => {
    setScreenState('upload');
    setComic(null);
    setIsImageLoading(true);
    setImageSlots(Array.from({length: MAX_PHOTOS}, (_, i) => ({id: i, uri: null})));
  };

  const getPhraseTypeIcon = (phraseType: string) => {
    switch (phraseType) {
      case 'SpeechBubble': return 'chatbubble-ellipses';
      case 'Narration': return 'reader';
      case 'Onomatopoeia': return 'flash';
      case 'Caption': return 'text';
      default: return 'chatbubble';
    }
  };

  const getPhraseTypeLabel = (phraseType: string) => {
    switch (phraseType) {
      case 'SpeechBubble': return 'Speech Bubble';
      case 'Onomatopoeia': return 'Sound Effect';
      default: return phraseType;
    }
  };

  // Slot sizing
  const slotPadding = 16;
  const slotGap = 8;
  const slotsPerRow = 4;
  const totalHGaps = (slotsPerRow - 1) * slotGap;
  const slotWidth = (width - slotPadding * 2 - totalHGaps) / slotsPerRow;
  const slotHeight = slotWidth * 1.1;

  const renderUploadState = () => (
    <>
      {/* Hero Banner */}
      <View style={styles.heroBanner}>
        <Image
          source={{uri: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=800&q=80'}}
          style={styles.heroBannerImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', colors.gradientStart + '50', colors.background]}
          style={styles.heroBannerGradient}
        />
        <LinearGradient
          colors={[colors.gradientEnd + '30', 'transparent']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.heroBannerOverlay}
        />
        <View style={styles.heroBannerContent}>
          <Text style={styles.heroBannerTitle}>Comic Studio</Text>
          <Text style={styles.heroBannerSubtitle}>
            Turn your photos into fun comic strips with AI-generated dialogue
          </Text>
        </View>
      </View>

      {/* Photo Slots */}
      <View style={styles.slotsSection}>
        <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>
          ADD UP TO {MAX_PHOTOS} PHOTOS
        </Text>
        <Text style={[styles.sectionHint, {color: colors.textTertiary}]}>
          Upload your photos and we'll create a comic strip
        </Text>
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
              onPress={() => slot.uri ? undefined : handlePickImage(slot.id)}
              onLongPress={() => {
                if (slot.uri) {
                  setPreviewImageUri(slot.uri);
                  setShowPreview(true);
                }
              }}
              activeOpacity={0.7}>
              {slot.uri ? (
                <>
                  <Image source={{uri: slot.uri}} style={styles.slotImage} resizeMode="cover" />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)']} style={styles.slotOverlay} />
                  <View style={styles.slotNumberBadge}>
                    <Text style={styles.slotNumberText}>{index + 1}</Text>
                  </View>
                  <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveImage(slot.id)}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.replaceButton} onPress={() => handlePickImage(slot.id)}>
                    <Ionicons name="camera-outline" size={14} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.emptySlot}>
                  <View style={[styles.emptySlotNumber, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}>
                    <Text style={[styles.emptySlotNumberText, {color: colors.textTertiary}]}>{index + 1}</Text>
                  </View>
                  <View style={[styles.addIconCircle, {borderColor: colors.textTertiary}]}>
                    <Ionicons name="add" size={18} color={colors.textTertiary} />
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Category Picker */}
      <View style={styles.categorySection}>
        <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>
          COMIC STYLE
        </Text>
        {isCategoriesLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{marginTop: 8}} />
        ) : categories.length > 0 ? (
          <View style={[styles.categoryList, {borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}]}>
            <ScrollView style={styles.categoryListScroll} nestedScrollEnabled>
              {categories.map((cat, index) => {
                const isSelected = selectedCategoryId === cat.id;
                const isLast = index === categories.length - 1;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryListItem,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? colors.primary + '20' : colors.primary + '12')
                          : 'transparent',
                        borderBottomColor: isLast ? 'transparent' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                      },
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    activeOpacity={0.7}>
                    <View style={styles.categoryListItemLeft}>
                      <View style={[
                        styles.categoryRadio,
                        {borderColor: isSelected ? colors.primary : colors.textTertiary},
                      ]}>
                        {isSelected && <View style={[styles.categoryRadioFill, {backgroundColor: colors.primary}]} />}
                      </View>
                      <View style={styles.categoryListItemText}>
                        <Text style={[styles.categoryName, {color: isSelected ? colors.primary : colors.textPrimary}]}>
                          {cat.name}
                        </Text>
                        {cat.description ? (
                          <Text style={[styles.categoryDescription, {color: colors.textTertiary}]} numberOfLines={1}>
                            {cat.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={[styles.progressBarContainer, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}]}>
          <LinearGradient
            colors={['#FF1B6D', '#A855F7']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={[styles.progressBar, {width: `${(filledSlots.length / MAX_PHOTOS) * 100}%`}]}
          />
        </View>
        <Text style={[styles.progressText, {color: colors.textSecondary}]}>
          {filledSlots.length === 0
            ? 'Add at least 1 photo to get started'
            : `${filledSlots.length}/${MAX_PHOTOS} photos added`}
        </Text>
      </View>
    </>
  );

  const renderResultState = () => {
    if (!comic) return null;

    return (
      <ScrollView style={styles.resultContainer} contentContainerStyle={styles.resultContent}>
        {/* Tappable Comic Image — opens full-screen zoom */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setShowFullScreenZoom(true)}
          style={[styles.comicImageContainer, {backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5'}]}>
          {isImageLoading && (
            <View style={styles.imageLoader}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.imageLoaderText, {color: colors.textSecondary}]}>Loading image...</Text>
            </View>
          )}
          <Image
            source={{uri: comic.fullUrl}}
            style={[styles.comicImage, {width: width - 32}, isImageLoading && {opacity: 0}]}
            resizeMode="contain"
            onLoad={() => setIsImageLoading(false)}
          />
          {!isImageLoading && (
            <View style={styles.zoomHintBadge}>
              <Ionicons name="expand-outline" size={12} color="#fff" />
              <Text style={styles.zoomHintBadgeText}>Tap to zoom</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Action Buttons: Save, Share, Delete */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.primary + '20'}]}
            onPress={handleSave}
            activeOpacity={0.7}>
            <View style={[styles.actionIconContainer, {backgroundColor: colors.primary}]}>
              <Ionicons name="download-outline" size={18} color="#fff" />
            </View>
            <Text style={[styles.actionLabel, {color: colors.textPrimary}]}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: (colors.secondary || '#8B5CF6') + '20'}]}
            onPress={handleShare}
            activeOpacity={0.7}>
            <View style={[styles.actionIconContainer, {backgroundColor: colors.secondary || '#8B5CF6'}]}>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
            </View>
            <Text style={[styles.actionLabel, {color: colors.textPrimary}]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: colors.error + '20'}]}
            onPress={handleDelete}
            activeOpacity={0.7}>
            <View style={[styles.actionIconContainer, {backgroundColor: colors.error}]}>
              <Ionicons name="trash-outline" size={18} color="#fff" />
            </View>
            <Text style={[styles.actionLabel, {color: colors.textPrimary}]}>Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Panels */}
        {comic.panels.length > 0 && (
          <View style={styles.panelsSection}>
            <Text style={[styles.panelsSectionTitle, {color: colors.textPrimary}]}>
              Edit Text
            </Text>
            <Text style={[styles.panelsSectionHint, {color: colors.textTertiary}]}>
              Tap any panel text to edit it
            </Text>
            {comic.panels
              .sort((a, b) => a.panelIndex - b.panelIndex)
              .map(panel => (
                <View
                  key={panel.id}
                  style={[styles.panelCard, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderColor: editingPanel === panel.id ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                  }]}>
                  <View style={styles.panelHeader}>
                    <View style={styles.panelTypeRow}>
                      <Ionicons
                        name={getPhraseTypeIcon(panel.phraseType)}
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={[styles.panelTypeLabel, {color: colors.textSecondary}]}>
                        Panel {panel.panelIndex + 1} · {getPhraseTypeLabel(panel.phraseType)}
                      </Text>
                    </View>
                    {editingPanel !== panel.id && (
                      <TouchableOpacity
                        onPress={() => handleStartEditPanel(panel)}
                        style={[styles.editButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}>
                        <Ionicons name="pencil" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {editingPanel === panel.id ? (
                    <View style={styles.editContainer}>
                      <TextInput
                        style={[styles.editInput, {
                          color: colors.textPrimary,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                          borderColor: colors.primary,
                        }]}
                        value={editText}
                        onChangeText={setEditText}
                        multiline
                        maxLength={200}
                        autoFocus
                        placeholder="Enter text..."
                        placeholderTextColor={colors.textTertiary}
                      />
                      <Text style={[styles.charCount, {color: colors.textTertiary}]}>
                        {editText.length}/200
                      </Text>
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={[styles.editActionButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
                          onPress={() => setEditingPanel(null)}>
                          <Text style={[styles.editActionText, {color: colors.textSecondary}]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.editActionButton, {backgroundColor: colors.primary}]}
                          onPress={handleSavePanel}
                          disabled={isSavingPanel}>
                          {isSavingPanel ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={[styles.editActionText, {color: '#fff'}]}>Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => handleStartEditPanel(panel)}>
                      <Text style={[styles.panelText, {color: colors.textPrimary}]}>
                        {panel.text || '(empty)'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: colors.background}]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.backgroundSecondary, height: HEADER_HEIGHT}]}>
        <TouchableOpacity
          style={[styles.backButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
          onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="book" size={20} color={colors.primary} />
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>Comics</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {screenState === 'upload' && (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {renderUploadState()}
        </ScrollView>
      )}

      {screenState === 'result' && renderResultState()}

      {/* Bottom Button */}
      <View style={[styles.buttonSection, {backgroundColor: colors.background}]}>
        {screenState === 'upload' && (
          <GradientButton
            title={
              isGenerating
                ? 'Submitting...'
                : filledSlots.length === 0
                  ? 'Add Photos'
                  : !selectedCategoryId
                    ? 'Select a Style'
                    : 'Generate Comic'
            }
            titleSuffix={(() => {
              if (isGenerating || !canGenerate) return undefined;
              const cost = comicPrice && !comicPrice.isFree ? comicPrice.estimatedCoins : 0;
              return cost > 0 ? ` (${cost} ★)` : ' (Free)';
            })()}
            titleSuffixColor={(() => {
              if (isGenerating || !canGenerate) return undefined;
              const cost = comicPrice && !comicPrice.isFree ? comicPrice.estimatedCoins : 0;
              return cost > 0 ? '#FFD700' : '#4ADE80';
            })()}
            onPress={canGenerate ? handleGenerate : () => handlePickImage(0)}
            disabled={isGenerating}
            loading={isGenerating}
          />
        )}
        {screenState === 'result' && (
          <GradientButton
            title="Create New Comic"
            onPress={handleNewComic}
          />
        )}
      </View>

      {/* Full-Screen Zoomable Image Modal */}
      <Modal
        visible={showFullScreenZoom}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullScreenZoom(false)}>
        <StatusBar backgroundColor="#000" barStyle="light-content" />
        <View style={styles.fullScreenModal}>
          {/* Hidden preload image to detect when loaded */}
          {comic && isFullScreenImageLoading && (
            <Image
              source={{uri: comic.fullUrl}}
              style={{width: 0, height: 0, position: 'absolute'}}
              onLoad={() => setIsFullScreenImageLoading(false)}
            />
          )}

          {/* Loader */}
          {isFullScreenImageLoading && (
            <View style={styles.fullScreenLoader}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.fullScreenLoaderText}>Loading image...</Text>
            </View>
          )}

          {/* Zoomable image (only render after loaded) */}
          {!isFullScreenImageLoading && (
            <GestureHandlerRootView style={styles.gestureRoot}>
              {comic && (
                <ImageZoom
                  key={comic.id}
                  uri={comic.fullUrl}
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
                    if (event.scale <= 1.05) setIsZoomed(false);
                  }}
                  onDoubleTap={(event) => {
                    setIsZoomed(event.type !== 'zoomOut');
                  }}
                  style={styles.imageZoom}
                  resizeMode="contain"
                />
              )}
            </GestureHandlerRootView>
          )}

          {/* Close button */}
          <TouchableOpacity
            style={styles.fullScreenClose}
            onPress={() => { setShowFullScreenZoom(false); setIsZoomed(false); setIsFullScreenImageLoading(true); }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Zoom hint */}
          {!isZoomed && !isFullScreenImageLoading && (
            <View style={styles.fullScreenZoomHint}>
              <Ionicons name="search-outline" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={styles.fullScreenZoomHintText}>Pinch or double-tap to zoom</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Modals */}
      {/* Loading overlay */}
      {isLoadingComic && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingOverlayText}>Loading comic...</Text>
        </View>
      )}

      {/* Photo Preview */}
      <Modal
        visible={showPreview}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowPreview(false); setPreviewImageUri(null); }}>
        <TouchableOpacity
          style={styles.peekOverlay}
          activeOpacity={1}
          onPress={() => { setShowPreview(false); setPreviewImageUri(null); }}>
          <View style={[styles.peekContainer, {backgroundColor: isDark ? '#1e1e1e' : '#fff'}]}>
            {previewImageUri && (
              <Image
                source={{uri: previewImageUri}}
                style={styles.peekImage}
                resizeMode="cover"
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <PhotoPickerModal
        visible={showPhotoPicker}
        onClose={() => { setShowPhotoPicker(false); setSelectedSlotId(null); }}
        onSelectPhoto={handlePhotoSelected}
        title={selectedSlotId !== null ? `Select Photo ${selectedSlotId + 1}` : 'Select Photo'}
      />

      {/* Delete Confirmation */}
      <CustomDialog
        visible={deleteDialogVisible}
        icon="trash-outline"
        iconColor={colors.error}
        title="Delete Comic"
        message="Are you sure you want to delete this comic? This action cannot be undone."
        buttons={[
          {text: isDeleting ? 'Deleting...' : 'Delete', onPress: confirmDelete, style: 'cancel'},
          {text: 'Cancel', onPress: () => setDeleteDialogVisible(false), style: 'default'},
        ]}
        onClose={() => setDeleteDialogVisible(false)}
      />

      {/* Message Dialog */}
      <CustomDialog
        visible={dialog.visible}
        icon={dialog.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
        iconColor={dialog.type === 'success' ? colors.success : colors.error}
        title={dialog.title}
        message={dialog.message}
        buttons={[{text: dialog.type === 'success' ? 'Done' : 'Got it', onPress: () => setDialog(prev => ({...prev, visible: false})), style: 'default'}]}
        onClose={() => setDialog(prev => ({...prev, visible: false}))}
        autoDismissMs={dialog.type === 'success' ? 2500 : undefined}
      />
    </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  // Hero Banner
  heroBanner: {
    marginHorizontal: 16,
    marginBottom: 20,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBannerImage: {
    width: '100%',
    height: '100%',
  },
  heroBannerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBannerContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroBannerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  heroBannerSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  // Slots
  slotsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  slotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
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
  // Category
  categorySection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  categoryList: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 210,
  },
  categoryListScroll: {},
  categoryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryListItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  categoryRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryRadioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryListItemText: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  // Progress
  progressSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
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
  // Result
  resultContainer: {
    flex: 1,
  },
  resultContent: {
    paddingBottom: 24,
  },
  comicImageContainer: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    position: 'relative',
  },
  comicImage: {
    aspectRatio: 3 / 4,
    borderRadius: 8,
  },
  imageLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  imageLoaderText: {
    fontSize: 13,
    marginTop: 10,
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  zoomHintBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
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
    fontSize: 13,
    fontWeight: '600',
  },
  // Full-screen zoom modal
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullScreenLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  fullScreenLoaderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 14,
  },
  gestureRoot: {
    flex: 1,
  },
  imageZoom: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullScreenClose: {
    position: 'absolute',
    top: 54,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fullScreenZoomHint: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 5,
  },
  fullScreenZoomHintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  // Panels
  panelsSection: {
    paddingHorizontal: 16,
  },
  panelsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  panelsSectionHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  panelCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  panelTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  panelTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelText: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Edit
  editContainer: {},
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  editActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  editActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  // Peek preview
  peekOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  peekContainer: {
    width: 300,
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  peekImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
  },
  // Button
  buttonSection: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    paddingBottom: 24,
  },
});

export default ComicsScreen;
