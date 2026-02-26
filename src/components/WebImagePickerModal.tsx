import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  useWindowDimensions,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {
  extractImagesFromUrl,
  ExtractedImage,
} from '../services/webImageExtractor';

interface WebImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
}

const WebImagePickerModal: React.FC<WebImagePickerModalProps> = ({
  visible,
  onClose,
  onSelectImage,
}) => {
  const {colors} = useTheme();
  const {width, height} = useWindowDimensions();

  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [pageTitle, setPageTitle] = useState<string | undefined>();
  const [hasSearched, setHasSearched] = useState(false);

  const numColumns = width >= 768 ? 4 : 3;

  const handleFetchImages = useCallback(async () => {
    Keyboard.dismiss();
    const trimmedUrl = urlInput.trim();

    if (!trimmedUrl) {
      setError('Please enter a webpage URL');
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImages([]);
    setHasSearched(true);

    const result = await extractImagesFromUrl(trimmedUrl);

    setIsLoading(false);

    if (result.success) {
      setImages(result.images);
      setPageTitle(result.pageTitle);
      if (result.images.length === 0) {
        setError('No product images found on this page');
      }
    } else {
      setError(result.error || 'Failed to extract images');
    }
  }, [urlInput]);

  const handleSelectImage = useCallback(
    (imageUrl: string) => {
      // Reset state for next use
      setUrlInput('');
      setImages([]);
      setError(null);
      setHasSearched(false);
      setPageTitle(undefined);
      // Call onSelectImage which will handle closing both modals
      onSelectImage(imageUrl);
    },
    [onSelectImage],
  );

  const handleClose = () => {
    // Reset state
    setUrlInput('');
    setImages([]);
    setError(null);
    setHasSearched(false);
    setPageTitle(undefined);
    onClose();
  };

  const renderImageItem = ({item}: {item: ExtractedImage}) => (
    <TouchableOpacity
      style={[
        styles.imageItem,
        {
          backgroundColor: colors.backgroundTertiary,
          width: `${100 / numColumns - 2}%`,
        },
      ]}
      onPress={() => handleSelectImage(item.url)}
      activeOpacity={0.7}>
      <Image
        source={{uri: item.url}}
        style={styles.image}
        resizeMode="cover"
        onError={() => {
          // Image failed to load - could filter out
        }}
      />
      {item.alt && (
        <View style={[styles.imageLabel, {backgroundColor: 'rgba(0,0,0,0.6)'}]}>
          <Text style={styles.imageLabelText} numberOfLines={1}>
            {item.alt}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            {backgroundColor: colors.cardBackground, height: height * 0.9},
          ]}>
          {/* Header */}
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              Pick from Web Page
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
              onPress={handleClose}>
              <Text style={[styles.closeButtonText, {color: colors.textPrimary}]}>
                x
              </Text>
            </TouchableOpacity>
          </View>

          {/* URL Input Section */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
              Enter product page URL
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.urlInput,
                  {
                    backgroundColor: colors.backgroundTertiary,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="https://example.com/product-page"
                placeholderTextColor={colors.textTertiary}
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="search"
                onSubmitEditing={handleFetchImages}
              />
              <TouchableOpacity
                style={[
                  styles.fetchButton,
                  {backgroundColor: colors.primary},
                  isLoading && styles.fetchButtonDisabled,
                ]}
                onPress={handleFetchImages}
                disabled={isLoading}
                activeOpacity={0.8}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="search" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.inputHint, {color: colors.textTertiary}]}>
              Paste a link to any product page (Amazon, eBay, online stores, etc.)
            </Text>
          </View>

          {/* Content Area */}
          <View style={styles.contentArea}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, {color: colors.textPrimary}]}>
                  Extracting images...
                </Text>
                <Text style={[styles.loadingSubtext, {color: colors.textTertiary}]}>
                  This may take a moment
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <View style={[styles.errorIconContainer, {backgroundColor: colors.error + '20'}]}>
                  <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
                </View>
                <Text style={[styles.errorText, {color: colors.error}]}>
                  {error}
                </Text>
                <Text style={[styles.errorHint, {color: colors.textTertiary}]}>
                  Try a different URL or check your internet connection
                </Text>
              </View>
            ) : images.length > 0 ? (
              <>
                {/* Page info */}
                {pageTitle && (
                  <View style={[styles.pageInfo, {backgroundColor: colors.backgroundTertiary}]}>
                    <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
                    <Text
                      style={[styles.pageTitle, {color: colors.textSecondary}]}
                      numberOfLines={1}>
                      {pageTitle}
                    </Text>
                  </View>
                )}
                <Text style={[styles.resultsCount, {color: colors.textSecondary}]}>
                  {images.length} image{images.length !== 1 ? 's' : ''} found - tap to select
                </Text>
                <FlatList
                  data={images}
                  renderItem={renderImageItem}
                  keyExtractor={(item, index) => `${item.url}-${index}`}
                  numColumns={numColumns}
                  key={numColumns}
                  contentContainerStyle={styles.gridContent}
                  columnWrapperStyle={styles.gridRow}
                  showsVerticalScrollIndicator={false}
                />
              </>
            ) : hasSearched ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconContainer, {backgroundColor: colors.backgroundTertiary}]}>
                  <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
                  No images found
                </Text>
                <Text style={[styles.emptySubtext, {color: colors.textTertiary}]}>
                  Try a different product page URL
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconContainer, {backgroundColor: colors.primary + '15'}]}>
                  <Ionicons name="link-outline" size={48} color={colors.primary} />
                </View>
                <Text style={[styles.emptyText, {color: colors.textPrimary}]}>
                  Enter a product page URL
                </Text>
                <Text style={[styles.emptySubtext, {color: colors.textTertiary}]}>
                  Paste a link to any online store product page and we'll extract
                  the images for you to choose from
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputSection: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  urlInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  fetchButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fetchButtonDisabled: {
    opacity: 0.7,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 8,
  },
  contentArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    textAlign: 'center',
  },
  pageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  pageTitle: {
    fontSize: 13,
    flex: 1,
  },
  resultsCount: {
    fontSize: 13,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  imageItem: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  imageLabelText: {
    color: '#fff',
    fontSize: 11,
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
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default WebImagePickerModal;
