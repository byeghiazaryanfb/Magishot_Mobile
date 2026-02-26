import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  useWindowDimensions,
  ScrollView,
  TextInput,
  Alert,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {ImageAsset} from '../services/imageTransform';
import {useProducts} from '../hooks/useProducts';
import {ProductItem} from '../services/productsApi';
import {useTryOnPrompts} from '../hooks/useTryOnPrompts';
import WebImagePickerModal from './WebImagePickerModal';
import PriceBadge from './PriceBadge';

type TabType = 'library' | 'upload';

interface ProductPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectProduct: (product: ProductItem) => void;
  onSelectCustomProduct: (image: ImageAsset) => void;
  onSelectProductUrl: (url: string) => void;
}

const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  visible,
  onClose,
  onSelectProduct,
  onSelectCustomProduct,
  onSelectProductUrl,
}) => {
  const {colors} = useTheme();
  const {width, height} = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [urlInput, setUrlInput] = useState('');
  const [showWebPicker, setShowWebPicker] = useState(false);

  // Fetch products and categories from API
  const {products, isLoading: isLoadingProducts} = useProducts();
  const {prompts: tryOnPrompts, isLoading: isLoadingPrompts} = useTryOnPrompts();

  const numColumns = width >= 768 ? 4 : 3;

  // Build categories from try-on prompts (they serve as categories)
  const categories = useMemo(() => {
    return tryOnPrompts.map(prompt => ({
      id: prompt.id,
      label: prompt.label,
      icon: prompt.icon || '🏷️',  // Default emoji if no icon
    }));
  }, [tryOnPrompts]);

  // Check if string is an Ionicons name (contains hyphen like "glasses-outline")
  const isIoniconName = (str: string): boolean => {
    return str.includes('-') && /^[a-z]/.test(str);
  };

  // Filter products by selected category (categoryId matches prompt id)
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') {
      return products;
    }
    return products.filter(p => p.categoryId === selectedCategory);
  }, [products, selectedCategory]);

  const handleSelectProduct = useCallback(
    (product: ProductItem) => {
      onSelectProduct(product);
      onClose();
    },
    [onSelectProduct, onClose],
  );

  const handleTakePhoto = async () => {
    try {
      const result = await launchCamera({
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
      const photo: ImageAsset = {
        uri: asset.uri!,
        type: asset.type,
        fileName: asset.fileName,
      };

      onSelectCustomProduct(photo);
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handlePickFromGallery = async () => {
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
      const photo: ImageAsset = {
        uri: asset.uri!,
        type: asset.type,
        fileName: asset.fileName,
      };

      onSelectCustomProduct(photo);
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to pick photo. Please try again.');
    }
  };

  const handlePasteFromClipboard = async () => {
    // Note: Clipboard image paste requires additional library
    // For now, show a message
    Alert.alert(
      'Paste Image',
      'Copy an image URL and paste it in the URL field below, or use Camera/Gallery to upload a product photo.',
    );
  };

  const handleUrlSubmit = () => {
    Keyboard.dismiss();
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      Alert.alert('Error', 'Please enter a valid URL.');
      return;
    }

    // Basic URL validation
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      Alert.alert('Error', 'Please enter a valid URL starting with http:// or https://');
      return;
    }

    onSelectProductUrl(trimmedUrl);
    setUrlInput('');
    onClose();
  };

  const handleWebImageSelect = useCallback(
    (imageUrl: string) => {
      // Close the web picker first
      setShowWebPicker(false);
      // Then dispatch the action and close this modal
      // Use setTimeout to ensure state updates properly before closing
      setTimeout(() => {
        onSelectProductUrl(imageUrl);
        onClose();
      }, 100);
    },
    [onSelectProductUrl, onClose],
  );

  const renderProductItem = ({item}: {item: ProductItem}) => (
    <TouchableOpacity
      style={[
        styles.productItem,
        {
          backgroundColor: colors.backgroundTertiary,
          width: `${100 / numColumns - 2}%`,
        },
      ]}
      onPress={() => handleSelectProduct(item)}
      activeOpacity={0.7}>
      <Image
        source={{uri: item.imageUrl}}
        style={styles.productImage}
        resizeMode="cover"
      />
      <PriceBadge estimatedCoins={item.estimatedCoins} isFree={item.isFree} variant="modal" />
      <View style={[styles.productLabel, {backgroundColor: 'rgba(0,0,0,0.6)'}]}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderLibraryTab = () => {
    if (isLoadingProducts || isLoadingPrompts) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Loading products...
          </Text>
        </View>
      );
    }

    return (
      <>
        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}>
          <TouchableOpacity
            style={[
              styles.categoryButton,
              {
                backgroundColor: selectedCategory === 'all' ? colors.primary : colors.backgroundTertiary,
                borderColor: selectedCategory === 'all' ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSelectedCategory('all')}
            activeOpacity={0.7}>
            <Ionicons
              name="apps-outline"
              size={18}
              color={selectedCategory === 'all' ? '#fff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.categoryLabel,
                {color: selectedCategory === 'all' ? '#fff' : colors.textPrimary},
              ]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryButton,
                {
                  backgroundColor: selectedCategory === cat.id ? colors.primary : colors.backgroundTertiary,
                  borderColor: selectedCategory === cat.id ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedCategory(cat.id)}
              activeOpacity={0.7}>
              {isIoniconName(cat.icon) ? (
                <Ionicons
                  name={cat.icon as any}
                  size={18}
                  color={selectedCategory === cat.id ? '#fff' : colors.textSecondary}
                />
              ) : (
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
              )}
              <Text
                style={[
                  styles.categoryLabel,
                  {color: selectedCategory === cat.id ? '#fff' : colors.textPrimary},
                ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
              No products in this category
            </Text>
          </View>
        ) : filteredProducts.length === 1 ? (
          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={item => item.id}
            numColumns={1}
            key={`1-${selectedCategory}`}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={item => item.id}
            numColumns={numColumns}
            key={`${numColumns}-${selectedCategory}`}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
          />
        )}
      </>
    );
  };

  const renderUploadTab = () => (
    <View style={styles.uploadContainer}>
      {/* Upload Options - Row 1 */}
      <View style={styles.uploadOptions}>
        <TouchableOpacity
          style={[styles.uploadOption, {backgroundColor: colors.primary}]}
          onPress={handleTakePhoto}
          activeOpacity={0.8}>
          <View style={styles.uploadOptionIcon}>
            <Ionicons name="camera-outline" size={32} color="#fff" />
          </View>
          <Text style={styles.uploadOptionText}>Camera</Text>
          <Text style={styles.uploadOptionHint}>Take a photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadOption, {backgroundColor: colors.success}]}
          onPress={handlePickFromGallery}
          activeOpacity={0.8}>
          <View style={styles.uploadOptionIcon}>
            <Ionicons name="images-outline" size={32} color="#fff" />
          </View>
          <Text style={styles.uploadOptionText}>Gallery</Text>
          <Text style={styles.uploadOptionHint}>Pick from photos</Text>
        </TouchableOpacity>
      </View>

      {/* From Web Page Option */}
      <TouchableOpacity
        style={[styles.webPageOption, {backgroundColor: colors.warning}]}
        onPress={() => setShowWebPicker(true)}
        activeOpacity={0.8}>
        <Ionicons name="globe-outline" size={24} color="#fff" />
        <View style={styles.webPageOptionText}>
          <Text style={styles.webPageOptionTitle}>From Web Page</Text>
          <Text style={styles.webPageOptionHint}>
            Extract images from any product page URL
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* URL Input Section */}
      <View style={styles.urlSection}>
        <Text style={[styles.urlLabel, {color: colors.textSecondary}]}>
          Or enter direct image URL
        </Text>
        <View style={styles.urlInputRow}>
          <TextInput
            style={[
              styles.urlInput,
              {
                backgroundColor: colors.backgroundTertiary,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
            placeholder="https://example.com/product.jpg"
            placeholderTextColor={colors.textTertiary}
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleUrlSubmit}
          />
          <TouchableOpacity
            style={[styles.urlSubmitButton, {backgroundColor: colors.primary}]}
            onPress={handleUrlSubmit}
            activeOpacity={0.8}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={[styles.instructionsText, {color: colors.textTertiary}]}>
          Upload a clear photo of the product you want to try on.
          For best results, use images with a clean background.
        </Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            {backgroundColor: colors.cardBackground, height: height * 0.85},
          ]}>
          {/* Header */}
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              Choose Product
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
              onPress={onClose}>
              <Text style={[styles.closeButtonText, {color: colors.textPrimary}]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={[styles.tabBar, {borderBottomColor: colors.border}]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'library' && [styles.activeTab, {borderBottomColor: colors.primary}],
              ]}
              onPress={() => setActiveTab('library')}
              activeOpacity={0.7}>
              <Ionicons
                name="grid-outline"
                size={20}
                color={activeTab === 'library' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  {color: activeTab === 'library' ? colors.primary : colors.textSecondary},
                ]}>
                Library
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'upload' && [styles.activeTab, {borderBottomColor: colors.primary}],
              ]}
              onPress={() => setActiveTab('upload')}
              activeOpacity={0.7}>
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={activeTab === 'upload' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  {color: activeTab === 'upload' ? colors.primary : colors.textSecondary},
                ]}>
                Upload
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'library' ? renderLibraryTab() : renderUploadTab()}
        </View>
      </View>

      {/* Web Image Picker Modal */}
      <WebImagePickerModal
        visible={showWebPicker}
        onClose={() => setShowWebPicker(false)}
        onSelectImage={handleWebImageSelect}
      />
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryScroll: {
    minHeight: 56,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
    paddingTop: 8,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  productItem: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  productName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  uploadContainer: {
    flex: 1,
    padding: 20,
  },
  uploadOptions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  uploadOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 16,
  },
  uploadOptionIcon: {
    marginBottom: 8,
  },
  uploadOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  uploadOptionHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  urlSection: {
    marginBottom: 24,
  },
  urlLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  urlInputRow: {
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
  urlSubmitButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructions: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  instructionsText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  webPageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 12,
  },
  webPageOptionText: {
    flex: 1,
  },
  webPageOptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  webPageOptionHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
  },
  categoryIcon: {
    fontSize: 16,
  },
});

export default ProductPickerModal;
