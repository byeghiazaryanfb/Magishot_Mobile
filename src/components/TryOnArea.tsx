import React, {useState} from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {CopilotStep, walkthroughable} from 'react-native-copilot';

// Create walkthroughable components
const WalkthroughableView = walkthroughable(View);
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {fetchCoinBalance} from '../store/slices/authSlice';
import {
  setPersonImage,
  setProductImage,
  setProductImageUrl,
  setSelectedProduct,
  clearTryOnState,
} from '../store/slices/tryOnSlice';
import {addPendingSynthesizeJobs} from '../store/slices/imageNotificationSlice';
import {config} from '../utils/config';
import {useTheme} from '../theme/ThemeContext';
import {ImageAsset} from '../services/imageTransform';
import PhotoPickerModal from './PhotoPickerModal';
import ProductPickerModal from './ProductPickerModal';
import CustomDialog from './CustomDialog';
import {useServicePrices} from '../hooks/useServicePrices';
import FullScreenImageModal from './FullScreenImageModal';
import {ProductItem} from '../services/productsApi';
import {useTryOnPrompts} from '../hooks/useTryOnPrompts';

const TryOnArea: React.FC = () => {
  const dispatch = useAppDispatch();
  const {colors} = useTheme();
  const {width} = useWindowDimensions();

  const personImage = useAppSelector(state => state.tryOn.personImage);
  const productImage = useAppSelector(state => state.tryOn.productImage);
  const productImageUrl = useAppSelector(state => state.tryOn.productImageUrl);
  const selectedProduct = useAppSelector(state => state.tryOn.selectedProduct);
  const accessToken = useAppSelector(state => state.auth.accessToken);
  const {tryOnPrice} = useServicePrices();

  const [isGenerating, setIsGenerating] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<{visible: boolean; title: string; message: string}>({visible: false, title: '', message: ''});
  const [successDialog, setSuccessDialog] = useState<{visible: boolean; title: string; message: string}>({visible: false, title: '', message: ''});

  // Get try-on prompts for default fallback (when using custom uploads)
  const {prompts: tryOnPrompts} = useTryOnPrompts();

  // Responsive sizing
  const isTablet = width >= 768;
  const containerPadding = isTablet ? 40 : 16;

  // Check if we have both photos
  const hasPersonPhoto = !!personImage;
  const hasProductPhoto = !!productImage || !!productImageUrl;
  // Can generate if we have person photo AND (product with categoryId OR custom upload with default prompt available)
  const hasValidPrompt = !!selectedProduct?.categoryId || tryOnPrompts.length > 0;
  const canGenerate = hasPersonPhoto && hasProductPhoto && hasValidPrompt;

  // Handle person photo selection
  const handlePersonPhotoSelect = (photo: ImageAsset) => {
    dispatch(setPersonImage(photo));
  };

  // Handle product selection from library
  const handleProductSelect = (product: ProductItem) => {
    dispatch(setSelectedProduct(product));
  };

  // Handle custom product upload
  const handleCustomProductSelect = (photo: ImageAsset) => {
    dispatch(setProductImage(photo));
  };

  // Handle product URL
  const handleProductUrlSelect = (url: string) => {
    dispatch(setProductImageUrl(url));
  };

  // Clear person photo
  const clearPersonPhoto = () => {
    dispatch(setPersonImage(null));
  };

  // Clear product photo
  const clearProductPhoto = () => {
    dispatch(setProductImage(null));
    dispatch(setProductImageUrl(null));
    dispatch(setSelectedProduct(null));
  };

  // Get default try-on prompt (one with "default" label/id, or first available)
  const getDefaultTryOnPromptId = (): string | undefined => {
    const defaultPrompt = tryOnPrompts.find(
      p => p.label.toLowerCase() === 'default' || p.id.toLowerCase() === 'default'
    );
    return defaultPrompt?.id || tryOnPrompts[0]?.id;
  };

  // Handle try on generation (fire-and-forget → SignalR delivers result)
  const handleTryOn = async () => {
    if (!personImage || (!productImage && !productImageUrl)) {
      return;
    }

    // Fresh balance check from server
    const requiredCoins = tryOnPrice?.estimatedCoins ?? 0;
    if (requiredCoins > 0 && accessToken) {
      const balanceResult = await dispatch(fetchCoinBalance(accessToken));
      const freshBalance = balanceResult.payload as number | undefined;
      if (freshBalance === undefined || freshBalance < requiredCoins) {
        setErrorDialog({visible: true, title: 'Insufficient Balance', message: `You need ${requiredCoins} ★ but have ${freshBalance ?? 0} ★.`});
        return;
      }
    }

    // Use product's categoryId if available, otherwise use default prompt
    const tryOnPromptId = selectedProduct?.categoryId || getDefaultTryOnPromptId();
    if (!tryOnPromptId) return;

    setIsGenerating(true);
    let downloadedFilePath: string | null = null;

    try {
      const formData = new FormData();

      // Append person image (source)
      const isRemoteUrl = (uri: string) => uri.startsWith('http://') || uri.startsWith('https://');
      if (isRemoteUrl(personImage.uri)) {
        formData.append('sourceImageUrl', personImage.uri);
      } else {
        const ext = personImage.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
        formData.append('sourceImage', {
          uri: personImage.uri,
          type: personImage.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          name: personImage.fileName || `person.${ext}`,
        } as any);
      }

      // Append product image
      if (productImageUrl) {
        const tmpPath = `${RNFS.CachesDirectoryPath}/product_${Date.now()}.jpg`;
        const dl = await RNFS.downloadFile({fromUrl: productImageUrl, toFile: tmpPath}).promise;
        if (dl.statusCode === 200) {
          downloadedFilePath = tmpPath;
          formData.append('referenceImages', {
            uri: `file://${tmpPath}`,
            type: 'image/jpeg',
            name: tmpPath.split('/').pop() || 'product.jpg',
          } as any);
        }
      } else if (productImage) {
        if (isRemoteUrl(productImage.uri)) {
          const tmpPath = `${RNFS.CachesDirectoryPath}/product_${Date.now()}.jpg`;
          const dl = await RNFS.downloadFile({fromUrl: productImage.uri, toFile: tmpPath}).promise;
          if (dl.statusCode === 200) {
            downloadedFilePath = tmpPath;
            formData.append('referenceImages', {
              uri: `file://${tmpPath}`,
              type: 'image/jpeg',
              name: tmpPath.split('/').pop() || 'product.jpg',
            } as any);
          }
        } else {
          const ext = productImage.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
          formData.append('referenceImages', {
            uri: productImage.uri,
            type: productImage.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            name: productImage.fileName || `product.${ext}`,
          } as any);
        }
      }

      formData.append('tryOnPromptId', tryOnPromptId);

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiImage/synthesize-multiple-images`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            ...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {}),
          },
          body: formData,
        },
      );

      if (response.status === 202 || response.ok) {
        const result = await response.json();
        if (result.photoIds) {
          dispatch(addPendingSynthesizeJobs({photoIds: result.photoIds}));
        }
        if (accessToken) {
          dispatch(fetchCoinBalance(accessToken));
        }
        setSuccessDialog({
          visible: true,
          title: 'Try-On Started!',
          message: "You'll be notified when your try-on images are ready.",
        });
      } else {
        const errorText = await response.text();
        setErrorDialog({visible: true, title: 'Error', message: errorText || 'Failed to start try-on'});
      }
    } catch (err: any) {
      setErrorDialog({visible: true, title: 'Error', message: err?.message || 'Failed to start try-on'});
    } finally {
      setIsGenerating(false);
      if (downloadedFilePath) {
        try { await RNFS.unlink(downloadedFilePath); } catch {}
      }
    }
  };

  // Reset everything
  const handleReset = () => {
    dispatch(clearTryOnState());
  };

  // Get product display image
  const getProductDisplayImage = (): string | null => {
    if (productImage) {
      return productImage.uri;
    }
    if (productImageUrl) {
      return productImageUrl;
    }
    return null;
  };

  // Loading state
  if (isGenerating) {
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
          <View
            style={[
              styles.loadingIconContainer,
              {backgroundColor: colors.primary + '15'},
            ]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text style={[styles.loadingTitle, {color: colors.textPrimary, fontSize: isTablet ? 28 : 24}]}>
            Virtual Try-On
          </Text>
          <Text style={[styles.loadingText, {color: colors.textSecondary, fontSize: isTablet ? 18 : 16}]}>
            Creating your try-on preview...
          </Text>
          <View style={[styles.progressBar, {backgroundColor: colors.border}]}>
            <View
              style={[styles.progressFill, {backgroundColor: colors.primary}]}
            />
          </View>
        </View>
      </View>
    );
  }

  // Error state removed — errors now shown via errorDialog

  return (
    <ScrollView
      style={[styles.container, {backgroundColor: colors.background}]}
      contentContainerStyle={[styles.scrollContent, {padding: containerPadding}]}
      showsVerticalScrollIndicator={false}>
      {/* Hero Image Section */}
      <View style={styles.heroSection}>
        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
          }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(255,27,109,0.3)', colors.background]}
          style={styles.heroGradient}
        />
        <LinearGradient
          colors={['rgba(168,85,247,0.2)', 'transparent']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.heroOverlay}
        />
        <View style={styles.heroContent}>
          <View style={[styles.heroIconBadge, {backgroundColor: colors.primary}]}>
            <Ionicons name="shirt" size={24} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Virtual Try-On</Text>
          <Text style={styles.heroSubtitle}>See how products look on you</Text>
        </View>
      </View>

      {/* Two Photo Slots */}
      <View style={[styles.photosContainer, {maxWidth: isTablet ? 600 : '100%'}]}>
        {/* Person Photo Slot */}
        <View style={styles.photoSlot}>
          {personImage ? (
            <TouchableOpacity
              style={styles.photoSlotWrapper}
              onPress={() => setShowPhotoPicker(true)}
              activeOpacity={0.8}>
              <View style={[styles.photoSlotFilled, {borderColor: colors.primary}]}>
                <Image
                  source={{uri: personImage.uri}}
                  style={styles.photoSlotImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setFullScreenImage(personImage.uri);
                  }}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removePhotoBtn, {backgroundColor: colors.error}]}
                  onPress={(e) => {
                    e.stopPropagation();
                    clearPersonPhoto();
                  }}>
                  <Text style={styles.removePhotoBtnText}>x</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.photoSlotEmpty,
                {backgroundColor: colors.cardBackground, borderColor: colors.border},
              ]}
              onPress={() => setShowPhotoPicker(true)}
              activeOpacity={0.8}>
              <Ionicons name="camera" size={36} color={colors.textTertiary} />
              <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>Add Photo</Text>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.textTertiary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Plus Sign */}
        <View style={styles.plusSignContainer}>
          <Text style={[styles.plusSign, {color: colors.textTertiary}]}>+</Text>
        </View>

        {/* Product Photo Slot */}
        <CopilotStep
          text="Add a product to try on. Choose from our catalog, upload your own photo, or import directly from e-commerce websites like Amazon, Zara, H&M, etc."
          order={5}
          name="👗 Add Product">
          <WalkthroughableView style={styles.photoSlot}>
            {getProductDisplayImage() ? (
              <TouchableOpacity
                style={styles.photoSlotWrapper}
                onPress={() => setShowProductPicker(true)}
                activeOpacity={0.8}>
                <View style={[styles.photoSlotFilled, {borderColor: colors.primary}]}>
                  <Image
                    source={{uri: getProductDisplayImage()!}}
                    style={styles.photoSlotImage}
                    resizeMode="cover"
                  />
                  {selectedProduct && (
                    <View style={[styles.productBadge, {backgroundColor: colors.success}]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setFullScreenImage(getProductDisplayImage());
                    }}>
                    <Ionicons name="expand" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.removePhotoBtn, {backgroundColor: colors.error}]}
                    onPress={(e) => {
                      e.stopPropagation();
                      clearProductPhoto();
                    }}>
                    <Text style={styles.removePhotoBtnText}>x</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                  <Text style={styles.photoSlotLabelText}>{selectedProduct ? selectedProduct.name : 'Product'}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.photoSlotEmpty,
                  {backgroundColor: colors.cardBackground, borderColor: colors.border},
                ]}
                onPress={() => setShowProductPicker(true)}
                activeOpacity={0.8}>
                <Ionicons name="shirt-outline" size={36} color={colors.textTertiary} />
                <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>Add Product</Text>
                <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.textTertiary}]}>
                  <Text style={styles.photoSlotLabelText}>Product</Text>
                </View>
              </TouchableOpacity>
            )}
          </WalkthroughableView>
        </CopilotStep>
      </View>

      {/* Try It On Button */}
      <View style={[styles.buttonContainer, {maxWidth: isTablet ? 600 : '100%'}]}>
        <CopilotStep
          text="Once you've added your photo and a product, tap here to see how it looks on you!"
          order={6}
          name="✨ Try It On">
          <WalkthroughableView style={styles.tryOnButtonWrapper}>
            <LinearGradient
              colors={canGenerate ? [colors.gradientStart, colors.gradientEnd] : [colors.backgroundTertiary, colors.backgroundTertiary]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={[
                styles.tryOnButtonGradient,
                !canGenerate && styles.tryOnButtonDisabled,
                isGenerating && {shadowOpacity: 0},
              ]}>
              <TouchableOpacity
                style={styles.tryOnButtonTouchable}
                onPress={handleTryOn}
                disabled={!canGenerate || isGenerating}
                activeOpacity={0.7}>
                {isGenerating ? (
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={[styles.tryOnButtonText, {color: '#fff'}]}>
                      Submitting...
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.tryOnButtonText,
                      {color: canGenerate ? '#fff' : colors.textTertiary},
                    ]}>
                    {'✨ Try It On'}
                    {canGenerate ? (
                      tryOnPrice && !tryOnPrice.isFree && tryOnPrice.estimatedCoins > 0 ? (
                        <Text style={{color: '#FFD700'}}>{` (${tryOnPrice.estimatedCoins} ★)`}</Text>
                      ) : (
                        <Text style={{color: '#22C55E'}}>{' (Free)'}</Text>
                      )
                    ) : null}
                  </Text>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </WalkthroughableView>
        </CopilotStep>

        {!canGenerate && (
          <Text style={[styles.hintText, {color: colors.textTertiary}]}>
            Add your photo and select a product to try on
          </Text>
        )}
      </View>

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        visible={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        onSelectPhoto={handlePersonPhotoSelect}
        title="Select Your Photo"
      />

      {/* Product Picker Modal */}
      <ProductPickerModal
        visible={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelectProduct={handleProductSelect}
        onSelectCustomProduct={handleCustomProductSelect}
        onSelectProductUrl={handleProductUrlSelect}
      />

      {/* Full Screen Image Modal */}
      <FullScreenImageModal
        visible={!!fullScreenImage}
        imageUri={fullScreenImage}
        onClose={() => setFullScreenImage(null)}
      />

      {/* Error Dialog */}
      <CustomDialog
        visible={errorDialog.visible}
        icon="alert-circle"
        iconColor={colors.error}
        title={errorDialog.title}
        message={errorDialog.message}
        buttons={[
          {text: 'Got it', onPress: () => setErrorDialog(prev => ({...prev, visible: false})), style: 'default'},
        ]}
        onClose={() => setErrorDialog(prev => ({...prev, visible: false}))}
      />

      {/* Success Dialog */}
      <CustomDialog
        visible={successDialog.visible}
        icon="checkmark-circle"
        iconColor="#10B981"
        title={successDialog.title}
        message={successDialog.message}
        buttons={[
          {text: 'Done', onPress: () => setSuccessDialog(prev => ({...prev, visible: false})), style: 'default'},
        ]}
        onClose={() => setSuccessDialog(prev => ({...prev, visible: false}))}
        autoDismissMs={2500}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Account for floating tab bar
  },
  // Hero Section
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
    shadowColor: '#FF1B6D',
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
  photosContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    width: '100%',
    marginBottom: 32,
  },
  photoSlot: {
    alignItems: 'center',
    flex: 1,
    maxWidth: '45%',
  },
  photoSlotLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
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
    fontSize: 36,
    fontWeight: '300',
    marginBottom: 8,
  },
  photoSlotText: {
    fontSize: 14,
    fontWeight: '500',
  },
  fullScreenBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  productBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productBadgeText: {
    fontSize: 14,
  },
  plusSignContainer: {
    paddingHorizontal: 4,
  },
  plusSign: {
    fontSize: 32,
    fontWeight: '300',
  },
  buttonContainer: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  tryOnButtonWrapper: {
    width: '100%',
  },
  tryOnButtonGradient: {
    width: '100%',
    borderRadius: 16,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  tryOnButtonTouchable: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryOnButtonDisabled: {
    shadowOpacity: 0,
  },
  tryOnButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  hintText: {
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
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
    width: '60%',
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
});

export default TryOnArea;
