import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
  Alert,
  PanResponder,
  Animated,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSelector} from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import GifPlayer from '../components/GifPlayer';
import GradientButton from '../components/GradientButton';
import PhotoPickerModal from '../components/PhotoPickerModal';
import {ImageAsset} from '../services/imageTransform';
import {config} from '../utils/config';
import {RootStackParamList} from '../navigation/RootNavigator';
import type {RootState} from '../store';

type ImageTemplateDetailRouteProp = RouteProp<RootStackParamList, 'ImageTemplateDetail'>;

const ImageTemplateScreen: React.FC = () => {
  const {colors, isDark} = useTheme();
  const {width, height} = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ImageTemplateDetailRouteProp>();
  const {template: initialTemplate, templates, currentIndex: initialIndex} = route.params;
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [selectedImage, setSelectedImage] = useState<ImageAsset | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Use ref to track current index for panResponder (avoids stale closure)
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  // Get current template based on index
  const template = templates[currentIndex] || initialTemplate;

  // Animation for swipe
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Preview dimensions - maintain 3:4 aspect ratio (portrait)
  const previewWidth = width - 48;
  const previewHeight = previewWidth * (4 / 3);

  // Swipe threshold
  const SWIPE_THRESHOLD = 80;

  const goToNextTemplate = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx < templates.length - 1 && !isAnimating) {
      setIsAnimating(true);
      // Animate out (slide up)
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -height,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        const newIndex = idx + 1;
        setCurrentIndex(newIndex);
        currentIndexRef.current = newIndex;
        setSelectedImage(null);
        translateY.setValue(height);
        // Animate in (slide from bottom)
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsAnimating(false);
        });
      });
    } else {
      // Reset position if at the end
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [templates.length, translateY, opacity, height, isAnimating]);

  const goToPrevTemplate = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx > 0 && !isAnimating) {
      setIsAnimating(true);
      // Animate out (slide down)
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        const newIndex = idx - 1;
        setCurrentIndex(newIndex);
        currentIndexRef.current = newIndex;
        setSelectedImage(null);
        translateY.setValue(-height);
        // Animate in (slide from top)
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsAnimating(false);
        });
      });
    } else {
      // Reset position if at the beginning
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [translateY, opacity, height, isAnimating]);

  // Store callbacks in refs to avoid stale closures in panResponder
  const goToNextRef = useRef(goToNextTemplate);
  const goToPrevRef = useRef(goToPrevTemplate);
  goToNextRef.current = goToNextTemplate;
  goToPrevRef.current = goToPrevTemplate;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture vertical swipes
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        translateY.setValue(gestureState.dy * 0.5);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -SWIPE_THRESHOLD) {
          // Swipe up - next template
          goToNextRef.current();
        } else if (gestureState.dy > SWIPE_THRESHOLD) {
          // Swipe down - previous template
          goToPrevRef.current();
        } else {
          // Reset position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handlePickImage = () => {
    setShowPhotoPicker(true);
  };

  const handlePhotoSelected = (photo: ImageAsset) => {
    setSelectedImage(photo);
    setShowPhotoPicker(false);
  };

  const handleGenerate = async () => {
    if (!selectedImage) {
      setShowPhotoPicker(true);
      return;
    }

    try {
      setIsGenerating(true);

      // Create FormData with the image
      const formData = new FormData();
      formData.append('image', {
        uri: selectedImage.uri,
        type: 'image/jpeg',
        name: 'user_photo.jpg',
      } as any);

      // Build headers with auth token
      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      // Make API call
      const response = await fetch(
        `${config.apiBaseUrl}/api/VideoTemplates/${template.id}/generate-image`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.message || 'Failed to generate image';
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Navigate to ImageResult screen with the result
      navigation.navigate('ImageResult', {imageResult: result});
    } catch (error) {
      console.error('Image generation error:', error);
      Alert.alert(
        'Generation Failed',
        error instanceof Error ? error.message : 'Failed to generate image. Please try again.',
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
          {/* Template counter */}
          <Text style={[styles.templateCounter, {color: colors.textSecondary}]}>
            {currentIndex + 1} / {templates.length}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Swipeable Content */}
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{translateY}],
            opacity,
          }
        ]}
        {...panResponder.panHandlers}>
        {/* Preview Section */}
        <View style={styles.previewSection}>
          <TouchableOpacity
            style={[
              styles.previewContainer,
              {
                width: previewWidth,
                height: previewHeight,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: selectedImage
                  ? colors.primary
                  : isDark
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(0,0,0,0.1)',
              },
            ]}
            onPress={handlePickImage}
            activeOpacity={0.8}>
            {selectedImage ? (
              <>
                <Image
                  source={{uri: selectedImage.uri}}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                {/* Change photo overlay */}
                <View style={styles.changeOverlay}>
                  <View style={[styles.changeButton, {backgroundColor: 'rgba(0,0,0,0.6)'}]}>
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={styles.changeText}>Change Photo</Text>
                  </View>
                </View>
              </>
            ) : (
              <GifPlayer
                uri={template.gifUrl}
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}
          </TouchableOpacity>

          {/* Swipe indicators */}
          {templates.length > 1 && (
            <View style={styles.swipeIndicators}>
              {currentIndex > 0 && (
                <View style={styles.swipeHint}>
                  <Ionicons name="chevron-up" size={16} color={colors.textTertiary} />
                  <Text style={[styles.swipeHintText, {color: colors.textTertiary}]}>
                    Previous
                  </Text>
                </View>
              )}
              {currentIndex < templates.length - 1 && (
                <View style={styles.swipeHint}>
                  <Text style={[styles.swipeHintText, {color: colors.textTertiary}]}>
                    Next
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Description */}
        {template.description && (
          <View style={styles.descriptionSection}>
            <Text style={[styles.description, {color: colors.textSecondary}]}>
              {template.description}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Generate Button */}
      <View style={styles.buttonSection}>
        <GradientButton
          title={isGenerating ? 'Generating...' : 'Generate'}
          onPress={handleGenerate}
          disabled={isGenerating}
        />
      </View>

      {/* Loading Modal */}
      <Modal
        visible={isGenerating}
        transparent
        animationType="fade"
        statusBarTranslucent>
        <View style={styles.loadingModal}>
          <View style={[styles.loadingContent, {backgroundColor: colors.cardBackground}]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingTitle, {color: colors.textPrimary}]}>
              Generating Image
            </Text>
            <Text style={[styles.loadingSubtitle, {color: colors.textSecondary}]}>
              This may take a moment...
            </Text>
          </View>
        </View>
      </Modal>

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        visible={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        onSelectPhoto={handlePhotoSelected}
        title="Select Photo"
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
  templateCounter: {
    fontSize: 12,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  previewContainer: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  swipeIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 24,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeHintText: {
    fontSize: 12,
  },
  changeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 16,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  changeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  descriptionSection: {
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  loadingModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingContent: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ImageTemplateScreen;
