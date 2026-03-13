import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Alert,
  Platform,
  Share,
  PermissionsAndroid,
  Modal,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import RNFetchBlob from 'rn-fetch-blob';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {useTheme} from '../theme/ThemeContext';
import GradientButton from '../components/GradientButton';
import {RootStackParamList} from '../navigation/RootNavigator';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

type ImageResultRouteProp = RouteProp<RootStackParamList, 'ImageResult'>;

const ImageResultScreen: React.FC = () => {
  const {colors, isDark} = useTheme();
  const {width} = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ImageResultRouteProp>();
  const {imageResult} = route.params;

  const [isSaving, setIsSaving] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);

  // Image dimensions - 3:4 aspect ratio (portrait)
  const imageWidth = width - 48;
  const imageHeight = imageWidth * (4 / 3);

  const handleSaveToGallery = async () => {
    try {
      setIsSaving(true);

      if (Platform.OS === 'android') {
        // Request permission on Android
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to your storage to save images.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Cannot save image without storage permission.');
          return;
        }
      }

      // For base64 image, save directly
      if (imageResult.imageBase64) {
        const fileName = imageResult.fileName || `generated_${Date.now()}.png`;

        if (Platform.OS === 'ios') {
          // On iOS, save base64 to temp file then to camera roll
          const filePath = `${RNFetchBlob.fs.dirs.CacheDir}/${fileName}`;
          await RNFetchBlob.fs.writeFile(filePath, imageResult.imageBase64, 'base64');
          await CameraRoll.saveAsset(`file://${filePath}`, {type: 'photo'});
        } else {
          // On Android, save to Downloads
          const filePath = `${RNFetchBlob.fs.dirs.DownloadDir}/${fileName}`;
          await RNFetchBlob.fs.writeFile(filePath, imageResult.imageBase64, 'base64');

          // Notify media scanner
          await RNFetchBlob.fs.scanFile([{path: filePath, mime: imageResult.mimeType}]);
        }

        Alert.alert('Saved!', 'Image has been saved to your gallery.');
      } else if (imageResult.imageUrl) {
        // For URL, download then save
        const fileName = imageResult.fileName || `generated_${Date.now()}.png`;

        if (Platform.OS === 'ios') {
          await CameraRoll.saveAsset(imageResult.imageUrl, {type: 'photo'});
        } else {
          const filePath = `${RNFetchBlob.fs.dirs.DownloadDir}/${fileName}`;
          await RNFetchBlob.config({
            fileCache: true,
            path: filePath,
          }).fetch('GET', imageResult.imageUrl);

          await RNFetchBlob.fs.scanFile([{path: filePath, mime: imageResult.mimeType}]);
        }

        Alert.alert('Saved!', 'Image has been saved to your gallery.');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Save Failed', 'Failed to save image. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      if (imageResult.imageUrl) {
        await Share.share({
          url: imageResult.imageUrl,
          message: `Check out this image generated with ${imageResult.templateName}!`,
        });
      } else if (imageResult.imageBase64) {
        // For base64, we need to save to temp file first
        const fileName = imageResult.fileName || `generated_${Date.now()}.png`;
        const filePath = `${RNFetchBlob.fs.dirs.CacheDir}/${fileName}`;
        await RNFetchBlob.fs.writeFile(filePath, imageResult.imageBase64, 'base64');

        await Share.share({
          url: `file://${filePath}`,
          message: `Check out this image generated with ${imageResult.templateName}!`,
        });
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCreateAnother = () => {
    // Go back to the video screen (templates list)
    navigation.popToTop();
  };

  // Determine image source
  const imageSource = imageResult.imageUrl
    ? {uri: imageResult.imageUrl}
    : imageResult.imageBase64
      ? {uri: `data:${imageResult.mimeType};base64,${imageResult.imageBase64}`}
      : null;

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
            {imageResult.templateName || 'Generated Image'}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Generated Image */}
        <View style={styles.imageSection}>
          <View
            style={[
              styles.imageContainer,
              {
                width: imageWidth,
                height: imageHeight,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              },
            ]}>
            {imageSource && (
              <Image
                source={imageSource}
                style={styles.generatedImage}
                resizeMode="contain"
              />
            )}
            {/* Full Screen Button */}
            <TouchableOpacity
              style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
              onPress={() => setShowFullScreen(true)}
              activeOpacity={0.8}>
              <Ionicons name="expand" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              },
            ]}
            onPress={handleSaveToGallery}
            disabled={isSaving}>
            <Ionicons name="download-outline" size={24} color={colors.primary} />
            <Text style={[styles.actionButtonText, {color: colors.textPrimary}]}>
              {isSaving ? 'Saving...' : 'Save to Gallery'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              },
            ]}
            onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color={colors.primary} />
            <Text style={[styles.actionButtonText, {color: colors.textPrimary}]}>
              Share
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Another Button */}
      <View style={styles.buttonSection}>
        <GradientButton
          title="Create Another"
          onPress={handleCreateAnother}
        />
      </View>

      {/* Full Screen Modal with Zoom */}
      <Modal
        visible={showFullScreen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowFullScreen(false)}>
        <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
        <View style={styles.fullScreenContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowFullScreen(false)}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            activeOpacity={0.7}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Zoom hint */}
          <View style={styles.zoomHint}>
            <Ionicons name="search-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.zoomHintText}>Pinch to zoom</Text>
          </View>

          {/* Zoomable Image */}
          <ScrollView
            style={styles.zoomScrollView}
            contentContainerStyle={styles.zoomContentContainer}
            maximumZoomScale={5}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bouncesZoom={true}
            centerContent={true}
            pinchGestureEnabled={true}>
            {imageSource && (
              <Image
                source={imageSource}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
      </Modal>
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
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imageContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  generatedImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  buttonSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  zoomHint: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  zoomHintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  zoomScrollView: {
    flex: 1,
  },
  zoomContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});

export default ImageResultScreen;
