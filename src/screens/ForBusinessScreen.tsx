import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {useNavigation, DrawerActions} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {toggleBusinessMode} from '../store/slices/appSlice';
import {useTheme} from '../theme/ThemeContext';
import {config} from '../utils/config';
import Logo from '../components/Logo';
import CustomDialog from '../components/CustomDialog';
import FullScreenImageModal from '../components/FullScreenImageModal';
import PhotoPickerModal from '../components/PhotoPickerModal';
import WebImagePickerModal from '../components/WebImagePickerModal';
import TemplateComposerModal from '../components/TemplateComposerModal';
import {ImageAsset} from '../services/imageTransform';
import RNFS from 'react-native-fs';
import {addPendingImageJob} from '../store/slices/imageNotificationSlice';
import {triggerHaptic} from '../utils/haptics';


interface BusinessCategory {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  businessUnit: string;
  createdAt: string;
  updatedAt: string | null;
}

interface MobileAppTemplate {
  id: string;
  name: string;
  description: string | null;
  jsonConfig: string;
  prompt: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  businessCategoryId: string | null;
  businessCategoryName: string | null;
  createdAt: string;
  updatedAt: string | null;
}

const ForBusinessScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const {colors, isDark} = useTheme();
  const {width} = useWindowDimensions();
  const {unopenedPhotosCount, unplayedVideosCount} = useAppSelector(
    state => state.app,
  );
  const totalUnreadCount = unopenedPhotosCount + unplayedVideosCount;
  const notificationUnreadCount = useAppSelector(
    state => state.notification.unreadCount,
  );
  const accessToken = useAppSelector(state => state.auth.accessToken);

  const [productPhoto, setProductPhoto] = useState<ImageAsset | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [lastGenerateHadVideo, setLastGenerateHadVideo] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [templates, setTemplates] = useState<MobileAppTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MobileAppTemplate | null>(null);
  const [peekItem, setPeekItem] = useState<{name: string; thumbnailUrl: string | null} | null>(null);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showWebPicker, setShowWebPicker] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const isTablet = width >= 768;
  const themeToggleSize = isTablet ? 52 : 44;
  const themeIconSize = isTablet ? 26 : 22;
  const headerPadding = isTablet ? 32 : 20;


  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/api/businesscategories?businessUnit=magishot`,
        );
        if (!response.ok) {
          throw new Error('Failed to fetch categories');
        }
        const data = await response.json();
        setCategories(data.categories || []);
      } catch (_err) {
        // silently fail — categories section will just be empty
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Fetch templates when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setTemplates([]);
      setSelectedTemplate(null);
      return;
    }
    const fetchTemplates = async () => {
      setTemplatesLoading(true);
      setTemplates([]);
      setSelectedTemplate(null);
      try {
        const url =
          selectedCategory === 'all'
            ? `${config.apiBaseUrl}/api/MobileAppTemplates`
            : `${config.apiBaseUrl}/api/MobileAppTemplates/by-category/${selectedCategory}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (_err) {
        // silently fail
      } finally {
        setTemplatesLoading(false);
      }
    };
    fetchTemplates();
  }, [selectedCategory]);

  // Scroll to bottom after templates load so the user can see them
  useEffect(() => {
    if (!templatesLoading && selectedCategory && productPhoto && templates.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  }, [templatesLoading, selectedCategory, productPhoto, templates.length]);

  const handleTemplateGenerate = (generateConfig: Record<string, any>) => {
    if (!productPhoto || !accessToken) return;
    setSelectedTemplate(null);
    // Wait for modal to fully unmount, then run API call
    setTimeout(async () => {
      setGenerating(true);
      setGenerateError(null);
      try {
        const formData = new FormData();
        const ext = productPhoto.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = productPhoto.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        formData.append('image', {
          uri: productPhoto.uri,
          type: mimeType,
          name: productPhoto.fileName || `photo.${ext}`,
        } as any);
        formData.append('templateId', generateConfig.templateId);
        if (generateConfig.aspectRatio) {
          formData.append('aspectRatio', generateConfig.aspectRatio);
        }
        if (generateConfig.replacements) {
          for (const [key, value] of Object.entries(generateConfig.replacements)) {
            formData.append(`replacements[${key}]`, value as string);
          }
        }
        if (generateConfig.count) {
          formData.append('count', String(generateConfig.count));
        }
        if (generateConfig.creationAnimation !== undefined) {
          formData.append('generateVideoAnimation', String(generateConfig.creationAnimation));
        }
        if (generateConfig.videoAspectRatio) {
          formData.append('videoAspectRatio', generateConfig.videoAspectRatio);
        }
        const response = await fetch(
          `${config.apiBaseUrl}/api/gemini/GeminiImage/template-generate`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
          },
        );
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || `Request failed (${response.status})`);
        }
        const result = await response.json();
        if (result.photoId) {
          dispatch(addPendingImageJob({photoId: result.photoId}));
        }
        setLastGenerateHadVideo(!!generateConfig.creationAnimation);
        setShowComingSoon(true);
      } catch (err: any) {
        setGenerateError(err.message || 'Something went wrong');
      } finally {
        setGenerating(false);
      }
    }, 500);
  };

  const handleSelectPhoto = (photo: ImageAsset) => {
    setProductPhoto(photo);
    setShowPhotoPicker(false);
    setPhotoRequired(false);
  };

  const handleRemovePhoto = () => {
    setProductPhoto(null);
  };

  const handleWebImageSelect = async (imageUrl: string) => {
    setShowWebPicker(false);
    try {
      const fileName = `web_product_${Date.now()}.jpg`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const downloadResult = await RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: filePath,
      }).promise;
      if (downloadResult.statusCode !== 200) {
        throw new Error('Download failed');
      }
      const webPhoto: ImageAsset = {
        uri: `file://${filePath}`,
        type: 'image/jpeg',
        fileName,
      };
      setProductPhoto(webPhoto);
      setPhotoRequired(false);
    } catch {
      setGenerateError('Failed to download image from web. Please try again.');
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {backgroundColor: colors.backgroundSecondary},
        ]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.05)',
            },
          ]}
          onPress={() => dispatch(toggleBusinessMode())}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text
            style={[styles.headerTitle, {color: colors.textPrimary}]}
            numberOfLines={1}>
            Ad Creating Studio
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingHorizontal: isTablet ? 32 : 16},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
            }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', colors.gradientStart + '50', colors.background]}
            style={styles.heroGradient}
          />
          <LinearGradient
            colors={[colors.gradientEnd + '30', 'transparent']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.heroOverlay}
          />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Ad Creating Studio</Text>
            <Text style={styles.heroSubtitle}>
              Turn any product snap into scroll-stopping ads and social content
            </Text>
          </View>
        </View>

        {/* Your Product Section */}
        <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
          Your Product
        </Text>
        {!productPhoto ? (
          <TouchableOpacity
            style={[
              styles.photoSlotEmpty,
              {
                borderColor: photoRequired ? '#FF4757' : colors.border,
                backgroundColor: colors.cardBackground,
              },
            ]}
            onPress={() => {
              setPhotoRequired(false);
              setShowPhotoPicker(true);
            }}
            activeOpacity={0.7}>
            <Ionicons
              name="camera-outline"
              size={40}
              color={colors.textTertiary}
            />
            <Text
              style={[styles.photoSlotLabel, {color: colors.textSecondary}]}>
              Add Your Product
            </Text>
            <Text
              style={[styles.photoSlotHint, {color: colors.textTertiary}]}>
              Take a photo or choose from gallery
            </Text>
          </TouchableOpacity>
        ) : null}
        {productPhoto && (
          <View
            style={[
              styles.photoSlotFilled,
              {borderColor: colors.border, backgroundColor: colors.cardBackground},
            ]}>
            <Image
              source={{uri: productPhoto.uri}}
              style={styles.productImage}
            />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={handleRemovePhoto}
              activeOpacity={0.7}>
              <Ionicons name="close-circle" size={28} color="#FF4757" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.swapPhotoButton,
                {backgroundColor: colors.backgroundTertiary},
              ]}
              onPress={() => setShowPhotoPicker(true)}
              activeOpacity={0.7}>
              <Ionicons
                name="camera-reverse-outline"
                size={20}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setShowFullScreen(true)}
              activeOpacity={0.7}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Ionicons name="expand-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        {/* Business Category Section */}
        <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
          Business Category
        </Text>
        {categoriesLoading ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={styles.categoriesLoader}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}>
            {[{id: 'all', name: 'All', thumbnailUrl: null} as BusinessCategory, ...categories].map(cat => {
              const isActive = selectedCategory === cat.id;
              const thumbSize = isTablet ? 84 : 60;
              const cardWidth = isTablet ? 120 : 84;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    {
                      width: cardWidth,
                      backgroundColor: isActive
                        ? colors.primary + '30'
                        : colors.cardBackground,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  onLongPress={() => {
                    if (cat.thumbnailUrl) {
                      triggerHaptic();
                      setPeekItem({name: cat.name, thumbnailUrl: cat.thumbnailUrl});
                    }
                  }}
                  delayLongPress={300}
                  activeOpacity={0.7}>
                  <View style={styles.categoryImageWrapper}>
                    {cat.thumbnailUrl ? (
                      <Image
                        source={{uri: cat.thumbnailUrl}}
                        style={[
                          styles.categoryThumbnail,
                          {width: thumbSize, height: thumbSize},
                        ]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.categoryPlaceholder,
                          {
                            width: thumbSize,
                            height: thumbSize,
                            backgroundColor: cat.id === 'all'
                              ? (isActive ? colors.primary : colors.backgroundTertiary)
                              : colors.backgroundTertiary,
                          },
                        ]}>
                        <Ionicons
                          name={cat.id === 'all' ? 'grid' : 'image-outline'}
                          size={cat.id === 'all' ? 28 : 24}
                          color={cat.id === 'all' && isActive ? '#fff' : colors.textTertiary}
                        />
                      </View>
                    )}
                    {isActive && (
                      <View
                        style={[
                          styles.checkmark,
                          {backgroundColor: colors.primary},
                          isTablet && styles.checkmarkTablet,
                        ]}>
                        <Text style={[styles.checkmarkText, isTablet && {fontSize: 14}]}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.categoryName,
                      {
                        color: isActive
                          ? colors.primary
                          : colors.textSecondary,
                      },
                    ]}
                    numberOfLines={2}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Template Cards Section */}
        {selectedCategory && (
          <>
            <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
              Choose a Template
            </Text>
            {templatesLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.templatesLoader}
              />
            ) : templates.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templatesContainer}>
                {templates.map(tmpl => {
                  const isActive = selectedTemplate?.id === tmpl.id;
                  const cardWidth = isTablet ? 120 : 84;
                  const thumbSize = isTablet ? 84 : 60;
                  return (
                    <TouchableOpacity
                      key={tmpl.id}
                      style={[
                        styles.categoryCard,
                        {
                          width: cardWidth,
                          backgroundColor: isActive
                            ? colors.primary + '30'
                            : colors.cardBackground,
                        },
                      ]}
                      onPress={() => {
                        if (!productPhoto) {
                          setPhotoRequired(true);
                          return;
                        }
                        setSelectedTemplate(tmpl);
                      }}
                      onLongPress={() => {
                        if (tmpl.thumbnailUrl) {
                          triggerHaptic();
                          setPeekItem({name: tmpl.name, thumbnailUrl: tmpl.thumbnailUrl});
                        }
                      }}
                      delayLongPress={300}
                      activeOpacity={0.7}>
                      <View style={styles.categoryImageWrapper}>
                        {tmpl.thumbnailUrl ? (
                          <Image
                            source={{uri: tmpl.thumbnailUrl}}
                            style={[
                              styles.categoryThumbnail,
                              {width: thumbSize, height: thumbSize},
                            ]}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.categoryPlaceholder,
                              {
                                width: thumbSize,
                                height: thumbSize,
                                backgroundColor: colors.backgroundTertiary,
                              },
                            ]}>
                            <Ionicons
                              name="image-outline"
                              size={24}
                              color={colors.textTertiary}
                            />
                          </View>
                        )}
                        {isActive && (
                          <View
                            style={[
                              styles.checkmark,
                              {backgroundColor: colors.primary},
                              isTablet && styles.checkmarkTablet,
                            ]}>
                            <Text style={[styles.checkmarkText, isTablet && {fontSize: 14}]}>
                              ✓
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.categoryName,
                          {
                            color: isActive
                              ? colors.primary
                              : colors.textSecondary,
                          },
                        ]}
                        numberOfLines={2}>
                        {tmpl.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={[styles.noTemplatesText, {color: colors.textTertiary}]}>
                No templates available for this category
              </Text>
            )}
          </>
        )}

      </ScrollView>

      {/* Full Screen Image Zoom */}
      <FullScreenImageModal
        visible={showFullScreen}
        imageUri={productPhoto?.uri ?? null}
        onClose={() => setShowFullScreen(false)}
      />

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        visible={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        onSelectPhoto={handleSelectPhoto}
        title="Product Photo"
        onWebPickerPress={() => {
          setShowPhotoPicker(false);
          setTimeout(() => setShowWebPicker(true), 300);
        }}
      />

      {/* Web Image Picker Modal */}
      <WebImagePickerModal
        visible={showWebPicker}
        onClose={() => setShowWebPicker(false)}
        onSelectImage={handleWebImageSelect}
      />

      {/* Template Composer Modal */}
      <TemplateComposerModal
        visible={!!selectedTemplate}
        template={selectedTemplate}
        productPhoto={productPhoto}
        onClose={() => setSelectedTemplate(null)}
        onGenerate={handleTemplateGenerate}
      />

      {/* Generation Queued Dialog */}
      <CustomDialog
        visible={showComingSoon}
        icon="checkmark-circle"
        iconColor={colors.success}
        title="Generation Queued"
        message={lastGenerateHadVideo
          ? "Your image and video are being generated. You'll receive a separate notification when each is ready!"
          : "Your image is being generated. You'll receive a notification when it's ready!"}
        buttons={[
          {text: 'Got it', onPress: () => setShowComingSoon(false), style: 'default'},
        ]}
        onClose={() => setShowComingSoon(false)}
        autoDismissMs={2500}
      />

      {/* Error Dialog */}
      <CustomDialog
        visible={!!generateError}
        icon="alert-circle"
        iconColor={colors.error}
        title="Generation Failed"
        message={generateError || ''}
        buttons={[
          {text: 'Got it', onPress: () => setGenerateError(null), style: 'default'},
        ]}
        onClose={() => setGenerateError(null)}
      />

      {/* Peek Preview Modal */}
      {!!peekItem && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPeekItem(null)}>
          <View
            style={styles.peekOverlay}
            onTouchEnd={() => setPeekItem(null)}
            onTouchCancel={() => setPeekItem(null)}>
            <View style={[styles.peekContainer, {backgroundColor: colors.cardBackground}]}>
              {peekItem.thumbnailUrl ? (
                <Image
                  source={{uri: peekItem.thumbnailUrl}}
                  style={styles.peekImage}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name="image-outline" size={120} color={colors.textTertiary} />
              )}
              <Text style={[styles.peekLabel, {color: colors.textPrimary}]}>
                {peekItem.name}
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Generating overlay */}
      {generating && (
        <View style={styles.generatingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.generatingText}>Submitting...</Text>
        </View>
      )}
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
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4757',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF4757',
    borderWidth: 1.5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
    paddingBottom: 32,
  },
  heroSection: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  photoSlotEmpty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  photoSlotLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  photoSlotHint: {
    fontSize: 12,
    marginTop: 4,
  },
  photoSlotFilled: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 15,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  swapPhotoButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesLoader: {
    marginBottom: 24,
  },
  categoriesContainer: {
    gap: 10,
    paddingBottom: 24,
  },
  categoryCard: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryImageWrapper: {
    position: 'relative',
  },
  categoryThumbnail: {
    borderRadius: 16,
  },
  categoryPlaceholder: {
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  checkmarkTablet: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryName: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  templatesLoader: {
    marginBottom: 24,
  },
  templatesContainer: {
    gap: 10,
    paddingBottom: 24,
  },
  noTemplatesText: {
    fontSize: 13,
    marginBottom: 24,
  },
  generatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  generatingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  peekOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  peekContainer: {
    width: 280,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  peekImage: {
    width: 240,
    height: 240,
    borderRadius: 16,
    marginBottom: 16,
  },
  peekLabel: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default ForBusinessScreen;
