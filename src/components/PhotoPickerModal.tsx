import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  useWindowDimensions,
  Alert,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import ImageCropPicker from 'react-native-image-crop-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {ImageAsset} from '../services/imageTransform';

const PHOTO_HISTORY_KEY = '@photo_history';
const MAX_HISTORY_SIZE = 20;

interface PhotoPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPhoto: (photo: ImageAsset) => void;
  title?: string;
  onWebPickerPress?: () => void;
}

const PhotoPickerModal: React.FC<PhotoPickerModalProps> = ({
  visible,
  onClose,
  onSelectPhoto,
  title = 'Choose Photo',
  onWebPickerPress,
}) => {
  const {colors} = useTheme();
  const {width, height} = useWindowDimensions();
  const [photoHistory, setPhotoHistory] = useState<ImageAsset[]>([]);

  const numColumns = width >= 768 ? 4 : 3;

  // Load photo history on mount
  useEffect(() => {
    if (visible) {
      loadPhotoHistory();
    }
  }, [visible]);

  const loadPhotoHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(PHOTO_HISTORY_KEY);
      if (stored) {
        const photos: ImageAsset[] = JSON.parse(stored);
        // Filter out photos that no longer exist
        const validPhotos = await Promise.all(
          photos.map(async photo => {
            try {
              const filePath = photo.uri.replace('file://', '');
              const exists = await RNFS.exists(filePath);
              return exists ? photo : null;
            } catch {
              return null;
            }
          }),
        );
        const filteredPhotos = validPhotos.filter(
          (p): p is ImageAsset => p !== null,
        );
        setPhotoHistory(filteredPhotos);
        // Update storage with only valid photos
        if (filteredPhotos.length !== photos.length) {
          await AsyncStorage.setItem(
            PHOTO_HISTORY_KEY,
            JSON.stringify(filteredPhotos),
          );
        }
      }
    } catch (error) {
      // Silently fail
    }
  };

  const savePhotoToHistory = async (photo: ImageAsset) => {
    try {
      // Add to beginning, remove duplicates, limit size
      const newHistory = [
        photo,
        ...photoHistory.filter(p => p.uri !== photo.uri),
      ].slice(0, MAX_HISTORY_SIZE);

      setPhotoHistory(newHistory);
      await AsyncStorage.setItem(PHOTO_HISTORY_KEY, JSON.stringify(newHistory));
    } catch {
      // Silently fail
    }
  };

  const openCropper = async (imagePath: string): Promise<ImageAsset | null> => {
    try {
      const croppedImage = await ImageCropPicker.openCropper({
        path: imagePath,
        mediaType: 'photo',
        width: 1920,
        height: 1920,
        cropping: true,
        freeStyleCropEnabled: true,
        cropperToolbarTitle: 'Adjust Photo',
        cropperActiveWidgetColor: '#007AFF',
        cropperToolbarColor: '#000000',
        cropperToolbarWidgetColor: '#FFFFFF',
        includeBase64: false,
        compressImageQuality: 0.8,
      });

      return {
        uri: croppedImage.path,
        type: croppedImage.mime,
        fileName: croppedImage.filename || `cropped_${Date.now()}.jpg`,
      };
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Error', 'Failed to crop image. Please try again.');
      }
      return null;
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
        includeBase64: false,
        presentationStyle: 'fullScreen',
      });

      if (result.didCancel || !result.assets?.[0]?.uri) {
        return;
      }

      const asset = result.assets[0];
      const originalPhoto: ImageAsset = {
        uri: asset.uri!,
        type: asset.type,
        fileName: asset.fileName,
      };

      // Save original to history first
      await savePhotoToHistory(originalPhoto);

      // Open cropper for adjustment
      const croppedPhoto = await openCropper(asset.uri!);
      if (croppedPhoto) {
        onSelectPhoto(croppedPhoto);
        onClose();
      }
    } catch {
      // Silently fail
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
      const originalPhoto: ImageAsset = {
        uri: asset.uri!,
        type: asset.type,
        fileName: asset.fileName,
      };

      // Save original to history first
      await savePhotoToHistory(originalPhoto);

      // Open cropper for adjustment
      const croppedPhoto = await openCropper(asset.uri!);
      if (croppedPhoto) {
        onSelectPhoto(croppedPhoto);
        onClose();
      }
    } catch {
      // Silently fail
    }
  };

  const handleSelectFromHistory = async (photo: ImageAsset) => {
    // Check if file still exists before attempting to open
    try {
      const filePath = photo.uri.replace('file://', '');
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        // Remove invalid photo from history
        const newHistory = photoHistory.filter(p => p.uri !== photo.uri);
        setPhotoHistory(newHistory);
        await AsyncStorage.setItem(
          PHOTO_HISTORY_KEY,
          JSON.stringify(newHistory),
        );
        Alert.alert(
          'Photo Not Found',
          'This photo is no longer available. It may have been deleted.',
        );
        return;
      }
    } catch {
      // Continue anyway if check fails
    }

    // Move to top of history
    await savePhotoToHistory(photo);

    // Open cropper for adjustment
    const croppedPhoto = await openCropper(photo.uri);
    if (croppedPhoto) {
      onSelectPhoto(croppedPhoto);
      onClose();
    }
  };

  // Remove photo from history
  const handleRemoveFromHistory = async (photo: ImageAsset) => {
    const newHistory = photoHistory.filter(p => p.uri !== photo.uri);
    setPhotoHistory(newHistory);
    await AsyncStorage.setItem(PHOTO_HISTORY_KEY, JSON.stringify(newHistory));
  };

  const renderPhotoItem = ({item}: {item: ImageAsset}) => (
    <TouchableOpacity
      style={[
        styles.photoItem,
        {
          backgroundColor: colors.backgroundTertiary,
          width: `${100 / numColumns - 2}%`,
        },
      ]}
      onPress={() => handleSelectFromHistory(item)}
      activeOpacity={0.7}>
      <Image source={{uri: item.uri}} style={styles.photoImage} resizeMode="cover" />
      <TouchableOpacity
        style={[styles.removePhotoButton, {backgroundColor: colors.error}]}
        onPress={(e) => {
          e.stopPropagation();
          handleRemoveFromHistory(item);
        }}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
        activeOpacity={0.8}>
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
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
            {backgroundColor: colors.cardBackground, height: height * 0.75},
          ]}>
          {/* Header */}
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              {title}
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
              onPress={onClose}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={[styles.closeButtonText, {color: colors.textPrimary}]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, {backgroundColor: colors.primary}]}
              onPress={handleTakePhoto}
              activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={22} color="#fff" />
              <Text style={styles.actionButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, {backgroundColor: colors.success}]}
              onPress={handlePickFromGallery}
              activeOpacity={0.8}>
              <Ionicons name="images-outline" size={22} color="#fff" />
              <Text style={styles.actionButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          {onWebPickerPress && (
            <TouchableOpacity
              style={[styles.webPageOption, {backgroundColor: colors.warning}]}
              onPress={onWebPickerPress}
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
          )}

          {/* Recent Photos */}
          {photoHistory.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
                  Recent Photos
                </Text>
                <Text style={[styles.sectionCount, {color: colors.textTertiary}]}>
                  {photoHistory.length} photo{photoHistory.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <FlatList
                data={photoHistory}
                renderItem={renderPhotoItem}
                keyExtractor={(item, index) => `${item.uri}-${index}`}
                numColumns={numColumns}
                key={numColumns}
                contentContainerStyle={styles.gridContent}
                columnWrapperStyle={styles.gridRow}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}

          {photoHistory.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, {backgroundColor: colors.primary + '15'}]}>
                <Ionicons name="camera-outline" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
                No recent photos yet
              </Text>
              <Text style={[styles.emptySubtext, {color: colors.textTertiary}]}>
                Take a photo or pick from gallery to get started
              </Text>
            </View>
          )}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  webPageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  webPageOptionText: {
    flex: 1,
  },
  webPageOptionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  webPageOptionHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCount: {
    fontSize: 12,
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
  photoItem: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 4,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default PhotoPickerModal;
