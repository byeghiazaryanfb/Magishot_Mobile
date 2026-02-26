import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {launchImageLibrary} from 'react-native-image-picker';
import {useTheme} from '../theme/ThemeContext';
import GradientButton from '../components/GradientButton';
import CustomDialog from '../components/CustomDialog';
import {config} from '../utils/config';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {
  addPendingJob,
  fetchVideoGallery,
  VideoGalleryItem,
} from '../store/slices/videoNotificationSlice';
import {fetchCoinBalance} from '../store/slices/authSlice';

const FONTS = [
  {id: 'default', name: 'Default', family: Platform.OS === 'ios' ? 'System' : 'sans-serif'},
  {id: 'serif', name: 'Serif', family: Platform.OS === 'ios' ? 'Georgia' : 'serif'},
  {id: 'mono', name: 'Mono', family: Platform.OS === 'ios' ? 'Courier' : 'monospace'},
  {id: 'handwriting', name: 'Script', family: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive'},
  {id: 'marker', name: 'Marker', family: Platform.OS === 'ios' ? 'Marker Felt' : 'casual'},
  {id: 'typewriter', name: 'Typewriter', family: Platform.OS === 'ios' ? 'American Typewriter' : 'monospace'},
  {id: 'comic', name: 'Comic', family: Platform.OS === 'ios' ? 'Chalkboard SE' : 'casual'},
  {id: 'elegant', name: 'Elegant', family: Platform.OS === 'ios' ? 'Didot' : 'serif'},
  {id: 'futura', name: 'Modern', family: Platform.OS === 'ios' ? 'Futura' : 'sans-serif'},
  {id: 'impact', name: 'Impact', family: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black'},
  {id: 'papyrus', name: 'Papyrus', family: Platform.OS === 'ios' ? 'Papyrus' : 'fantasy'},
  {id: 'copperplate', name: 'Copper', family: Platform.OS === 'ios' ? 'Copperplate' : 'serif'},
];

const TEXT_COLORS = [
  '#ffffff', '#f5f5f5', '#e0e0e0', '#9e9e9e', '#616161',
  '#000000', '#ff0000', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688',
  '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107',
  '#ff9800', '#ff5722', '#795548', '#607d8b', '#00ff00',
];

const POSITIONS = ['top', 'center', 'bottom'] as const;
type SubtitlePosition = (typeof POSITIONS)[number];

const LANGUAGES = [
  {id: '', label: 'Auto-detect'},
  {id: 'en', label: 'English'},
  {id: 'es', label: 'Spanish'},
  {id: 'fr', label: 'French'},
  {id: 'de', label: 'German'},
  {id: 'hy', label: 'Armenian'},
  {id: 'ru', label: 'Russian'},
  {id: 'zh', label: 'Chinese'},
  {id: 'ja', label: 'Japanese'},
  {id: 'ko', label: 'Korean'},
  {id: 'ar', label: 'Arabic'},
  {id: 'pt', label: 'Portuguese'},
];

const TRANSLATE_OPTIONS = [
  {id: '', label: 'None'},
  {id: 'en', label: 'English'},
  {id: 'es', label: 'Spanish'},
  {id: 'fr', label: 'French'},
  {id: 'de', label: 'German'},
  {id: 'hy', label: 'Armenian'},
  {id: 'ru', label: 'Russian'},
  {id: 'zh', label: 'Chinese'},
  {id: 'ja', label: 'Japanese'},
  {id: 'ko', label: 'Korean'},
  {id: 'ar', label: 'Arabic'},
  {id: 'pt', label: 'Portuguese'},
];

const SubtitleScreen: React.FC = () => {
  const {colors, isDark} = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(state => state.auth.accessToken);
  const galleryVideos = useAppSelector(
    state => state.videoNotification.galleryVideos,
  );

  // Video source
  const [videoFile, setVideoFile] = useState<{
    uri: string;
    type: string;
    fileName: string;
  } | null>(null);
  const [galleryVideoId, setGalleryVideoId] = useState<string | null>(null);
  const [galleryVideoUrl, setGalleryVideoUrl] = useState<string | null>(null);
  const [galleryVideoName, setGalleryVideoName] = useState<string | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);

  // Font settings
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);
  const [fontSize, setFontSize] = useState(24);
  const [fontColor, setFontColor] = useState('#ffffff');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [outlineWidth, setOutlineWidth] = useState(2);
  const [position, setPosition] = useState<SubtitlePosition>('bottom');

  // Language settings
  const [language, setLanguage] = useState('');
  const [translateTo, setTranslateTo] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'error' | 'success';
  }>({visible: false, title: '', message: '', type: 'error'});

  const hasVideoSource = !!videoFile || !!galleryVideoId;

  const showDialog = (
    type: 'success' | 'error',
    title: string,
    message: string,
  ) => {
    setDialog({visible: true, title, message, type});
  };

  const hideDialog = () => {
    const wasSuccess = dialog.type === 'success';
    setDialog(prev => ({...prev, visible: false}));
    if (wasSuccess) {
      navigation.goBack();
    }
  };

  const handleUploadVideo = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'video',
        selectionLimit: 1,
      });
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setVideoFile({
          uri: asset.uri!,
          type: asset.type || 'video/mp4',
          fileName: asset.fileName || 'video.mp4',
        });
        // Clear gallery selection
        setGalleryVideoId(null);
        setGalleryVideoUrl(null);
        setGalleryVideoName(null);
      }
    } catch (error) {
      console.log('Video picker error:', error);
    }
  };

  const handleOpenGalleryPicker = () => {
    if (galleryVideos.length === 0) {
      dispatch(fetchVideoGallery({}));
    }
    setShowGalleryPicker(true);
  };

  const handleSelectGalleryVideo = (video: VideoGalleryItem) => {
    setGalleryVideoId(video.videoId);
    setGalleryVideoUrl(video.videoUrl);
    setGalleryVideoName(video.fileName);
    // Clear file selection
    setVideoFile(null);
    setShowGalleryPicker(false);
  };

  const handleSubmit = async () => {
    if (!hasVideoSource) {
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();

      if (videoFile) {
        // Phone gallery: upload the physical file
        formData.append('video', {
          uri: videoFile.uri,
          type: videoFile.type,
          name: videoFile.fileName,
        } as any);
      } else if (galleryVideoId && galleryVideoUrl) {
        // MiagiShot gallery: send the URL
        formData.append('videoUrl', galleryVideoUrl);
      }

      // Font settings
      formData.append('fontName', selectedFont.family);
      formData.append('fontSize', String(fontSize));
      formData.append('fontColor', fontColor);
      formData.append('outlineColor', outlineColor);
      formData.append('outlineWidth', String(outlineWidth));
      formData.append('position', position);

      // Language settings
      if (language) {
        formData.append('language', language);
      }
      if (translateTo) {
        formData.append('translateTo', translateTo);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${config.apiBaseUrl}/api/gemini/GeminiVideo/subtitle`,
        {
          method: 'POST',
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        let errorMessage = 'Failed to add subtitles';
        try {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          errorMessage =
            errorData?.message ||
            errorData?.error ||
            `Server error: ${response.status}`;
        } catch {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      dispatch(addPendingJob({videoId: result.videoId}));
      showDialog(
        'success',
        'Video Queued',
        "You'll be notified when your subtitled video is ready.",
      );

      if (accessToken) {
        dispatch(fetchCoinBalance(accessToken));
      }
    } catch (error: any) {
      showDialog(
        'error',
        'Subtitle Failed',
        error instanceof Error
          ? error.message
          : 'Failed to process subtitles. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFullUrl = (url?: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${config.apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const renderGalleryItem = ({item}: {item: VideoGalleryItem}) => {
    const thumb = getFullUrl(item.thumbnailUrl);
    return (
      <TouchableOpacity
        style={[styles.galleryGridItem, {backgroundColor: colors.backgroundTertiary}]}
        onPress={() => handleSelectGalleryVideo(item)}
        activeOpacity={0.7}>
        {thumb ? (
          <Image source={{uri: thumb}} style={styles.galleryGridThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.galleryGridThumb, {justifyContent: 'center', alignItems: 'center'}]}>
            <Ionicons name="videocam" size={32} color={colors.textTertiary} />
          </View>
        )}
        <View style={styles.galleryGridOverlay}>
          <Text style={styles.galleryGridDuration}>
            {formatDuration(item.durationSeconds)}
          </Text>
        </View>
      </TouchableOpacity>
    );
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
          onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text
            style={[styles.headerTitle, {color: colors.textPrimary}]}
            numberOfLines={1}>
            Subtitles
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* Video Source Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
            Video Source
          </Text>
          <View style={styles.sourceCards}>
            <TouchableOpacity
              style={[
                styles.sourceCard,
                {
                  backgroundColor: videoFile
                    ? colors.primary + '15'
                    : isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.03)',
                  borderColor: videoFile
                    ? colors.primary
                    : isDark
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(0,0,0,0.1)',
                },
              ]}
              onPress={handleUploadVideo}
              activeOpacity={0.7}>
              <Ionicons
                name="cloud-upload-outline"
                size={32}
                color={videoFile ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.sourceCardTitle,
                  {
                    color: videoFile
                      ? colors.primary
                      : colors.textPrimary,
                  },
                ]}>
                Upload Video
              </Text>
              {videoFile ? (
                <Text
                  style={[
                    styles.sourceCardSubtitle,
                    {color: colors.textSecondary},
                  ]}
                  numberOfLines={1}>
                  {videoFile.fileName}
                </Text>
              ) : (
                <Text
                  style={[
                    styles.sourceCardSubtitle,
                    {color: colors.textTertiary},
                  ]}>
                  From device
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sourceCard,
                {
                  backgroundColor: galleryVideoId
                    ? colors.primary + '15'
                    : isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.03)',
                  borderColor: galleryVideoId
                    ? colors.primary
                    : isDark
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(0,0,0,0.1)',
                },
              ]}
              onPress={handleOpenGalleryPicker}
              activeOpacity={0.7}>
              <Ionicons
                name="film-outline"
                size={32}
                color={
                  galleryVideoId ? colors.primary : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.sourceCardTitle,
                  {
                    color: galleryVideoId
                      ? colors.primary
                      : colors.textPrimary,
                  },
                ]}>
                From Gallery
              </Text>
              {galleryVideoName ? (
                <Text
                  style={[
                    styles.sourceCardSubtitle,
                    {color: colors.textSecondary},
                  ]}
                  numberOfLines={1}>
                  {galleryVideoName}
                </Text>
              ) : (
                <Text
                  style={[
                    styles.sourceCardSubtitle,
                    {color: colors.textTertiary},
                  ]}>
                  Your creations
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Font Settings Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
            Font Settings
          </Text>

          {/* Font Name */}
          <Text style={[styles.settingLabel, {color: colors.textSecondary}]}>
            Font
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContainer}>
            {FONTS.map(font => (
              <TouchableOpacity
                key={font.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      selectedFont.id === font.id
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.05)',
                    borderColor:
                      selectedFont.id === font.id
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(0,0,0,0.1)',
                  },
                ]}
                onPress={() => setSelectedFont(font)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        selectedFont.id === font.id
                          ? '#fff'
                          : colors.textSecondary,
                      fontFamily: font.family,
                    },
                  ]}>
                  {font.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Font Size */}
          <Text style={[styles.settingLabel, {color: colors.textSecondary}]}>
            Font Size: {fontSize}
          </Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
              onPress={() => setFontSize(prev => Math.max(8, prev - 2))}
              activeOpacity={0.7}>
              <Ionicons name="remove" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={[styles.stepperTrack, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}]}>
              <View style={[styles.stepperFill, {width: `${((fontSize - 8) / 64) * 100}%`, backgroundColor: colors.primary}]} />
            </View>
            <TouchableOpacity
              style={[styles.stepperButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
              onPress={() => setFontSize(prev => Math.min(72, prev + 2))}
              activeOpacity={0.7}>
              <Ionicons name="add" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Font Color */}
          <Text style={[styles.settingLabel, {color: colors.textSecondary}]}>
            Font Color
          </Text>
          <View style={styles.colorGrid}>
            {TEXT_COLORS.map(color => (
              <TouchableOpacity
                key={`font-${color}`}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: color,
                    borderColor:
                      fontColor === color
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(0,0,0,0.15)',
                    borderWidth: fontColor === color ? 3 : 1,
                  },
                ]}
                onPress={() => setFontColor(color)}
              />
            ))}
          </View>

          {/* Outline Color */}
          <Text style={[styles.settingLabel, {color: colors.textSecondary}]}>
            Outline Color
          </Text>
          <View style={styles.colorGrid}>
            {TEXT_COLORS.map(color => (
              <TouchableOpacity
                key={`outline-${color}`}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: color,
                    borderColor:
                      outlineColor === color
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(0,0,0,0.15)',
                    borderWidth: outlineColor === color ? 3 : 1,
                  },
                ]}
                onPress={() => setOutlineColor(color)}
              />
            ))}
          </View>

          {/* Outline Width */}
          <Text style={[styles.settingLabel, {color: colors.textSecondary}]}>
            Outline Width: {outlineWidth}
          </Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
              onPress={() => setOutlineWidth(prev => Math.max(0, prev - 1))}
              activeOpacity={0.7}>
              <Ionicons name="remove" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={[styles.stepperTrack, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}]}>
              <View style={[styles.stepperFill, {width: `${(outlineWidth / 10) * 100}%`, backgroundColor: colors.primary}]} />
            </View>
            <TouchableOpacity
              style={[styles.stepperButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
              onPress={() => setOutlineWidth(prev => Math.min(10, prev + 1))}
              activeOpacity={0.7}>
              <Ionicons name="add" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Position */}
          <Text style={[styles.settingLabel, {color: colors.textSecondary}]}>
            Position
          </Text>
          <View style={styles.segmentedControl}>
            {POSITIONS.map(pos => (
              <TouchableOpacity
                key={pos}
                style={[
                  styles.segmentButton,
                  {
                    backgroundColor:
                      position === pos
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.05)',
                    borderColor:
                      position === pos
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(0,0,0,0.1)',
                  },
                ]}
                onPress={() => setPosition(pos)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: position === pos ? '#fff' : colors.textSecondary,
                    },
                  ]}>
                  {pos.charAt(0).toUpperCase() + pos.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
            Language
          </Text>

          <Text style={[styles.settingLabel, {color: colors.textSecondary}]}>
            Source Language
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContainer}>
            {LANGUAGES.map(lang => (
              <TouchableOpacity
                key={`src-${lang.id}`}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      language === lang.id
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.05)',
                    borderColor:
                      language === lang.id
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(0,0,0,0.1)',
                  },
                ]}
                onPress={() => setLanguage(lang.id)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        language === lang.id ? '#fff' : colors.textSecondary,
                    },
                  ]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.settingLabel, {color: colors.textSecondary}]}>
            Translate To
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContainer}>
            {TRANSLATE_OPTIONS.map(lang => (
              <TouchableOpacity
                key={`tr-${lang.id}`}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      translateTo === lang.id
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.05)',
                    borderColor:
                      translateTo === lang.id
                        ? colors.primary
                        : isDark
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(0,0,0,0.1)',
                  },
                ]}
                onPress={() => setTranslateTo(lang.id)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        translateTo === lang.id
                          ? '#fff'
                          : colors.textSecondary,
                    },
                  ]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Subtitle Preview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
            Preview
          </Text>
          <View
            style={[
              styles.previewBox,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.03)',
                borderColor: isDark
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.08)',
                justifyContent:
                  position === 'top'
                    ? 'flex-start'
                    : position === 'center'
                      ? 'center'
                      : 'flex-end',
              },
            ]}>
            <Text
              style={[
                styles.previewText,
                {
                  fontFamily: selectedFont.family,
                  fontSize: Math.min(fontSize, 36),
                  color: fontColor,
                  textShadowColor: outlineColor,
                  textShadowOffset: {width: outlineWidth > 0 ? 1 : 0, height: outlineWidth > 0 ? 1 : 0},
                  textShadowRadius: outlineWidth,
                },
              ]}>
              Sample Subtitle Text
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.buttonSection}>
          <GradientButton
            title={isSubmitting ? 'Processing...' : 'Add Subtitles'}
            onPress={handleSubmit}
            disabled={!hasVideoSource || isSubmitting}
          />
          {isSubmitting && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{marginTop: 12}}
            />
          )}
        </View>

        <View style={{height: 120}} />
      </ScrollView>

      {/* Gallery Picker Modal */}
      <Modal
        visible={showGalleryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowGalleryPicker(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {backgroundColor: colors.background},
            ]}>
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, {color: colors.textPrimary}]}>
                Select Video
              </Text>
              <TouchableOpacity
                onPress={() => setShowGalleryPicker(false)}
                style={styles.modalClose}>
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
            {galleryVideos.length === 0 ? (
              <View style={styles.emptyGallery}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={[
                    styles.emptyGalleryText,
                    {color: colors.textSecondary},
                  ]}>
                  Loading videos...
                </Text>
              </View>
            ) : (
              <FlatList
                data={galleryVideos}
                keyExtractor={item => item.videoId}
                renderItem={renderGalleryItem}
                numColumns={3}
                contentContainerStyle={styles.galleryGridContent}
                columnWrapperStyle={styles.galleryGridRow}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Success / Error Dialog */}
      <CustomDialog
        visible={dialog.visible}
        icon={
          dialog.type === 'success' ? 'checkmark-circle' : 'alert-circle'
        }
        iconColor={dialog.type === 'success' ? colors.success : colors.error}
        title={dialog.title}
        message={dialog.message}
        buttons={[{text: 'Got it', onPress: hideDialog, style: 'default'}]}
        onClose={hideDialog}
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sourceCards: {
    flexDirection: 'row',
    gap: 12,
  },
  sourceCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  sourceCardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sourceCardSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  chipScroll: {
    marginBottom: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stepperFill: {
    height: '100%',
    borderRadius: 3,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewBox: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  previewText: {
    textAlign: 'center',
  },
  buttonSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Gallery Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    padding: 4,
  },
  galleryGridContent: {
    padding: 16,
    paddingBottom: 40,
  },
  galleryGridRow: {
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  galleryGridItem: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryGridThumb: {
    width: '100%',
    height: '100%',
  },
  galleryGridOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  galleryGridDuration: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyGallery: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyGalleryText: {
    fontSize: 14,
  },
});

export default SubtitleScreen;
