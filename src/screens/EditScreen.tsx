import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Image,
  TextInput,
  Platform,
  Modal,
  PanResponder,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import {Text} from 'react-native';
import {useNavigation, DrawerActions, useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {CopilotStep, useCopilot, walkthroughable} from 'react-native-copilot';
import type {RootState} from '../store';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import Share from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import {triggerHaptic} from '../utils/haptics';
import {requestPhotoLibraryPermission} from '../utils/permissions';
import {
  Canvas,
  Image as SkiaImage,
  ColorMatrix,
  Skia,
  Rect,
  RoundedRect,
  Path,
  Shadow,
  Fill,
  Group,
  Paint,
  Circle,
  Line,
  vec,
  rrect,
  rect,
} from '@shopify/react-native-skia';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Clipboard from '@react-native-clipboard/clipboard';
import type {SkImage} from '@shopify/react-native-skia';
import {useTheme} from '../theme/ThemeContext';
import {useAppDispatch} from '../store/hooks';
import {fetchCoinBalance} from '../store/slices/authSlice';
import {addToHistory} from '../store/slices/historySlice';
import Logo from '../components/Logo';
import PhotoPickerModal from '../components/PhotoPickerModal';
import {useWalkthrough, WALKTHROUGH_KEYS} from '../hooks/useWalkthrough';

// Create walkthroughable components
const WalkthroughableView = walkthroughable(View);
import FullScreenImageModal from '../components/FullScreenImageModal';
import CustomDialog from '../components/CustomDialog';
import filtersApi, {ApiFilter, FilterCategory, getFullThumbnailUrl} from '../services/filtersApi';
import {generateCaption} from '../services/captionApi';
import PriceBadge from '../components/PriceBadge';
import {useServicePrices} from '../hooks/useServicePrices';
import AiConsentDialog from '../components/AiConsentDialog';
import {useAiConsent} from '../hooks/useAiConsent';

// Type for recent filter entry
interface RecentFilter {
  id: string;
  name: string;
  thumbnailUrl?: string;
  usedAt: number;
  estimatedCoins?: number;
  isFree?: boolean;
}

const RECENT_FILTERS_KEY = 'edit_screen_recent_filters';
const MAX_RECENT_FILTERS = 10; // Store up to 10 recent filters

// Basic filter presets - now fetched from backend API
// const FILTERS = [
//   {id: 'original', name: 'Original', icon: '○', component: null},
//   {id: 'sepia', name: 'Sepia', icon: '🟤', component: 'Sepia', amount: 1},
//   {id: 'vintage', name: 'Vintage', icon: '📷', component: 'Vintage'},
//   {id: 'retro', name: 'Retro', icon: '🎞️', component: 'Retro'},
//   {id: 'bw', name: 'B&W', icon: '⬛', component: 'Grayscale', amount: 1},
//   {id: 'warm', name: 'Warm', icon: '🔥', component: 'Temperature', amount: 0.4},
//   {id: 'cool', name: 'Cool', icon: '❄️', component: 'Temperature', amount: -0.4},
//   {id: 'vivid', name: 'Vivid', icon: '🌈', component: 'Saturate', amount: 1.5},
//   {id: 'fade', name: 'Fade', icon: '🌫️', component: 'Fade'},
//   {id: 'dramatic', name: 'Dramatic', icon: '🎭', component: 'Dramatic'},
// ];

// Frame presets - now fetched from backend API
// const FRAMES = [
//   {id: 'none', name: 'None', icon: '✕'},
//   {id: 'polaroid', name: 'Polaroid', icon: '📸'},
//   {id: 'filmstrip', name: 'Film Strip', icon: '🎞️'},
//   {id: 'vintage', name: 'Vintage', icon: '🖼️'},
//   {id: 'instant', name: 'Instant', icon: '📷'},
//   {id: 'torn', name: 'Torn', icon: '📄'},
//   {id: 'rounded', name: 'Rounded', icon: '⬜'},
//   {id: 'vignette', name: 'Vignette', icon: '🔘'},
//   {id: 'grunge', name: 'Grunge', icon: '🎸'},
//   {id: 'tape', name: 'Tape', icon: '📎'},
//   {id: 'stamp', name: 'Stamp', icon: '📮'},
//   {id: 'negative', name: 'Negative', icon: '🎥'},
// ];

// Editing modes
type EditMode = 'filters' | 'frames' | 'text' | 'adjust' | 'caption';

// Caption style options
const CAPTION_STYLES = [
  {id: 'funny', label: 'Funny', icon: 'happy-outline'},
  {id: 'descriptive', label: 'Descriptive', icon: 'bulb-outline'},
  {id: 'poetic', label: 'Poetic', icon: 'leaf-outline'},
  {id: 'social media', label: 'Social Media', icon: 'glasses-outline'},
  {id: 'motivational', label: 'Motivational', icon: 'rocket-outline'},
  {id: 'romantic', label: 'Romantic', icon: 'heart-outline'},
  {id: 'witty', label: 'Witty', icon: 'flash-outline'},
  {id: 'dramatic', label: 'Dramatic', icon: 'flame-outline'},
];

// Small helper: shows a light spinner until the image has loaded
const FilterImageWithLoader: React.FC<{
  uri: string;
  style: any;
}> = ({uri, style}) => {
  const {colors} = useTheme();
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={[style, {overflow: 'hidden'}]}>
      {!loaded && (
        <View style={[StyleSheet.absoluteFill, {justifyContent: 'center', alignItems: 'center'}]}>
          <ActivityIndicator size="small" color={colors.primary} style={{opacity: 0.4}} />
        </View>
      )}
      <Image
        source={{uri}}
        style={[StyleSheet.absoluteFill, {borderRadius: style?.borderRadius || 14, opacity: loaded ? 1 : 0}]}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
};

const EditScreen: React.FC = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const dispatch = useAppDispatch();
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const {unopenedPhotosCount, unplayedVideosCount} = useSelector((state: RootState) => state.app);
  const totalUnreadCount = unopenedPhotosCount + unplayedVideosCount;
  const notificationUnreadCount = useSelector((state: RootState) => state.notification.unreadCount);
  const {captionPrice} = useServicePrices();
  const {requireConsent, consentVisible, onConsentAccept, onConsentDecline} = useAiConsent();

  // Walkthrough for Edit tab
  const {start, copilotEvents, currentStep} = useCopilot();
  const {shouldShowWalkthrough, isLoading: walkthroughLoading, completeWalkthrough} = useWalkthrough(WALKTHROUGH_KEYS.EDIT);
  const [walkthroughStarted, setWalkthroughStarted] = useState(false);
  const {width, height} = useWindowDimensions();
  const viewShotRef = useRef<ViewShot>(null);
  const savedToHistoryRef = useRef<string | null>(null);
  const pendingFilterRef = useRef<{id: string; name?: string} | null>(null);

  // Dialog state
  const [messageDialog, setMessageDialog] = useState<{
    visible: boolean;
    icon: string;
    iconColor: string;
    title: string;
    message: string;
  }>({visible: false, icon: 'checkmark-circle', iconColor: '#4CAF50', title: '', message: ''});

  const showMessage = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    const iconMap = {
      success: {icon: 'checkmark-circle', iconColor: '#4CAF50'},
      error: {icon: 'close-circle', iconColor: '#F44336'},
      warning: {icon: 'warning', iconColor: '#FF9800'},
    };
    setMessageDialog({visible: true, ...iconMap[type], title, message});
  };

  const hideMessage = () => {
    setMessageDialog(prev => ({...prev, visible: false}));
  };

  // State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('original');
  const [selectedFrame, setSelectedFrame] = useState('none');
  const [editMode, setEditMode] = useState<EditMode>('filters');
  const [overlayText, setOverlayText] = useState('');
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  // API Filters state
  const [apiFilters, setApiFilters] = useState<FilterCategory[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [selectedApiFilter, setSelectedApiFilter] = useState<string | null>(null);
  const [filteredImageUrl, setFilteredImageUrl] = useState<string | null>(null);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [originalImageForFilter, setOriginalImageForFilter] = useState<string | null>(null);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('recent'); // 'recent' or categoryId
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [peekFilter, setPeekFilter] = useState<{name: string; thumbnailUrl?: string | null} | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [recentFilters, setRecentFilters] = useState<RecentFilter[]>([]);

  // Photo picker and full-screen modal state
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Caption state
  const [captionType, setCaptionType] = useState('funny');
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [captionError, setCaptionError] = useState('');
  const [captionCopied, setCaptionCopied] = useState(false);

  // Validation modal state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  // Pending filter - stores filter selection when user picks filter before photo
  const [pendingFilter, setPendingFilter] = useState<{id: string; name?: string} | null>(null);

  // Before/After comparison state (press-and-hold to show original)
  const [showComparison, setShowComparison] = useState(false);

  // Text styling state
  const [textSidebarVisible, setTextSidebarVisible] = useState(false);
  const [textColor, setTextColor] = useState('#ffffff');
  const [textFontSize, setTextFontSize] = useState(24);
  const [textFontFamily, setTextFontFamily] = useState('default');
  const [textShadow, setTextShadow] = useState(true);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  const [textRotation, setTextRotation] = useState(0);
  const [textCurve, setTextCurve] = useState(0); // -100 to 100, 0 = no curve
  const [textBackgroundEnabled, setTextBackgroundEnabled] = useState(true);
  const [textBackgroundColor, setTextBackgroundColor] = useState('rgba(0,0,0,0.5)');
  const [textBoxWidth, setTextBoxWidth] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const inlineTextInputRef = useRef<TextInput>(null);

  // Whether the text box is "selected" (shows border + handles)
  const [textSelected, setTextSelected] = useState(true);

  // Refs for rotation gesture (PanResponder needs stable refs)
  const textRotationRef = useRef(textRotation);
  const rotationStartRef = useRef(0);
  const initialAngleRef = useRef(0);
  const textCenterRef = useRef({x: 0, y: 0});
  const textWrapperRef = useRef<View>(null);
  useEffect(() => { textRotationRef.current = textRotation; }, [textRotation]);

  // Text position animation
  const pan = useRef(new Animated.ValueXY()).current;

  // Zoom animation for filtered image preview
  const filterZoomScale = useRef(new Animated.Value(1)).current;

  // Track previous text to detect when text is added after being cleared
  const prevTextRef = useRef(overlayText);

  // Reset text position when text is added after being cleared
  useEffect(() => {
    const wasEmpty = prevTextRef.current.length === 0;
    const isNowFilled = overlayText.length > 0;

    if (wasEmpty && isNowFilled) {
      // Reset pan so text appears at center (wrapper is at 50%/50%)
      pan.flattenOffset();
      pan.setValue({x: -textBoxWidth / 2, y: -(textFontSize + 24) / 2});
    }

    prevTextRef.current = overlayText;
  }, [overlayText, pan]);

  // Clear text helper - resets text and pan fully
  const clearOverlayText = useCallback(() => {
    setOverlayText('');
    setIsEditingText(false);
    pan.flattenOffset();
    pan.setValue({x: -textBoxWidth / 2, y: -(textFontSize + 24) / 2});
  }, [pan, textBoxWidth, textFontSize]);

  // Start Edit walkthrough when screen is focused and conditions are met
  useFocusEffect(
    React.useCallback(() => {
      if (!walkthroughLoading && shouldShowWalkthrough && !walkthroughStarted) {
        // Small delay to ensure UI is ready
        const timer = setTimeout(() => {
          setWalkthroughStarted(true);
          // Start from step 7 (Edit Tools) using the step name
          start('🎛️ Edit Tools');
        }, 800);
        return () => clearTimeout(timer);
      }
    }, [walkthroughLoading, shouldShowWalkthrough, walkthroughStarted, start])
  );

  // Listen for walkthrough completion
  useEffect(() => {
    const handleStop = () => {
      // Only complete Edit walkthrough if we started it and current step is in Edit range (7-9)
      const stepOrder = currentStep?.order ?? 0;
      if (walkthroughStarted && stepOrder >= 7 && stepOrder <= 9) {
        completeWalkthrough();
        setWalkthroughStarted(false);
      }
    };

    copilotEvents.on('stop', handleStop);
    return () => {
      copilotEvents.off('stop', handleStop);
    };
  }, [copilotEvents, completeWalkthrough, walkthroughStarted, currentStep]);

  // Zoom animation when filtered image is ready
  useEffect(() => {
    if (filteredImageUrl && !isApplyingFilter) {
      // Reset scale and animate zoom in
      filterZoomScale.setValue(0.8);
      Animated.spring(filterZoomScale, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [filteredImageUrl, isApplyingFilter, filterZoomScale]);

  // Auto-save to history when API filter is applied
  useEffect(() => {
    if (!filteredImageUrl || !selectedImage || isApplyingFilter) return;
    if (savedToHistoryRef.current === filteredImageUrl) return;

    savedToHistoryRef.current = filteredImageUrl;

    // Get the filter name for history
    let filterName = 'AI Filter';
    if (selectedApiFilter) {
      const apiFilter = apiFilters.flatMap(c => c.filters).find(f => f.id === selectedApiFilter);
      if (apiFilter) {
        filterName = apiFilter.name;
      }
    }

    dispatch(
      addToHistory({
        sourceImage: selectedImage,
        transformedImage: filteredImageUrl,
        sightName: `Edit: ${filterName}`,
        sightId: selectedApiFilter,
        accessories: [],
        prompt: 'Photo Edit',
      })
    );
    console.log('EditScreen: Auto-saved to history:', filterName);
  }, [filteredImageUrl, selectedImage, isApplyingFilter, selectedApiFilter, apiFilters, dispatch]);

  // Fetch API filters on mount (grouped with thumbnails)
  useEffect(() => {
    const fetchFilters = async () => {
      setIsLoadingFilters(true);
      try {
        // Use grouped endpoint which includes thumbnails
        const grouped = await filtersApi.getFiltersGrouped();
        if (Array.isArray(grouped) && grouped.length > 0) {
          setApiFilters(grouped);
        } else {
          setApiFilters([]);
        }
      } catch (error) {
        // Silently fail - local filters will still work
        console.warn('Could not fetch API filters:', error);
        setApiFilters([]);
      } finally {
        setIsLoadingFilters(false);
      }
    };

    fetchFilters();
  }, []);

  // Helper to identify frame/border categories
  const isFrameCategory = (categoryName: string, categoryId?: string): boolean => {
    const lowerName = categoryName.toLowerCase().trim();
    const lowerId = categoryId?.toLowerCase().trim() || '';
    // Match by name or id containing frame/border keywords
    const frameKeywords = ['frame', 'border'];
    return frameKeywords.some(keyword =>
      lowerName.includes(keyword) || lowerId.includes(keyword)
    );
  };

  // Get frame/border filters from API
  const getFrameFilters = useCallback((): ApiFilter[] => {
    const frameFilters: ApiFilter[] = [];
    apiFilters.forEach(cat => {
      if (isFrameCategory(cat.categoryName, cat.categoryId)) {
        frameFilters.push(...cat.filters);
      }
    });
    return frameFilters;
  }, [apiFilters]);

  // Get non-frame filters (for Filters modal)
  const getNonFrameApiFilters = useCallback((): FilterCategory[] => {
    return apiFilters.filter(cat => !isFrameCategory(cat.categoryName, cat.categoryId));
  }, [apiFilters]);

  // Load recent filters from AsyncStorage on mount
  useEffect(() => {
    const loadRecentFilters = async () => {
      try {
        const stored = await AsyncStorage.getItem(RECENT_FILTERS_KEY);
        if (stored) {
          setRecentFilters(JSON.parse(stored));
        }
      } catch (error) {
        console.warn('Could not load recent filters:', error);
      }
    };
    loadRecentFilters();
  }, []);

  // Default to "Vintage" category when there are no recent filters
  useEffect(() => {
    // Only run when API filters are loaded and we're still on 'recent' category
    if (apiFilters.length === 0 || selectedFilterCategory !== 'recent') {
      return;
    }
    // If there are no recent filters, switch to Vintage category
    if (recentFilters.length === 0) {
      // Find Vintage category (case-insensitive)
      const nonFrameCategories = apiFilters.filter(cat => {
        const lowerName = cat.categoryName.toLowerCase().trim();
        const lowerId = cat.categoryId?.toLowerCase().trim() || '';
        const frameKeywords = ['frame', 'border'];
        return !frameKeywords.some(keyword => lowerName.includes(keyword) || lowerId.includes(keyword));
      });
      const vintageCategory = nonFrameCategories.find(
        cat => cat.categoryName.toLowerCase().includes('vintage')
      );
      if (vintageCategory) {
        setSelectedFilterCategory(vintageCategory.categoryId);
      } else if (nonFrameCategories.length > 0) {
        // Fallback to first non-frame category
        setSelectedFilterCategory(nonFrameCategories[0].categoryId);
      }
    }
  }, [apiFilters, recentFilters.length, selectedFilterCategory]);

  // Save a filter to recent filters
  const addToRecentFilters = useCallback(async (filter: RecentFilter) => {
    setRecentFilters(prev => {
      // Check if already exists - if so, don't add again
      const exists = prev.some(f => f.id === filter.id && f.type === filter.type);
      if (exists) {
        return prev;
      }
      // Add to front with current timestamp
      const updated = [{...filter, usedAt: Date.now()}, ...prev].slice(0, MAX_RECENT_FILTERS);
      // Save to AsyncStorage
      AsyncStorage.setItem(RECENT_FILTERS_KEY, JSON.stringify(updated)).catch(err =>
        console.warn('Could not save recent filters:', err)
      );
      return updated;
    });
  }, []);

  // Store original image when selected for filter operations
  useEffect(() => {
    if (selectedImage && !originalImageForFilter) {
      setOriginalImageForFilter(selectedImage);
    }
  }, [selectedImage, originalImageForFilter]);

  // Reset comparison state when image changes
  useEffect(() => {
    setShowComparison(false);
  }, [selectedImage]);

  // Handle applying API filter
  const handleApplyApiFilter = useCallback(async (filterId: string, filterName?: string) => {
    if (!selectedImage) {
      // No photo selected - store the pending filter and open photo picker
      const pending = {id: filterId, name: filterName};
      setPendingFilter(pending);
      pendingFilterRef.current = pending;
      setFiltersModalVisible(false);
      setShowPhotoPicker(true);
      return;
    }

    // Use original image to apply filter, not already filtered one
    const imageToFilter = originalImageForFilter || selectedImage;

    setIsApplyingFilter(true);
    setSelectedApiFilter(filterId);
    // Clear local filter when using API filter
    setSelectedFilter('original');
    // Close the modal when request starts
    setFiltersModalVisible(false);

    // Find filter name and thumbnail if not provided
    let name = filterName;
    let thumbnailUrl: string | undefined;
    let estimatedCoins: number | undefined;
    let isFree: boolean | undefined;
    for (const cat of apiFilters) {
      const found = cat.filters.find(f => f.id === filterId);
      if (found) {
        if (!name) name = found.name;
        thumbnailUrl = found.thumbnailUrl ?? undefined;
        estimatedCoins = found.estimatedCoins;
        isFree = found.isFree;
        break;
      }
    }

    // Add to recent filters
    addToRecentFilters({
      id: filterId,
      name: name || 'AI Filter',
      thumbnailUrl: thumbnailUrl || undefined,
      usedAt: Date.now(),
      estimatedCoins,
      isFree,
    });

    try {
      const result = await filtersApi.applyFilter(imageToFilter, filterId, accessToken || undefined);
      setFilteredImageUrl(result.imageUrl);
    } catch (error) {
      console.error('Failed to apply filter:', error);
      showMessage('error', 'Error', 'Failed to apply filter. Please try again.');
      setSelectedApiFilter(null);
    } finally {
      setIsApplyingFilter(false);
    }
  }, [selectedImage, originalImageForFilter, apiFilters, addToRecentFilters, accessToken]);

  // Basic filters removed - all filters now come from API
  // const handleSelectLocalFilter = useCallback((filterId: string) => {
  //   setSelectedFilter(filterId);
  //   setSelectedApiFilter(null);
  //   setFilteredImageUrl(null);
  // }, []);

  // Sidebar swipe animation
  const sidebarPan = useRef(new Animated.Value(0)).current;

  // Available fonts - expanded list
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

  // Available colors - expanded
  const TEXT_COLORS = [
    '#ffffff', '#f5f5f5', '#e0e0e0', '#9e9e9e', '#616161',
    '#000000', '#ff0000', '#e91e63', '#9c27b0', '#673ab7',
    '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688',
    '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107',
    '#ff9800', '#ff5722', '#795548', '#607d8b', '#00ff00',
  ];

  // Background colors for text
  const BG_COLORS = [
    'transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)',
    'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.7)',
    'rgba(255,0,0,0.5)', 'rgba(0,0,255,0.5)', 'rgba(0,255,0,0.5)',
  ];

  // Instagram Stories-style text presets
  const TEXT_PRESETS = [
    {
      id: 'classic',
      name: 'Classic',
      preview: 'Aa',
      previewStyle: {color: '#fff', fontWeight: '700' as const, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 3},
      settings: {fontFamily: 'default', color: '#ffffff', bold: true, italic: false, underline: false, shadow: true, bgEnabled: false, bgColor: 'transparent', fontSize: 28},
    },
    {
      id: 'modern',
      name: 'Modern',
      preview: 'Aa',
      previewStyle: {color: '#fff', fontWeight: '700' as const, backgroundColor: '#FF1B6D', paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden' as const},
      settings: {fontFamily: 'futura', color: '#ffffff', bold: true, italic: false, underline: false, shadow: false, bgEnabled: true, bgColor: 'rgba(255,27,109,0.85)', fontSize: 26},
    },
    {
      id: 'neon',
      name: 'Neon',
      preview: 'Aa',
      previewStyle: {color: '#00ff88', fontWeight: '300' as const, textShadowColor: '#00ff88', textShadowOffset: {width: 0, height: 0}, textShadowRadius: 10},
      settings: {fontFamily: 'elegant', color: '#00ff88', bold: false, italic: false, underline: false, shadow: true, bgEnabled: false, bgColor: 'transparent', fontSize: 30},
    },
    {
      id: 'typewriter',
      name: 'Type',
      preview: 'Aa',
      previewStyle: {color: '#333', fontFamily: Platform.OS === 'ios' ? 'American Typewriter' : 'monospace', backgroundColor: '#f5f5f5', paddingHorizontal: 6, borderRadius: 2, overflow: 'hidden' as const},
      settings: {fontFamily: 'typewriter', color: '#333333', bold: false, italic: false, underline: false, shadow: false, bgEnabled: true, bgColor: 'rgba(245,245,245,0.95)', fontSize: 22},
    },
    {
      id: 'strong',
      name: 'Strong',
      preview: 'Aa',
      previewStyle: {color: '#fff', fontWeight: '900' as const, backgroundColor: '#000', paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden' as const, letterSpacing: 2},
      settings: {fontFamily: 'impact', color: '#ffffff', bold: true, italic: false, underline: false, shadow: false, bgEnabled: true, bgColor: 'rgba(0,0,0,0.85)', fontSize: 28},
    },
    {
      id: 'script',
      name: 'Script',
      preview: 'Aa',
      previewStyle: {color: '#FFD700', fontStyle: 'italic' as const, fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 2},
      settings: {fontFamily: 'handwriting', color: '#FFD700', bold: false, italic: true, underline: false, shadow: true, bgEnabled: false, bgColor: 'transparent', fontSize: 30},
    },
  ];

  const applyTextPreset = (presetId: string) => {
    const preset = TEXT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const s = preset.settings;
    setTextFontFamily(s.fontFamily);
    setTextColor(s.color);
    setTextBold(s.bold);
    setTextItalic(s.italic);
    setTextUnderline(s.underline);
    setTextShadow(s.shadow);
    setTextBackgroundEnabled(s.bgEnabled);
    setTextBackgroundColor(s.bgColor);
    setTextFontSize(s.fontSize);
    setActivePreset(presetId);
  };

  // Sidebar swipe responder
  const sidebarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx > 10 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          sidebarPan.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 100) {
          // Close sidebar
          Animated.timing(sidebarPan, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setTextSidebarVisible(false);
            sidebarPan.setValue(0);
          });
        } else {
          // Snap back
          Animated.spring(sidebarPan, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // PanResponder for dragging text (detects tap vs drag to re-enter editing)
  const textDraggedRef = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isResizing,
      onMoveShouldSetPanResponder: () => !isResizing,
      onPanResponderGrant: () => {
        textDraggedRef.current = false;
        setTextSelected(true);
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({x: 0, y: 0});
      },
      onPanResponderMove: (e, gestureState) => {
        if (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3) {
          textDraggedRef.current = true;
        }
        Animated.event([null, {dx: pan.x, dy: pan.y}], {
          useNativeDriver: false,
        })(e, gestureState);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // Tap (no drag) on text → re-enter inline editing
        if (!textDraggedRef.current) {
          setIsEditingText(true);
          setTimeout(() => inlineTextInputRef.current?.focus(), 150);
        }
      },
    })
  ).current;

  // PanResponder for resizing text box
  const resizePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsResizing(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const newWidth = Math.max(80, Math.min(300, textBoxWidth + gestureState.dx));
        setTextBoxWidth(newWidth);
      },
      onPanResponderRelease: () => {
        setIsResizing(false);
      },
    })
  ).current;

  // PanResponder for rotating text by dragging the rotation handle in a circular gesture
  const rotationPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        rotationStartRef.current = textRotationRef.current;
        // Measure the text wrapper to find its center on screen
        textWrapperRef.current?.measure?.((_x, _y, w, h, pageX, pageY) => {
          textCenterRef.current = {x: pageX + w / 2, y: pageY + h / 2};
          const dx = e.nativeEvent.pageX - textCenterRef.current.x;
          const dy = e.nativeEvent.pageY - textCenterRef.current.y;
          initialAngleRef.current = Math.atan2(dy, dx) * (180 / Math.PI);
        });
      },
      onPanResponderMove: (e) => {
        const center = textCenterRef.current;
        if (center.x === 0 && center.y === 0) return;
        const dx = e.nativeEvent.pageX - center.x;
        const dy = e.nativeEvent.pageY - center.y;
        const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const angleDelta = currentAngle - initialAngleRef.current;
        setTextRotation(Math.round(rotationStartRef.current + angleDelta));
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // Responsive sizing
  const isTablet = width >= 768;
  const maxImageSize = isTablet ? 500 : width - 48;
  const imageSize = Math.min(maxImageSize, height * 0.4);
  const headerPadding = isTablet ? 32 : 20;
  const themeToggleSize = isTablet ? 52 : 44;
  const themeIconSize = isTablet ? 26 : 22;

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  // Reset filter state when selecting new image
  const resetFilterState = useCallback(() => {
    setSelectedApiFilter(null);
    setFilteredImageUrl(null);
    setOriginalImageForFilter(null);
    setSelectedFilter('original');
    savedToHistoryRef.current = null;
  }, []);

  // Handle photo selection from PhotoPickerModal
  const handlePhotoPickerSelect = useCallback(async (photo: {uri: string; type?: string; fileName?: string}) => {
    resetFilterState();
    setSelectedImage(photo.uri);
    setOriginalImageForFilter(photo.uri);
    setShowComparison(false);

    // Check if there's a pending filter to apply
    const filterToApply = pendingFilterRef.current;
    if (filterToApply) {
      // Clear pending filter
      pendingFilterRef.current = null;
      setPendingFilter(null);

      // Apply the filter directly with the photo URI
      setIsApplyingFilter(true);
      setSelectedApiFilter(filterToApply.id);
      setSelectedFilter('original');

      // Find filter name and thumbnail
      let name = filterToApply.name;
      let thumbnailUrl: string | undefined;
      let estimatedCoins: number | undefined;
      let isFree: boolean | undefined;
      for (const cat of apiFilters) {
        const found = cat.filters.find(f => f.id === filterToApply.id);
        if (found) {
          if (!name) name = found.name;
          thumbnailUrl = found.thumbnailUrl ?? undefined;
          estimatedCoins = found.estimatedCoins;
          isFree = found.isFree;
          break;
        }
      }

      // Add to recent filters
      addToRecentFilters({
        id: filterToApply.id,
        name: name || 'AI Filter',
        thumbnailUrl: thumbnailUrl || undefined,
        usedAt: Date.now(),
        estimatedCoins,
        isFree,
      });

      try {
        const result = await filtersApi.applyFilter(photo.uri, filterToApply.id, accessToken || undefined);
        setFilteredImageUrl(result.imageUrl);
      } catch (error) {
        console.error('Failed to apply pending filter:', error);
        showMessage('error', 'Error', 'Failed to apply filter. Please try again.');
        setSelectedApiFilter(null);
      } finally {
        setIsApplyingFilter(false);
      }
    }
  }, [resetFilterState, apiFilters, addToRecentFilters, accessToken]);

  // Clear selected image
  const handleClearImage = useCallback(() => {
    setSelectedImage(null);
    resetFilterState();
    setOverlayText('');
    setShowComparison(false);
    setPendingFilter(null);
    pendingFilterRef.current = null;
  }, [resetFilterState]);

  // Get the current filtered image URL (either API filtered or original with local filter)
  const getCurrentFilteredImageUrl = useCallback(() => {
    if (filteredImageUrl && selectedApiFilter) {
      return filteredImageUrl;
    }
    return null; // Local filters are rendered via Skia canvas
  }, [filteredImageUrl, selectedApiFilter]);

  // Pick image from gallery
  const pickImage = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 1,
    });

    if (result.assets && result.assets[0]?.uri) {
      resetFilterState();
      setSelectedImage(result.assets[0].uri);
      setOriginalImageForFilter(result.assets[0].uri);
    }
  }, [resetFilterState]);

  // Take photo with camera
  const takePhoto = useCallback(async () => {
    const result = await launchCamera({
      mediaType: 'photo',
      quality: 1,
      presentationStyle: 'fullScreen',
    });

    if (result.assets && result.assets[0]?.uri) {
      resetFilterState();
      setSelectedImage(result.assets[0].uri);
      setOriginalImageForFilter(result.assets[0].uri);
    }
  }, [resetFilterState]);

  // Save edited image
  const handleSave = useCallback(async () => {
    if (!selectedImage || !viewShotRef.current) {
      setValidationMessage('Please select an image first to apply effects.');
      setShowValidationModal(true);
      return;
    }

    setIsSaving(true);
    // Hide text selection UI and dismiss cursor before capture
    inlineTextInputRef.current?.blur();
    setIsEditingText(false);
    setTextSelected(false);
    try {
      const hasPermission = await requestPhotoLibraryPermission();
      if (!hasPermission) {
        showMessage('warning', 'Permission Denied', 'Cannot save without permission');
        setIsSaving(false);
        setTextSelected(true);
        return;
      }

      // Small delay to let UI update (hide border/handles) before capture
      await new Promise(r => setTimeout(r, 100));

      // Capture the edited image with filters and frames
      const uri = await viewShotRef.current.capture?.();
      if (uri) {
        await CameraRoll.saveAsset(uri, {type: 'photo'});

        // Build edit description for history
        const editParts: string[] = [];
        if (selectedApiFilter) {
          const apiFilter = apiFilters.flatMap(c => c.filters).find(f => f.id === selectedApiFilter);
          if (apiFilter) editParts.push(apiFilter.name);
        }
        if (overlayText) editParts.push('Text');

        // Save to history
        try {
          await dispatch(
            addToHistory({
              sourceImage: selectedImage,
              transformedImage: uri,
              sightName: editParts.length > 0 ? `Edit: ${editParts.join(', ')}` : 'Photo Edit',
              sightId: null,
              accessories: [],
              prompt: 'Photo Edit',
            })
          ).unwrap();
          console.log('EditScreen: Saved to history successfully');
        } catch (historyError) {
          console.error('EditScreen: Failed to save to history:', historyError);
        }

        showMessage('success', 'Saved!', 'Photo saved to your gallery');
      }
    } catch (error) {
      console.error('Save error:', error);
      showMessage('error', 'Error', 'Failed to save photo');
    } finally {
      setIsSaving(false);
      setTextSelected(true);
    }
  }, [selectedImage, selectedFilter, selectedFrame, selectedApiFilter, apiFilters, overlayText, dispatch]);

  // Share edited image
  const handleShare = useCallback(async () => {
    if (!selectedImage || !viewShotRef.current) {
      setValidationMessage('Please select an image first to apply effects.');
      setShowValidationModal(true);
      return;
    }

    // Hide text selection UI and dismiss cursor before capture
    inlineTextInputRef.current?.blur();
    setIsEditingText(false);
    setTextSelected(false);
    await new Promise(r => setTimeout(r, 100));

    try {
      const uri = await viewShotRef.current.capture?.();
      if (uri) {
        await Share.open({
          url: uri,
          type: 'image/png',
        });
      }
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Share error:', error);
      }
    } finally {
      setTextSelected(true);
    }
  }, [selectedImage]);


  // Load images into Skia manually (useImage doesn't handle file:// URIs reliably)
  const [skiaImage, setSkiaImage] = useState<SkImage | null>(null);
  const [skiaFilteredImage, setSkiaFilteredImage] = useState<SkImage | null>(null);

  const loadSkiaImage = useCallback(async (uri: string | null): Promise<SkImage | null> => {
    if (!uri) return null;
    try {
      if (uri.startsWith('file://') || uri.startsWith('/') || uri.startsWith('ph://')) {
        // Local file - read as base64 and decode
        const filePath = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
        const base64 = await RNFS.readFile(filePath, 'base64');
        const data = Skia.Data.fromBase64(base64);
        return Skia.Image.MakeImageFromEncoded(data);
      } else {
        // Remote URL - fetch and decode
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        const data = Skia.Data.fromBytes(new Uint8Array(arrayBuffer));
        return Skia.Image.MakeImageFromEncoded(data);
      }
    } catch (err) {
      console.warn('Failed to load Skia image:', uri, err);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSkiaImage(null);
    if (selectedImage) {
      loadSkiaImage(selectedImage).then(img => {
        if (!cancelled) setSkiaImage(img);
      });
    }
    return () => { cancelled = true; };
  }, [selectedImage, loadSkiaImage]);

  useEffect(() => {
    let cancelled = false;
    setSkiaFilteredImage(null);
    if (filteredImageUrl) {
      loadSkiaImage(filteredImageUrl).then(img => {
        if (!cancelled) setSkiaFilteredImage(img);
      });
    }
    return () => { cancelled = true; };
  }, [filteredImageUrl, loadSkiaImage]);

  // Multiply two 4x5 color matrices
  const multiplyColorMatrices = (a: number[], b: number[]): number[] => {
    const result = new Array(20).fill(0);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 5; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[i * 5 + k] * b[k * 5 + j];
        }
        if (j === 4) {
          sum += a[i * 5 + 4];
        }
        result[i * 5 + j] = sum;
      }
    }
    return result;
  };

  // Get color matrix for the selected filter with adjustments
  const getColorMatrix = (): number[] => {
    // Identity matrix (no change)
    const identity = [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Brightness adjustment matrix
    const brightnessOffset = brightness - 1;
    const brightnessMatrix = [
      1, 0, 0, 0, brightnessOffset,
      0, 1, 0, 0, brightnessOffset,
      0, 0, 1, 0, brightnessOffset,
      0, 0, 0, 1, 0,
    ];

    // Contrast adjustment matrix
    const c = contrast;
    const t = (1 - c) / 2;
    const contrastMatrix = [
      c, 0, 0, 0, t,
      0, c, 0, 0, t,
      0, 0, c, 0, t,
      0, 0, 0, 1, 0,
    ];

    // Saturation adjustment matrix
    const s = saturation;
    const sr = (1 - s) * 0.2126;
    const sg = (1 - s) * 0.7152;
    const sb = (1 - s) * 0.0722;
    const saturationMatrix = [
      sr + s, sg, sb, 0, 0,
      sr, sg + s, sb, 0, 0,
      sr, sg, sb + s, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Grayscale matrix
    const grayscale = [
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Sepia matrix
    const sepia = [
      0.393, 0.769, 0.189, 0, 0,
      0.349, 0.686, 0.168, 0, 0,
      0.272, 0.534, 0.131, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Warm (increase red, decrease blue)
    const warm = [
      1.2, 0, 0, 0, 0,
      0, 1.0, 0, 0, 0,
      0, 0, 0.8, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Cool (decrease red, increase blue)
    const cool = [
      0.8, 0, 0, 0, 0,
      0, 1.0, 0, 0, 0,
      0, 0, 1.2, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Vivid (increased saturation)
    const vivid = [
      1.5, -0.25, -0.25, 0, 0,
      -0.25, 1.5, -0.25, 0, 0,
      -0.25, -0.25, 1.5, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Vintage (sepia-ish with reduced saturation)
    const vintage = [
      0.6, 0.4, 0.2, 0, 0,
      0.3, 0.6, 0.2, 0, 0,
      0.2, 0.4, 0.5, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Retro (warm with boosted contrast)
    const retro = [
      1.3, 0.1, 0, 0, 0,
      0.1, 1.2, 0, 0, 0,
      0, 0, 0.9, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Fade (reduced contrast, washed out)
    const fade = [
      0.9, 0.05, 0.05, 0, 0.1,
      0.05, 0.9, 0.05, 0, 0.1,
      0.05, 0.05, 0.9, 0, 0.1,
      0, 0, 0, 1, 0,
    ];

    // Dramatic (high contrast, desaturated)
    const dramatic = [
      1.3, -0.15, -0.15, 0, -0.1,
      -0.15, 1.3, -0.15, 0, -0.1,
      -0.15, -0.15, 1.3, 0, -0.1,
      0, 0, 0, 1, 0,
    ];

    // Get filter matrix based on selection
    let filterMatrix: number[];
    switch (selectedFilter) {
      case 'sepia':
        filterMatrix = sepia;
        break;
      case 'bw':
        filterMatrix = grayscale;
        break;
      case 'warm':
        filterMatrix = warm;
        break;
      case 'cool':
        filterMatrix = cool;
        break;
      case 'vivid':
        filterMatrix = vivid;
        break;
      case 'vintage':
        filterMatrix = vintage;
        break;
      case 'retro':
        filterMatrix = retro;
        break;
      case 'fade':
        filterMatrix = fade;
        break;
      case 'dramatic':
        filterMatrix = dramatic;
        break;
      default:
        filterMatrix = identity;
    }

    // Combine adjustments: brightness -> contrast -> saturation -> filter
    let result = brightnessMatrix;
    result = multiplyColorMatrices(contrastMatrix, result);
    result = multiplyColorMatrices(saturationMatrix, result);
    result = multiplyColorMatrices(filterMatrix, result);

    return result;
  };

  // Calculate frame dimensions based on frame type
  const getFrameDimensions = () => {
    const padding = 20;
    const bottomExtra = selectedFrame === 'polaroid' ? 50 : selectedFrame === 'instant' ? 40 : 0;
    const sideExtra = selectedFrame === 'filmstrip' ? 30 : 0;

    switch (selectedFrame) {
      case 'polaroid':
        return {
          canvasWidth: imageSize + padding * 2,
          canvasHeight: imageSize + padding + bottomExtra + padding,
          imgX: padding,
          imgY: padding,
          imgWidth: imageSize,
          imgHeight: imageSize,
        };
      case 'filmstrip':
        return {
          canvasWidth: imageSize + sideExtra * 2,
          canvasHeight: imageSize + padding * 2,
          imgX: sideExtra,
          imgY: padding,
          imgWidth: imageSize,
          imgHeight: imageSize,
        };
      case 'instant':
        return {
          canvasWidth: imageSize + padding * 2,
          canvasHeight: imageSize + padding + bottomExtra + padding,
          imgX: padding,
          imgY: padding,
          imgWidth: imageSize,
          imgHeight: imageSize,
        };
      case 'stamp':
        return {
          canvasWidth: imageSize + 40,
          canvasHeight: imageSize + 40,
          imgX: 20,
          imgY: 20,
          imgWidth: imageSize,
          imgHeight: imageSize,
        };
      case 'vintage':
      case 'grunge':
      case 'tape':
        return {
          canvasWidth: imageSize + 30,
          canvasHeight: imageSize + 30,
          imgX: 15,
          imgY: 15,
          imgWidth: imageSize,
          imgHeight: imageSize,
        };
      default:
        return {
          canvasWidth: imageSize,
          canvasHeight: imageSize,
          imgX: 0,
          imgY: 0,
          imgWidth: imageSize,
          imgHeight: imageSize,
        };
    }
  };

  // Render film strip sprocket holes
  const renderFilmStripHoles = (canvasWidth: number, canvasHeight: number) => {
    const holes = [];
    const holeSize = 8;
    const spacing = 20;
    const numHoles = Math.floor((canvasHeight - 20) / spacing);

    for (let i = 0; i < numHoles; i++) {
      const y = 10 + i * spacing;
      // Left side holes
      holes.push(
        <RoundedRect
          key={`left-${i}`}
          x={5}
          y={y}
          width={holeSize}
          height={holeSize * 1.5}
          r={2}
          color="#111"
        />
      );
      // Right side holes
      holes.push(
        <RoundedRect
          key={`right-${i}`}
          x={canvasWidth - 13}
          y={y}
          width={holeSize}
          height={holeSize * 1.5}
          r={2}
          color="#111"
        />
      );
    }
    return holes;
  };

  // Render torn edge path
  const createTornEdgePath = (width: number, height: number) => {
    const path = Skia.Path.Make();
    const tearSize = 8;

    // Top edge
    path.moveTo(0, tearSize);
    for (let x = 0; x < width; x += tearSize) {
      const randomY = Math.random() * tearSize;
      path.lineTo(x + tearSize / 2, randomY);
      path.lineTo(x + tearSize, tearSize);
    }

    // Right edge
    for (let y = tearSize; y < height - tearSize; y += tearSize) {
      const randomX = width - Math.random() * tearSize;
      path.lineTo(randomX, y + tearSize / 2);
      path.lineTo(width - tearSize, y + tearSize);
    }

    // Bottom edge
    for (let x = width; x > 0; x -= tearSize) {
      const randomY = height - Math.random() * tearSize;
      path.lineTo(x - tearSize / 2, randomY);
      path.lineTo(x - tearSize, height - tearSize);
    }

    // Left edge
    for (let y = height - tearSize; y > tearSize; y -= tearSize) {
      const randomX = Math.random() * tearSize;
      path.lineTo(randomX, y - tearSize / 2);
      path.lineTo(tearSize, y - tearSize);
    }

    path.close();
    return path;
  };

  // Render stamp perforations
  const renderStampPerforations = (width: number, height: number) => {
    const perfs = [];
    const perfRadius = 4;
    const spacing = 15;

    // Top and bottom
    for (let x = spacing; x < width; x += spacing) {
      perfs.push(<Circle key={`top-${x}`} cx={x} cy={5} r={perfRadius} color="#f5f5f5" />);
      perfs.push(<Circle key={`bottom-${x}`} cx={x} cy={height - 5} r={perfRadius} color="#f5f5f5" />);
    }

    // Left and right
    for (let y = spacing; y < height; y += spacing) {
      perfs.push(<Circle key={`left-${y}`} cx={5} cy={y} r={perfRadius} color="#f5f5f5" />);
      perfs.push(<Circle key={`right-${y}`} cx={width - 5} cy={y} r={perfRadius} color="#f5f5f5" />);
    }

    return perfs;
  };

  // Render tape corners
  const renderTapeCorners = (width: number, height: number) => {
    const tapeWidth = 40;
    const tapeHeight = 15;

    return (
      <>
        {/* Top-left tape */}
        <Group transform={[{rotate: -0.3}, {translateX: -5}, {translateY: 5}]}>
          <RoundedRect x={0} y={0} width={tapeWidth} height={tapeHeight} r={2} color="rgba(255, 220, 150, 0.7)" />
        </Group>
        {/* Top-right tape */}
        <Group transform={[{rotate: 0.3}, {translateX: width - 35}, {translateY: 5}]}>
          <RoundedRect x={0} y={0} width={tapeWidth} height={tapeHeight} r={2} color="rgba(255, 220, 150, 0.7)" />
        </Group>
        {/* Bottom-left tape */}
        <Group transform={[{rotate: 0.3}, {translateX: -5}, {translateY: height - 20}]}>
          <RoundedRect x={0} y={0} width={tapeWidth} height={tapeHeight} r={2} color="rgba(255, 220, 150, 0.7)" />
        </Group>
        {/* Bottom-right tape */}
        <Group transform={[{rotate: -0.3}, {translateX: width - 35}, {translateY: height - 20}]}>
          <RoundedRect x={0} y={0} width={tapeWidth} height={tapeHeight} r={2} color="rgba(255, 220, 150, 0.7)" />
        </Group>
      </>
    );
  };

  // Create vignette gradient path
  const renderVignette = (width: number, height: number) => {
    const cx = width / 2;
    const cy = height / 2;
    const outerRadius = Math.max(width, height) * 0.8;
    const innerRadius = Math.min(width, height) * 0.3;

    return (
      <>
        {/* Outer dark vignette */}
        <Circle cx={cx} cy={cy} r={outerRadius}>
          <Paint style="fill" color="transparent" />
        </Circle>
        {/* Semi-transparent corners */}
        <Rect x={0} y={0} width={width} height={height} color="rgba(0,0,0,0.3)">
          <Paint style="fill" />
        </Rect>
        <Circle cx={cx} cy={cy} r={outerRadius * 0.7} color="rgba(0,0,0,0)" />
      </>
    );
  };

  // Render the filtered image using Skia with frames
  const renderFilteredImage = () => {
    // Use the API-filtered image if available, otherwise the original
    const activeSkiaImage = (filteredImageUrl && selectedApiFilter && skiaFilteredImage)
      ? skiaFilteredImage
      : skiaImage;
    if (!selectedImage || !activeSkiaImage) return null;

    const matrix = getColorMatrix();
    const dims = getFrameDimensions();
    const { canvasWidth, canvasHeight, imgX, imgY, imgWidth, imgHeight } = dims;

    // Frame-specific rendering
    const renderFrame = () => {
      switch (selectedFrame) {
        case 'polaroid':
          return (
            <>
              {/* White background with shadow */}
              <RoundedRect x={0} y={0} width={canvasWidth} height={canvasHeight} r={4} color="#ffffff">
                <Shadow dx={4} dy={4} blur={10} color="rgba(0,0,0,0.3)" />
              </RoundedRect>
              {/* Image */}
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={imgX}
                y={imgY}
                width={imgWidth}
                height={imgHeight}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
            </>
          );

        case 'filmstrip':
          return (
            <>
              {/* Black film background */}
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#1a1a1a" />
              {/* Film sprocket holes */}
              {renderFilmStripHoles(canvasWidth, canvasHeight)}
              {/* Image */}
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={imgX}
                y={imgY}
                width={imgWidth}
                height={imgHeight}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
            </>
          );

        case 'instant':
          return (
            <>
              {/* Cream/white background */}
              <RoundedRect x={0} y={0} width={canvasWidth} height={canvasHeight} r={6} color="#fefefa">
                <Shadow dx={3} dy={3} blur={8} color="rgba(0,0,0,0.25)" />
              </RoundedRect>
              {/* Slight inner border */}
              <RoundedRect x={5} y={5} width={canvasWidth - 10} height={canvasHeight - 10} r={4} color="#f8f8f6" />
              {/* Image */}
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={imgX}
                y={imgY}
                width={imgWidth}
                height={imgHeight}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
            </>
          );

        case 'vintage':
          return (
            <>
              {/* Aged paper background */}
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#f5e6d3" />
              {/* Darker border */}
              <Rect x={8} y={8} width={canvasWidth - 16} height={canvasHeight - 16} color="#e8d5c0" />
              {/* Inner gold/brown border */}
              <Rect x={12} y={12} width={canvasWidth - 24} height={canvasHeight - 24} color="#8b7355">
                <Paint style="stroke" strokeWidth={2} />
              </Rect>
              {/* Image */}
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={imgX}
                y={imgY}
                width={imgWidth}
                height={imgHeight}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
            </>
          );

        case 'torn':
          return (
            <>
              {/* Off-white paper background */}
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#fffef5">
                <Shadow dx={2} dy={2} blur={6} color="rgba(0,0,0,0.2)" />
              </Rect>
              {/* Image */}
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={0}
                y={0}
                width={canvasWidth}
                height={canvasHeight}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
              {/* Torn edge overlay effect - white irregular edges */}
              <Rect x={0} y={0} width={8} height={canvasHeight} color="rgba(255,254,245,0.8)" />
              <Rect x={canvasWidth - 8} y={0} width={8} height={canvasHeight} color="rgba(255,254,245,0.8)" />
              <Rect x={0} y={0} width={canvasWidth} height={8} color="rgba(255,254,245,0.8)" />
              <Rect x={0} y={canvasHeight - 8} width={canvasWidth} height={8} color="rgba(255,254,245,0.8)" />
            </>
          );

        case 'rounded':
          return (
            <>
              {/* Rounded white background */}
              <RoundedRect x={0} y={0} width={canvasWidth} height={canvasHeight} r={24} color="#ffffff">
                <Shadow dx={0} dy={4} blur={12} color="rgba(0,0,0,0.15)" />
              </RoundedRect>
              {/* Clip image to rounded rect - using Group with clip */}
              <Group clip={rrect(rect(0, 0, canvasWidth, canvasHeight), 24, 24)}>
                <SkiaImage
                  image={activeSkiaImage}
                  fit="cover"
                  x={0}
                  y={0}
                  width={canvasWidth}
                  height={canvasHeight}
                >
                  <ColorMatrix matrix={matrix} />
                </SkiaImage>
              </Group>
            </>
          );

        case 'vignette':
          return (
            <>
              {/* Image */}
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={0}
                y={0}
                width={canvasWidth}
                height={canvasHeight}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
              {/* Vignette overlay - dark corners */}
              <Rect x={0} y={0} width={canvasWidth * 0.15} height={canvasHeight} color="rgba(0,0,0,0.4)" />
              <Rect x={canvasWidth * 0.85} y={0} width={canvasWidth * 0.15} height={canvasHeight} color="rgba(0,0,0,0.4)" />
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight * 0.15} color="rgba(0,0,0,0.3)" />
              <Rect x={0} y={canvasHeight * 0.85} width={canvasWidth} height={canvasHeight * 0.15} color="rgba(0,0,0,0.3)" />
            </>
          );

        case 'grunge':
          return (
            <>
              {/* Dark distressed background */}
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#2a2520" />
              {/* Scratchy texture lines */}
              <Line p1={vec(5, 5)} p2={vec(canvasWidth - 5, 8)} color="rgba(60,50,40,0.5)" strokeWidth={1} />
              <Line p1={vec(3, canvasHeight - 10)} p2={vec(canvasWidth - 8, canvasHeight - 5)} color="rgba(60,50,40,0.5)" strokeWidth={1} />
              {/* Image with border */}
              <Rect x={imgX - 3} y={imgY - 3} width={imgWidth + 6} height={imgHeight + 6} color="#3d3530" />
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={imgX}
                y={imgY}
                width={imgWidth}
                height={imgHeight}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
            </>
          );

        case 'tape':
          return (
            <>
              {/* Light gray background (like paper) */}
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#f0f0f0">
                <Shadow dx={2} dy={2} blur={8} color="rgba(0,0,0,0.15)" />
              </Rect>
              {/* Image */}
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={imgX}
                y={imgY}
                width={imgWidth}
                height={imgHeight}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
              {/* Tape pieces */}
              {renderTapeCorners(canvasWidth, canvasHeight)}
            </>
          );

        case 'stamp':
          return (
            <>
              {/* Stamp background */}
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#f5f0e8" />
              {/* Perforated edges */}
              {renderStampPerforations(canvasWidth, canvasHeight)}
              {/* Inner border */}
              <Rect x={15} y={15} width={canvasWidth - 30} height={canvasHeight - 30} color="#d4c9b8">
                <Paint style="stroke" strokeWidth={1} />
              </Rect>
              {/* Image */}
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={imgX}
                y={imgY}
                width={imgWidth}
                height={imgHeight}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
            </>
          );

        case 'negative':
          return (
            <>
              {/* Orange/amber film negative background */}
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#2a1810" />
              {/* Film edge markings */}
              <Rect x={0} y={0} width={canvasWidth} height={15} color="#1a1008" />
              <Rect x={0} y={canvasHeight - 15} width={canvasWidth} height={15} color="#1a1008" />
              {/* Frame numbers */}
              <RoundedRect x={10} y={2} width={20} height={10} r={2} color="#3a2818" />
              <RoundedRect x={canvasWidth - 30} y={2} width={20} height={10} r={2} color="#3a2818" />
              {/* Image with inverted colors effect built into the matrix would be better, but for now just show with sepia-ish tint */}
              <SkiaImage
                image={activeSkiaImage}
                fit="cover"
                x={0}
                y={15}
                width={canvasWidth}
                height={canvasHeight - 30}
              >
                <ColorMatrix matrix={matrix} />
              </SkiaImage>
            </>
          );

        default:
          // No frame
          return (
            <SkiaImage
              image={activeSkiaImage}
              fit="cover"
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
            >
              <ColorMatrix matrix={matrix} />
            </SkiaImage>
          );
      }
    };

    return (
      <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
        {renderFrame()}
      </Canvas>
    );
  };

  // Render edit mode tabs
  const renderModeTabs = () => (
    <View style={[styles.modeTabs, {backgroundColor: colors.backgroundSecondary}]}>
      {[
        {id: 'filters', icon: 'color-filter', label: 'Filters'},
        {id: 'frames', icon: 'image', label: 'Frames'},
        {id: 'text', icon: 'text', label: 'Text'},
        {id: 'adjust', icon: 'options', label: 'Adjust'},
        {id: 'caption', icon: 'chatbubble-ellipses', label: 'Caption'},
      ].map(tab => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.modeTab,
            editMode === tab.id && {backgroundColor: colors.primary + '20'},
          ]}
          onPress={() => setEditMode(tab.id as EditMode)}
          activeOpacity={0.7}>
          <Ionicons
            name={tab.icon as any}
            size={20}
            color={editMode === tab.id ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.modeTabText,
              {color: editMode === tab.id ? colors.primary : colors.textSecondary},
            ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Get all filter categories (recent + basic + API)
  const getAllCategories = () => {
    const categories: {id: string; name: string}[] = [];
    // Add Recent category first (only if there are recent filters)
    if (recentFilters.length > 0) {
      categories.push({id: 'recent', name: 'Recent'});
    }
    // Add API filter categories (excluding frame/border categories)
    getNonFrameApiFilters().forEach(cat => {
      categories.push({id: cat.categoryId, name: cat.categoryName});
    });
    return categories;
  };

  // Get filters for selected category
  const getFiltersForCategory = () => {
    return apiFilters.find(cat => cat.categoryId === selectedFilterCategory)?.filters || [];
  };

  // Get current filter name for display
  const getCurrentFilterName = () => {
    if (selectedApiFilter) {
      for (const cat of apiFilters) {
        const filter = cat.filters.find(f => f.id === selectedApiFilter);
        if (filter) return filter.name;
      }
      return 'AI Filter';
    }
    return 'Original';
  };

  // Get total filter count (excluding frame/border categories)
  const getTotalFilterCount = () => {
    let count = 0;
    getNonFrameApiFilters().forEach(cat => {
      count += cat.filters.length;
    });
    return count;
  };

  // Render filters panel (shows button to open modal)
  const renderFiltersPanel = () => {
    const currentFilterName = getCurrentFilterName();
    const totalFilters = getTotalFilterCount();

    return (
      <View style={styles.filtersPanelSimple}>
        <TouchableOpacity
          style={[styles.openFiltersButton, {backgroundColor: colors.backgroundTertiary}]}
          onPress={() => setFiltersModalVisible(true)}
          activeOpacity={0.8}>
          {/* Recent filters thumbnails */}
          <View style={styles.recentFiltersThumbnails}>
            {recentFilters.length === 0 ? (
              <Text style={[styles.recentFiltersPlaceholder, {color: colors.textTertiary}]}>
                Tap to apply filters
              </Text>
            ) : (
              recentFilters.slice(0, 3).map(recentFilter => {
                const isSelected = selectedApiFilter === recentFilter.id;
                return (
                  <TouchableOpacity
                    key={`thumb-${recentFilter.id}`}
                    style={styles.recentFilterThumbContainer}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleApplyApiFilter(recentFilter.id, recentFilter.name);
                    }}
                    disabled={isApplyingFilter}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.recentFilterThumb,
                        {backgroundColor: colors.background, borderColor: colors.border},
                        isSelected && {borderColor: colors.primary, borderWidth: 2},
                      ]}>
                      {getFullThumbnailUrl(recentFilter.thumbnailUrl) ? (
                        <Image
                          source={{uri: getFullThumbnailUrl(recentFilter.thumbnailUrl)!}}
                          style={styles.recentFilterThumbImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="sparkles" size={18} color={colors.primary} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.recentFilterThumbLabel,
                        {color: isSelected ? colors.primary : colors.textSecondary},
                      ]}
                      numberOfLines={1}>
                      {recentFilter.name}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Right side - count badge and chevron */}
          <View style={styles.openFiltersRight}>
            <View style={[styles.filterCountBadge, {backgroundColor: colors.primary}]}>
              <Text style={styles.filterCountText}>{totalFilters}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Render filters modal
  const renderFiltersModal = () => {
    const categories = getAllCategories();
    const searchQuery = filterSearchQuery.toLowerCase().trim();

    const getFilterCount = (categoryId: string) => {
      if (categoryId === 'recent') return recentFilters.length;
      const cat = getNonFrameApiFilters().find(c => c.categoryId === categoryId);
      return cat?.filters.length || 0;
    };

    // Get all filters for search (when searching, show results from all categories - excluding frames/borders)
    const getAllFiltersForSearch = () => {
      if (!searchQuery) return null;

      const results: {type: 'api'; filter: any; categoryName?: string}[] = [];

      // Search API filters (exclude frame/border categories)
      getNonFrameApiFilters().forEach(category => {
        category.filters.forEach(filter => {
          if (filter.name.toLowerCase().includes(searchQuery)) {
            results.push({type: 'api', filter, categoryName: category.categoryName});
          }
        });
      });

      return results;
    };

    // Get filters for current category (when not searching)
    const getFiltersForCurrentCategory = () => {
      return getNonFrameApiFilters().find(cat => cat.categoryId === selectedFilterCategory)?.filters || [];
    };

    const searchResults = getAllFiltersForSearch();
    const isSearching = searchQuery.length > 0;
    const currentFilters = isSearching ? null : getFiltersForCurrentCategory();

    return (
      <Modal
        visible={filtersModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setFiltersModalVisible(false);
          setFilterSearchQuery('');
        }}>
        <View style={[styles.filtersModalContainer, {backgroundColor: colors.background}]}>
          {/* Modal Header */}
          <View style={[styles.filtersModalHeader, {borderBottomColor: colors.border}]}>
            <Text style={[styles.filtersModalTitle, {color: colors.textPrimary}]}>Filters & Effects</Text>
            <TouchableOpacity
              style={[styles.filtersModalClose, {backgroundColor: colors.backgroundTertiary}]}
              onPress={() => {
                setFiltersModalVisible(false);
                setFilterSearchQuery('');
              }}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.filterSearchContainer, {backgroundColor: colors.backgroundSecondary}]}>
            <View style={[styles.filterSearchBar, {backgroundColor: colors.backgroundTertiary}]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                style={[styles.filterSearchInput, {color: colors.textPrimary}]}
                placeholder="Search filters..."
                placeholderTextColor={colors.textTertiary}
                value={filterSearchQuery}
                onChangeText={setFilterSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {filterSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setFilterSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search Results Header */}
          {isSearching && (
            <View style={styles.searchResultsHeader}>
              <Text style={[styles.searchResultsText, {color: colors.textSecondary}]}>
                {searchResults?.length || 0} results for "{filterSearchQuery}"
              </Text>
            </View>
          )}

          {/* Filters Grid */}
          <ScrollView
            style={styles.filtersGridScroll}
            contentContainerStyle={styles.filtersGridContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.filtersGrid}>
              {isLoadingFilters ? (
                // Skeleton tiles while loading
                Array.from({length: 6}).map((_, idx) => (
                  <View
                    key={`skeleton-${idx}`}
                    style={[
                      styles.filterGridTile,
                      {backgroundColor: colors.backgroundTertiary},
                    ]}>
                    <View style={[styles.filterGridPreview, {backgroundColor: colors.backgroundSecondary}]}>
                      <ActivityIndicator size="small" color={colors.primary} style={{opacity: 0.4}} />
                    </View>
                    <View style={{width: '60%', height: 12, borderRadius: 6, backgroundColor: colors.backgroundSecondary, marginTop: 8}} />
                  </View>
                ))
              ) : isSearching ? (
                // Search results
                searchResults && searchResults.length > 0 ? (
                  searchResults.map((item) => {
                    const filter = item.filter;
                    const isSelected = selectedApiFilter === filter.id;
                    const isLoading = isApplyingFilter && isSelected;
                    return (
                      <TouchableOpacity
                        key={`api-${filter.id}`}
                        style={[
                          styles.filterGridTile,
                          {backgroundColor: colors.backgroundTertiary},
                          isSelected && {borderColor: colors.primary, borderWidth: 2},
                          isApplyingFilter && !isSelected && {opacity: 0.5},
                        ]}
                        onPress={() => handleApplyApiFilter(filter.id)}
                        onLongPress={() => {
                          triggerHaptic();
                          setPeekFilter({name: filter.name, thumbnailUrl: filter.thumbnailUrl});
                        }}
                        delayLongPress={300}
                        disabled={isApplyingFilter}
                        activeOpacity={0.8}>
                        <View style={[styles.filterGridPreview, {backgroundColor: colors.backgroundSecondary}]}>
                          {isLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} />
                          ) : (
                            <>
                              {getFullThumbnailUrl(filter.thumbnailUrl) ? (
                                <FilterImageWithLoader
                                  uri={getFullThumbnailUrl(filter.thumbnailUrl)!}
                                  style={styles.filterGridThumbnail}
                                />
                              ) : (
                                <Ionicons name="sparkles" size={32} color={colors.primary} />
                              )}
                              <PriceBadge estimatedCoins={filter.estimatedCoins} isFree={filter.isFree} variant="modal" />
                              {isSelected && (
                                <View style={[styles.filterGridBadge, {backgroundColor: colors.primary}]}>
                                  <Ionicons name="checkmark" size={14} color="#fff" />
                                </View>
                              )}
                            </>
                          )}
                        </View>
                        <Text
                          style={[styles.filterGridName, {color: isSelected ? colors.primary : colors.textPrimary}]}
                          numberOfLines={1}>
                          {filter.name}
                        </Text>
                        <Text style={[styles.filterGridCategory, {color: colors.textTertiary}]} numberOfLines={1}>
                          {item.categoryName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyFiltersModal}>
                    <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.emptyFiltersModalText, {color: colors.textTertiary}]}>
                      No filters found for "{filterSearchQuery}"
                    </Text>
                  </View>
                )
              ) : selectedFilterCategory === 'recent' ? (
                // Recent filters
                recentFilters.length > 0 ? (
                  recentFilters.map(recentFilter => {
                    const isSelected = selectedApiFilter === recentFilter.id;
                    const isLoading = isApplyingFilter && isSelected;
                    return (
                      <TouchableOpacity
                        key={`recent-${recentFilter.id}`}
                        style={[
                          styles.filterGridTile,
                          {backgroundColor: colors.backgroundTertiary},
                          isSelected && {borderColor: colors.primary, borderWidth: 2},
                          isApplyingFilter && !isSelected && {opacity: 0.5},
                        ]}
                        onPress={() => handleApplyApiFilter(recentFilter.id, recentFilter.name)}
                        onLongPress={() => {
                          triggerHaptic();
                          setPeekFilter({name: recentFilter.name, thumbnailUrl: recentFilter.thumbnailUrl});
                        }}
                        delayLongPress={300}
                        disabled={isApplyingFilter}
                        activeOpacity={0.8}>
                        <View style={[styles.filterGridPreview, {backgroundColor: colors.backgroundSecondary}]}>
                          {isLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} />
                          ) : getFullThumbnailUrl(recentFilter.thumbnailUrl) ? (
                            <FilterImageWithLoader
                              uri={getFullThumbnailUrl(recentFilter.thumbnailUrl)!}
                              style={styles.filterGridThumbnail}
                            />
                          ) : (
                            <Ionicons name="sparkles" size={32} color={colors.primary} />
                          )}
                          <PriceBadge estimatedCoins={recentFilter.estimatedCoins} isFree={recentFilter.isFree} variant="modal" />
                          {isSelected && !isLoading && (
                            <View style={[styles.filterGridBadge, {backgroundColor: colors.primary}]}>
                              <Ionicons name="checkmark" size={14} color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[styles.filterGridName, {color: isSelected ? colors.primary : colors.textPrimary}]}
                          numberOfLines={1}>
                          {recentFilter.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyFiltersModal}>
                    <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.emptyFiltersModalText, {color: colors.textTertiary}]}>
                      No recent filters yet
                    </Text>
                  </View>
                )
              ) : (currentFilters || []).length === 0 ? (
                <View style={styles.emptyFiltersModal}>
                  <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyFiltersModalText, {color: colors.textTertiary}]}>
                    No filters in this category
                  </Text>
                </View>
              ) : (
                // API filters for selected category
                (currentFilters || []).map(filter => {
                  const isSelected = selectedApiFilter === filter.id;
                  const isLoading = isApplyingFilter && isSelected;
                  return (
                    <TouchableOpacity
                      key={filter.id}
                      style={[
                        styles.filterGridTile,
                        {backgroundColor: colors.backgroundTertiary},
                        isSelected && {borderColor: colors.primary, borderWidth: 2},
                        isApplyingFilter && !isSelected && {opacity: 0.5},
                      ]}
                      onPress={() => handleApplyApiFilter(filter.id)}
                      onLongPress={() => {
                        triggerHaptic();
                        setPeekFilter({name: filter.name, thumbnailUrl: filter.thumbnailUrl});
                      }}
                      delayLongPress={300}
                      disabled={isApplyingFilter}
                      activeOpacity={0.8}>
                      <View style={[styles.filterGridPreview, {backgroundColor: colors.backgroundSecondary}]}>
                        {isLoading ? (
                          <ActivityIndicator size="large" color={colors.primary} />
                        ) : (
                          <>
                            {getFullThumbnailUrl(filter.thumbnailUrl) ? (
                              <Image
                                source={{uri: getFullThumbnailUrl(filter.thumbnailUrl)!}}
                                style={styles.filterGridThumbnail}
                                resizeMode="cover"
                              />
                            ) : (
                              <Ionicons name="sparkles" size={32} color={colors.primary} />
                            )}
                            <PriceBadge estimatedCoins={filter.estimatedCoins} isFree={filter.isFree} variant="modal" />
                            {isSelected && (
                              <View style={[styles.filterGridBadge, {backgroundColor: colors.primary}]}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
                              </View>
                            )}
                          </>
                        )}
                      </View>
                      <Text
                        style={[styles.filterGridName, {color: isSelected ? colors.primary : colors.textPrimary}]}
                        numberOfLines={2}>
                        {filter.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Category Tabs at bottom (hidden when searching) */}
          {!isSearching && (
            <View style={[styles.modalCategorySection, styles.modalCategorySectionBottom, {backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border}]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalCategoryTabs}>
                {categories.map(category => {
                  const isSelected = selectedFilterCategory === category.id;
                  const count = getFilterCount(category.id);
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.modalCategoryTab,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.backgroundTertiary,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedFilterCategory(category.id)}
                      activeOpacity={0.7}>
                      <Text
                        style={[styles.modalCategoryText, {color: isSelected ? '#fff' : colors.textSecondary}]}
                        numberOfLines={1}>
                        {category.name}
                      </Text>
                      <View style={[
                        styles.modalCategoryBadge,
                        {backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : colors.primary + '20'},
                      ]}>
                        <Text style={[styles.modalCategoryBadgeText, {color: isSelected ? '#fff' : colors.primary}]}>
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {isLoadingFilters && (
                  <View style={styles.modalCategoryLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* Peek Preview Overlay */}
          {peekFilter && (
            <View
              style={styles.peekOverlay}
              onTouchEnd={() => setPeekFilter(null)}
              onTouchCancel={() => setPeekFilter(null)}>
              <View style={[styles.peekContainer, {backgroundColor: colors.cardBackground}]}>
                {getFullThumbnailUrl(peekFilter.thumbnailUrl) ? (
                  <Image
                    source={{uri: getFullThumbnailUrl(peekFilter.thumbnailUrl)!}}
                    style={styles.peekImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name="sparkles" size={80} color={colors.primary} style={{marginBottom: 16}} />
                )}
                <Text style={[styles.peekLabel, {color: colors.textPrimary}]}>
                  {peekFilter.name}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // Render frames panel (API frame/border filters with thumbnails)
  const renderFramesPanel = () => {
    const frameApiFilters = getFrameFilters();

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.panelContent}>
        {/* None option to clear frame */}
        <TouchableOpacity
          style={[
            styles.frameItem,
            {backgroundColor: colors.backgroundTertiary},
            !selectedApiFilter && selectedFrame === 'none' && {
              borderColor: colors.primary,
              borderWidth: 2,
            },
          ]}
          onPress={() => {
            setSelectedFrame('none');
            setSelectedApiFilter(null);
            setFilteredImageUrl(null);
          }}
          activeOpacity={0.7}>
          <View style={styles.framePreview}>
            <Ionicons name="close" size={24} color={!selectedApiFilter && selectedFrame === 'none' ? colors.primary : colors.textSecondary} />
          </View>
          <Text
            style={[
              styles.frameName,
              {color: !selectedApiFilter && selectedFrame === 'none' ? colors.primary : colors.textSecondary},
            ]}>
            None
          </Text>
        </TouchableOpacity>

        {/* API Frame/Border Filters with thumbnails */}
        {frameApiFilters.map(filter => {
          const isSelected = selectedApiFilter === filter.id;
          const isLoading = isApplyingFilter && isSelected;
          const thumbnailUrl = getFullThumbnailUrl(filter.thumbnailUrl);
          return (
            <TouchableOpacity
              key={`api-frame-${filter.id}`}
              style={[
                styles.frameItem,
                {backgroundColor: colors.backgroundTertiary},
                isSelected && {
                  borderColor: colors.primary,
                  borderWidth: 2,
                },
                isApplyingFilter && !isSelected && {opacity: 0.5},
              ]}
              onPress={() => handleApplyApiFilter(filter.id)}
              onLongPress={() => {
                triggerHaptic();
                setPeekFilter({name: filter.name, thumbnailUrl: filter.thumbnailUrl});
              }}
              delayLongPress={300}
              disabled={isApplyingFilter}
              activeOpacity={0.7}>
              <View style={styles.framePreview}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : thumbnailUrl ? (
                  <Image
                    source={{uri: thumbnailUrl}}
                    style={styles.frameThumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="image-outline" size={24} color={isSelected ? colors.primary : colors.textSecondary} />
                )}
                <PriceBadge estimatedCoins={filter.estimatedCoins} isFree={filter.isFree} variant="modal" />
              </View>
              <Text
                style={[
                  styles.frameName,
                  {color: isSelected ? colors.primary : colors.textSecondary},
                ]}
                numberOfLines={1}>
                {filter.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // Get current font family
  const getCurrentFontFamily = () => {
    const font = FONTS.find(f => f.id === textFontFamily);
    return font?.family || (Platform.OS === 'ios' ? 'System' : 'sans-serif');
  };

  // Start inline text editing directly on the image
  const openTextEditor = () => {
    setIsEditingText(true);
    setTextSelected(true);
    // Center: wrapper is at 50%/50%, shift back by half the box size
    pan.flattenOffset();
    pan.setValue({x: -textBoxWidth / 2, y: -(textFontSize + 24) / 2});
    setTimeout(() => inlineTextInputRef.current?.focus(), 150);
  };

  // Render text panel
  const renderTextPanel = () => (
    <View style={styles.textPanel}>
      {/* Action row: Add/Edit text button + alignment + palette */}
      <View style={styles.textPanelRow}>
        <TouchableOpacity
          style={[styles.addTextButton, {backgroundColor: colors.backgroundTertiary, flex: 1}]}
          onPress={openTextEditor}
          activeOpacity={0.7}>
          <Ionicons name={overlayText ? 'create' : 'add'} size={20} color={colors.primary} />
          <Text style={[styles.addTextButtonLabel, {color: overlayText ? colors.textPrimary : colors.textTertiary}]} numberOfLines={1}>
            {overlayText || 'Tap to add text...'}
          </Text>
        </TouchableOpacity>
        {/* Alignment toggle */}
        <TouchableOpacity
          style={[styles.textAlignButton, {backgroundColor: colors.backgroundTertiary}]}
          onPress={() => {
            const modes: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
            const idx = modes.indexOf(textAlign);
            setTextAlign(modes[(idx + 1) % 3]);
          }}
          activeOpacity={0.7}>
          <Ionicons
            name={textAlign === 'left' ? 'reorder-two' : textAlign === 'right' ? 'reorder-two' : 'reorder-three'}
            size={20}
            color={colors.textPrimary}
          />
          <Text style={[styles.alignLabel, {color: colors.textTertiary}]}>
            {textAlign === 'left' ? 'L' : textAlign === 'right' ? 'R' : 'C'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.textStyleButton, {backgroundColor: colors.primary}]}
          onPress={() => setTextSidebarVisible(true)}
          activeOpacity={0.7}>
          <Ionicons name="color-palette" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* Style presets strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsStrip}>
        {TEXT_PRESETS.map(preset => (
          <TouchableOpacity
            key={preset.id}
            style={[
              styles.presetChip,
              {backgroundColor: colors.backgroundTertiary},
              activePreset === preset.id && {borderColor: colors.primary, borderWidth: 2},
            ]}
            onPress={() => applyTextPreset(preset.id)}
            activeOpacity={0.7}>
            <Text style={[styles.presetChipPreview, preset.previewStyle]}>{preset.preview}</Text>
            <Text style={[styles.presetChipName, {color: colors.textSecondary}]}>{preset.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={[styles.textHint, {color: colors.textTertiary}]}>
        Tap to type on image. Drag text to move.
      </Text>
    </View>
  );

  // Render text sidebar modal
  const renderTextSidebar = () => (
    <Modal
      visible={textSidebarVisible}
      animationType="none"
      transparent={true}
      onRequestClose={() => setTextSidebarVisible(false)}>
      <View style={styles.sidebarOverlay}>
        <TouchableOpacity
          style={styles.sidebarBackdrop}
          activeOpacity={1}
          onPress={() => setTextSidebarVisible(false)}
        />
        <Animated.View
          {...sidebarPanResponder.panHandlers}
          style={[
            styles.sidebarContainer,
            {
              backgroundColor: colors.backgroundSecondary,
              transform: [{translateX: sidebarPan}],
            },
          ]}>
          {/* Swipe indicator */}
          <View style={styles.swipeIndicator}>
            <View style={[styles.swipeBar, {backgroundColor: colors.textTertiary}]} />
          </View>

          {/* Header */}
          <View style={styles.sidebarHeader}>
            <Text style={[styles.sidebarTitle, {color: colors.textPrimary}]}>Text Style</Text>
            <TouchableOpacity onPress={() => setTextSidebarVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 40}}>
            {/* Quick Presets */}
            <View style={styles.sidebarSection}>
              <Text style={[styles.sidebarSectionTitle, {color: colors.textSecondary}]}>Quick Styles</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{flexDirection: 'row', gap: 10}}>
                  {TEXT_PRESETS.map(preset => (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.presetChip,
                        {backgroundColor: colors.backgroundTertiary},
                        activePreset === preset.id && {borderColor: colors.primary, borderWidth: 2},
                      ]}
                      onPress={() => applyTextPreset(preset.id)}
                      activeOpacity={0.7}>
                      <Text style={[styles.presetChipPreview, preset.previewStyle]}>{preset.preview}</Text>
                      <Text style={[styles.presetChipName, {color: colors.textSecondary}]}>{preset.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Font Style: Bold, Italic, Underline */}
            <View style={styles.sidebarSection}>
              <Text style={[styles.sidebarSectionTitle, {color: colors.textSecondary}]}>Style</Text>
              <View style={styles.styleButtons}>
                <TouchableOpacity
                  style={[
                    styles.styleButton,
                    {backgroundColor: colors.backgroundTertiary},
                    textBold && {backgroundColor: colors.primary},
                  ]}
                  onPress={() => setTextBold(!textBold)}>
                  <Text style={[styles.styleButtonText, {fontWeight: 'bold', color: textBold ? '#fff' : colors.textPrimary}]}>B</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.styleButton,
                    {backgroundColor: colors.backgroundTertiary},
                    textItalic && {backgroundColor: colors.primary},
                  ]}
                  onPress={() => setTextItalic(!textItalic)}>
                  <Text style={[styles.styleButtonText, {fontStyle: 'italic', color: textItalic ? '#fff' : colors.textPrimary}]}>I</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.styleButton,
                    {backgroundColor: colors.backgroundTertiary},
                    textUnderline && {backgroundColor: colors.primary},
                  ]}
                  onPress={() => setTextUnderline(!textUnderline)}>
                  <Text style={[styles.styleButtonText, {textDecorationLine: 'underline', color: textUnderline ? '#fff' : colors.textPrimary}]}>U</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.styleButton,
                    {backgroundColor: colors.backgroundTertiary},
                    textShadow && {backgroundColor: colors.primary},
                  ]}
                  onPress={() => setTextShadow(!textShadow)}>
                  <Ionicons name="sunny" size={18} color={textShadow ? '#fff' : colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Alignment */}
            <View style={styles.sidebarSection}>
              <Text style={[styles.sidebarSectionTitle, {color: colors.textSecondary}]}>Alignment</Text>
              <View style={styles.styleButtons}>
                {(['left', 'center', 'right'] as const).map(align => (
                  <TouchableOpacity
                    key={align}
                    style={[
                      styles.styleButton,
                      {backgroundColor: colors.backgroundTertiary},
                      textAlign === align && {backgroundColor: colors.primary},
                    ]}
                    onPress={() => setTextAlign(align)}>
                    <Ionicons
                      name={align === 'left' ? 'reorder-two' : align === 'right' ? 'reorder-two' : 'reorder-three'}
                      size={18}
                      color={textAlign === align ? '#fff' : colors.textPrimary}
                      style={align === 'right' ? {transform: [{scaleX: -1}]} : undefined}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Font Family */}
            <View style={styles.sidebarSection}>
              <Text style={[styles.sidebarSectionTitle, {color: colors.textSecondary}]}>Font</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.fontOptions}>
                  {FONTS.map(font => (
                    <TouchableOpacity
                      key={font.id}
                      style={[
                        styles.fontOption,
                        {backgroundColor: colors.backgroundTertiary},
                        textFontFamily === font.id && {borderColor: colors.primary, borderWidth: 2},
                      ]}
                      onPress={() => setTextFontFamily(font.id)}>
                      <Text style={[styles.fontOptionText, {fontFamily: font.family, color: colors.textPrimary}]}>
                        Aa
                      </Text>
                      <Text style={[styles.fontOptionName, {color: colors.textSecondary}]}>{font.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Font Size */}
            <View style={styles.sidebarSection}>
              {renderSlider('Size', textFontSize, setTextFontSize, 'text', 12, 72, {
                formatValue: (v) => `${Math.round(v)}px`,
                step: 2,
                snap: true,
              })}
            </View>

            {/* Text Box Width */}
            <View style={styles.sidebarSection}>
              {renderSlider('Box Width', textBoxWidth, setTextBoxWidth, 'resize', 80, 300, {
                formatValue: (v) => `${Math.round(v)}px`,
                step: 10,
                snap: true,
              })}
              <Text style={[styles.textHint, {color: colors.textTertiary, marginTop: 6}]}>
                Or drag the resize handle on image
              </Text>
            </View>

            {/* Rotation */}
            <View style={styles.sidebarSection}>
              {renderSlider('Rotation', textRotation, setTextRotation, 'sync', -180, 180, {
                formatValue: (v) => `${Math.round(v)}°`,
                step: 5,
                snap: true,
              })}
            </View>

            {/* Curve */}
            <View style={styles.sidebarSection}>
              {renderSlider('Curve', textCurve, setTextCurve, 'analytics', -100, 100, {
                formatValue: (v) => `${Math.round(v)}%`,
                step: 5,
                snap: true,
              })}
            </View>

            {/* Text Color */}
            <View style={styles.sidebarSection}>
              <Text style={[styles.sidebarSectionTitle, {color: colors.textSecondary}]}>Text Color</Text>
              <View style={styles.colorGrid}>
                {TEXT_COLORS.map((color, index) => (
                  <TouchableOpacity
                    key={`text-${color}-${index}`}
                    style={[
                      styles.colorOption,
                      {backgroundColor: color},
                      textColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setTextColor(color)}>
                    {textColor === color && (
                      <Ionicons name="checkmark" size={14} color={color === '#ffffff' || color === '#f5f5f5' || color === '#e0e0e0' || color === '#ffeb3b' || color === '#cddc39' || color === '#ffff00' ? '#000' : '#fff'} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Background */}
            <View style={styles.sidebarSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sidebarSectionTitle, {color: colors.textSecondary}]}>Background</Text>
                <TouchableOpacity
                  style={[styles.miniToggle, textBackgroundEnabled && {backgroundColor: colors.primary}]}
                  onPress={() => setTextBackgroundEnabled(!textBackgroundEnabled)}>
                  <Ionicons name={textBackgroundEnabled ? 'checkmark' : 'close'} size={12} color="#fff" />
                </TouchableOpacity>
              </View>
              {textBackgroundEnabled && (
                <View style={styles.colorGrid}>
                  {BG_COLORS.map((color, index) => (
                    <TouchableOpacity
                      key={`bg-${color}-${index}`}
                      style={[
                        styles.colorOption,
                        {backgroundColor: color === 'transparent' ? colors.backgroundTertiary : color},
                        color === 'transparent' && {borderWidth: 1, borderColor: colors.textTertiary, borderStyle: 'dashed'},
                        textBackgroundColor === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => setTextBackgroundColor(color)}>
                      {color === 'transparent' && <Ionicons name="close" size={14} color={colors.textTertiary} />}
                      {textBackgroundColor === color && color !== 'transparent' && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Preview */}
            <View style={styles.sidebarSection}>
              <Text style={[styles.sidebarSectionTitle, {color: colors.textSecondary}]}>Preview</Text>
              <View style={[styles.textPreview, {backgroundColor: '#333'}]}>
                <View
                  style={[
                    styles.textPreviewInner,
                    {
                      backgroundColor: textBackgroundEnabled ? textBackgroundColor : 'transparent',
                      transform: [{rotate: `${textRotation}deg`}],
                    },
                  ]}>
                  <Text
                    style={[
                      styles.textPreviewText,
                      {
                        color: textColor,
                        fontSize: Math.min(textFontSize, 28),
                        fontFamily: getCurrentFontFamily(),
                        fontWeight: textBold ? 'bold' : 'normal',
                        fontStyle: textItalic ? 'italic' : 'normal',
                        textDecorationLine: textUnderline ? 'underline' : 'none',
                        textShadowColor: textShadow ? 'rgba(0,0,0,0.8)' : 'transparent',
                        textShadowOffset: {width: 1, height: 1},
                        textShadowRadius: textShadow ? 3 : 0,
                        textAlign: textAlign,
                      },
                    ]}>
                    {overlayText || 'Sample Text'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );

  // Track page positions for adjust sliders (pageX-based for stable dragging)
  const sliderTrackRefs = useRef<Record<string, {pageX: number; width: number}>>({}).current;
  const sliderTrackViewRefs = useRef<Record<string, View | null>>({}).current;
  const sliderRepeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSliderRepeat = (action: () => void) => {
    action(); // fire once immediately
    // Start repeating after a short initial delay
    const timeout = setTimeout(() => {
      sliderRepeatTimer.current = setInterval(action, 80);
    }, 300);
    sliderRepeatTimer.current = timeout as any;
  };

  const stopSliderRepeat = () => {
    if (sliderRepeatTimer.current) {
      clearTimeout(sliderRepeatTimer.current as any);
      clearInterval(sliderRepeatTimer.current);
      sliderRepeatTimer.current = null;
    }
  };

  // Render adjustment slider with draggable track
  const renderSlider = (
    label: string,
    value: number,
    setValue: (v: number) => void,
    icon: string,
    min: number,
    max: number,
    options?: {formatValue?: (v: number) => string; step?: number; snap?: boolean},
  ) => {
    const percentage = ((value - min) / (max - min)) * 100;
    const step = options?.step ?? 0.02;
    const formatValue = options?.formatValue ?? ((v: number) => `${Math.round(v * 100)}%`);

    const measureTrack = () => {
      sliderTrackViewRefs[label]?.measure?.((_x, _y, w, _h, pageX) => {
        sliderTrackRefs[label] = {pageX, width: w};
      });
    };

    const handleTrackTouch = (pageX: number) => {
      const layout = sliderTrackRefs[label];
      if (!layout || layout.width <= 0) return;
      const relativeX = pageX - layout.pageX;
      const ratio = Math.max(0, Math.min(relativeX / layout.width, 1));
      let newValue = min + ratio * (max - min);
      if (options?.snap) {
        newValue = Math.round(newValue / step) * step;
      }
      setValue(newValue);
    };

    return (
      <View style={styles.adjustRow}>
        <View style={styles.adjustLabelRow}>
          <Ionicons name={icon as any} size={18} color={colors.textSecondary} />
          <Text style={[styles.adjustLabel, {color: colors.textSecondary}]}>
            {label}
          </Text>
          <Text style={[styles.adjustValue, {color: colors.primary}]}>
            {formatValue(value)}
          </Text>
        </View>
        <View style={styles.sliderContainer}>
          <TouchableOpacity
            style={[styles.sliderButton, {backgroundColor: colors.backgroundTertiary}]}
            onPressIn={() => startSliderRepeat(() => setValue(Math.max(min, +(value - step).toFixed(3))))}
            onPressOut={stopSliderRepeat}
            activeOpacity={0.6}>
            <Text style={[styles.sliderButtonText, {color: colors.textPrimary}]}>−</Text>
          </TouchableOpacity>
          <View
            ref={(ref) => { sliderTrackViewRefs[label] = ref; }}
            style={[styles.sliderTrack, {backgroundColor: colors.backgroundTertiary}]}
            onLayout={() => setTimeout(measureTrack, 50)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(e) => {
              measureTrack();
              handleTrackTouch(e.nativeEvent.pageX);
            }}
            onResponderMove={(e) => handleTrackTouch(e.nativeEvent.pageX)}>
            <View
              style={[
                styles.sliderFill,
                {backgroundColor: colors.primary, width: `${percentage}%`},
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.sliderThumb,
                {
                  backgroundColor: colors.primary,
                  left: `${percentage}%`,
                },
              ]}
              pointerEvents="none"
            />
          </View>
          <TouchableOpacity
            style={[styles.sliderButton, {backgroundColor: colors.backgroundTertiary}]}
            onPressIn={() => startSliderRepeat(() => setValue(Math.min(max, +(value + step).toFixed(3))))}
            onPressOut={stopSliderRepeat}
            activeOpacity={0.6}>
            <Text style={[styles.sliderButtonText, {color: colors.textPrimary}]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render adjustment panel
  // Caption handlers
  const handleGenerateCaption = async () => {
    if (!(await requireConsent())) return;
    if (!selectedImage) return;

    // Fresh balance check from server
    const requiredCoins = captionPrice?.estimatedCoins ?? 0;
    if (requiredCoins > 0 && accessToken) {
      const balanceResult = await dispatch(fetchCoinBalance(accessToken));
      const freshBalance = balanceResult.payload as number | undefined;
      if (freshBalance === undefined || freshBalance < requiredCoins) {
        setCaptionError(`Insufficient balance: you need ${requiredCoins} ★ but have ${freshBalance ?? 0} ★.`);
        return;
      }
    }

    setIsGeneratingCaption(true);
    setCaptionError('');
    setGeneratedCaption('');
    setCaptionCopied(false);
    try {
      const result = await generateCaption({
        image: {uri: selectedImage},
        captionType,
        accessToken: accessToken || undefined,
      });
      if (result.success && result.caption) {
        setGeneratedCaption(result.caption);
        // Refresh coin balance after successful generation
        if (accessToken) {
          dispatch(fetchCoinBalance(accessToken));
        }
      } else {
        setCaptionError(result.error || 'Failed to generate caption');
      }
    } catch {
      setCaptionError('An unexpected error occurred');
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleCopyCaption = () => {
    if (!generatedCaption) return;
    Clipboard.setString(generatedCaption);
    setCaptionCopied(true);
    setTimeout(() => setCaptionCopied(false), 2000);
  };

  const renderCaptionPanel = () => (
    <ScrollView style={styles.captionPanel} showsVerticalScrollIndicator={false}>
      {/* Caption Style */}
      <Text style={[styles.captionSectionLabel, {color: colors.textPrimary}]}>
        Caption Style
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.captionStylesContainer}>
        {CAPTION_STYLES.map(style => (
          <TouchableOpacity
            key={style.id}
            style={[
              styles.captionStyleChip,
              {backgroundColor: colors.backgroundTertiary},
              captionType === style.id && {backgroundColor: colors.primary},
            ]}
            onPress={() => setCaptionType(style.id)}
            activeOpacity={0.7}>
            <Ionicons
              name={style.icon as any}
              size={16}
              color={captionType === style.id ? '#fff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.captionStyleChipText,
                {color: captionType === style.id ? '#fff' : colors.textSecondary},
              ]}>
              {style.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Generate Button */}
      <TouchableOpacity
        style={[
          styles.captionGenerateButton,
          {backgroundColor: colors.primary},
          (!selectedImage || isGeneratingCaption) && {opacity: 0.5},
        ]}
        onPress={handleGenerateCaption}
        disabled={!selectedImage || isGeneratingCaption}
        activeOpacity={0.8}>
        {isGeneratingCaption ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="sparkles" size={20} color="#fff" />
        )}
        <Text style={styles.captionGenerateButtonText}>
          {isGeneratingCaption ? 'Generating...' : (
            <>
              {'Generate Caption'}
              {captionPrice && !captionPrice.isFree && captionPrice.estimatedCoins > 0 ? (
                <Text style={{color: '#FFD700'}}>{` (${captionPrice.estimatedCoins} ★)`}</Text>
              ) : (
                <Text style={{color: '#22C55E'}}>{' (Free)'}</Text>
              )}
            </>
          )}
        </Text>
      </TouchableOpacity>

      {/* Error card */}
      {captionError ? (
        <View style={[styles.captionErrorCard, {backgroundColor: colors.error + '15'}]}>
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={[styles.captionErrorText, {color: colors.error}]}>
            {captionError}
          </Text>
        </View>
      ) : null}

      {/* Result card */}
      {generatedCaption ? (
        <View style={[styles.captionResultCard, {backgroundColor: colors.backgroundTertiary}]}>
          <Text style={[styles.captionResultText, {color: colors.textPrimary}]}>
            {generatedCaption}
          </Text>
          <TouchableOpacity
            style={[styles.captionCopyButton, {backgroundColor: colors.primary}]}
            onPress={handleCopyCaption}
            activeOpacity={0.8}>
            <Ionicons
              name={captionCopied ? 'checkmark' : 'copy-outline'}
              size={16}
              color="#fff"
            />
            <Text style={styles.captionCopyButtonText}>
              {captionCopied ? 'Copied!' : 'Copy'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );

  const renderAdjustPanel = () => (
    <View style={styles.adjustPanel}>
      <View style={styles.adjustHeaderRow}>
        <Text style={[styles.adjustHeaderLabel, {color: colors.textPrimary}]}>Adjust</Text>
        <TouchableOpacity
          style={[styles.resetButton, {backgroundColor: colors.backgroundTertiary}]}
          onPress={() => {
            setBrightness(1);
            setContrast(1);
            setSaturation(1);
          }}
          activeOpacity={0.7}>
          <Ionicons name="refresh" size={14} color={colors.textSecondary} />
          <Text style={[styles.resetButtonText, {color: colors.textSecondary}]}>Reset</Text>
        </TouchableOpacity>
      </View>
      {renderSlider('Brightness', brightness, setBrightness, 'sunny', 0.5, 1.5)}
      {renderSlider('Contrast', contrast, setContrast, 'contrast', 0.5, 1.5)}
      {renderSlider('Saturation', saturation, setSaturation, 'color-palette', 0, 2)}
    </View>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: headerPadding,
          },
        ]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={openDrawer}
            activeOpacity={0.7}>
            <Ionicons name="menu" size={themeIconSize} color={colors.textPrimary} />
          </TouchableOpacity>
          <Logo size={isTablet ? 140 : 100} />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: colors.backgroundTertiary,
                width: themeToggleSize,
                height: themeToggleSize,
                borderRadius: themeToggleSize / 2,
              },
            ]}
            onPress={() => (navigation as any).navigate('Notifications')}
            activeOpacity={0.7}>
            <Ionicons name="notifications" size={themeIconSize} color={colors.textPrimary} />
            {notificationUnreadCount > 0 && (
              <View style={styles.bellDot} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: colors.backgroundTertiary,
                width: themeToggleSize,
                height: themeToggleSize,
                borderRadius: themeToggleSize / 2,
              },
            ]}
            onPress={() => (navigation as any).navigate('MyCreations')}
            activeOpacity={0.7}>
            <Ionicons name="images" size={themeIconSize} color={colors.textPrimary} />
            {totalUnreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Preview Area */}
      <View style={styles.previewContainer}>
        {selectedImage ? (
          <View style={styles.photoSlotWrapper}>
            {/* Image container - contains ViewShot and overlays with exact dimensions */}
            <View style={[styles.imageOverlayContainer, {width: imageSize, height: imageSize}]}>
              {/* Normal/After Image View - Always rendered */}
              <ViewShot
                    ref={viewShotRef}
                    options={{format: 'png', quality: 1}}
                    style={[styles.viewShot, {width: imageSize, height: imageSize}]}>
                    <View
                      style={styles.skiaFrameContainer}
                      onStartShouldSetResponder={() => true}
                      onResponderRelease={() => {
                        if (isEditingText) {
                          inlineTextInputRef.current?.blur();
                          setIsEditingText(false);
                        } else if (editMode === 'text' && overlayText.length === 0) {
                          openTextEditor();
                        } else if (textSelected) {
                          setTextSelected(false);
                        }
                      }}>
                    {/* Always render through Skia so ColorMatrix adjustments work */}
                    {renderFilteredImage() || (
                      /* Fallback: Show regular image while Skia loads */
                      <Image
                        source={{uri: filteredImageUrl || selectedImage}}
                        style={{width: imageSize, height: imageSize, borderRadius: 8}}
                        resizeMode="cover"
                      />
                    )}
                    {isApplyingFilter && (
                      <View style={styles.filterLoadingOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.filterLoadingText}>Applying filter...</Text>
                      </View>
                    )}
              {/* Draggable text overlay - visible when there's text OR when editing inline */}
              {(overlayText.length > 0 || isEditingText) && selectedFrame !== 'polaroid' && selectedFrame !== 'instant' && (
                <Animated.View
                  ref={textWrapperRef}
                  style={[
                    styles.draggableTextWrapper,
                    {
                      transform: [
                        {translateX: pan.x},
                        {translateY: pan.y},
                        {rotate: `${textRotation}deg`},
                      ],
                    },
                  ]}>
                  <View
                    {...(!isEditingText ? panResponder.panHandlers : {})}
                    style={[
                      styles.draggableTextOverlay,
                      {
                        width: textBoxWidth,
                        backgroundColor: textBackgroundEnabled ? textBackgroundColor : 'transparent',
                        borderWidth: textSelected && !isEditingText && editMode === 'text' ? 1 : 0,
                        borderColor: 'rgba(255,255,255,0.5)',
                        borderStyle: 'dashed',
                      },
                    ]}>
                    {isEditingText ? (
                      // Inline TextInput directly on the image
                      <TextInput
                        ref={inlineTextInputRef}
                        style={[
                          styles.draggableTextContent,
                          {
                            color: textColor,
                            fontSize: textFontSize,
                            fontFamily: getCurrentFontFamily(),
                            fontWeight: textBold ? 'bold' : 'normal',
                            fontStyle: textItalic ? 'italic' : 'normal',
                            textDecorationLine: textUnderline ? 'underline' : 'none',
                            textShadowColor: textShadow ? 'rgba(0,0,0,0.8)' : 'transparent',
                            textShadowOffset: {width: 1, height: 1},
                            textShadowRadius: textShadow ? 3 : 0,
                            textAlign: textAlign,
                            padding: 0,
                            minHeight: textFontSize + 8,
                          },
                        ]}
                        placeholder="Type here..."
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={overlayText}
                        onChangeText={setOverlayText}
                        maxLength={100}
                        multiline
                        autoFocus
                        onBlur={() => setIsEditingText(false)}
                      />
                    ) : textCurve !== 0 ? (
                      // Curved text rendering
                      <View style={styles.curvedTextContainer}>
                        {overlayText.split('').map((char, index) => {
                          const totalChars = overlayText.length;
                          const middleIndex = (totalChars - 1) / 2;
                          const offset = index - middleIndex;
                          const curveAmount = textCurve / 100;
                          const rotationAngle = offset * curveAmount * 8;
                          const yOffset = Math.abs(offset) * curveAmount * 4;
                          return (
                            <Text
                              key={`char-${index}`}
                              style={[
                                styles.curvedChar,
                                {
                                  color: textColor,
                                  fontSize: textFontSize,
                                  fontFamily: getCurrentFontFamily(),
                                  fontWeight: textBold ? 'bold' : 'normal',
                                  fontStyle: textItalic ? 'italic' : 'normal',
                                  textDecorationLine: textUnderline ? 'underline' : 'none',
                                  textShadowColor: textShadow ? 'rgba(0,0,0,0.8)' : 'transparent',
                                  textShadowOffset: {width: 1, height: 1},
                                  textShadowRadius: textShadow ? 3 : 0,
                                  transform: [
                                    {rotate: `${rotationAngle}deg`},
                                    {translateY: textCurve > 0 ? yOffset : -yOffset},
                                  ],
                                },
                              ]}>
                              {char === ' ' ? '\u00A0' : char}
                            </Text>
                          );
                        })}
                      </View>
                    ) : (
                      // Normal text rendering
                      <Text
                        style={[
                          styles.draggableTextContent,
                          {
                            color: textColor,
                            fontSize: textFontSize,
                            fontFamily: getCurrentFontFamily(),
                            fontWeight: textBold ? 'bold' : 'normal',
                            fontStyle: textItalic ? 'italic' : 'normal',
                            textDecorationLine: textUnderline ? 'underline' : 'none',
                            textShadowColor: textShadow ? 'rgba(0,0,0,0.8)' : 'transparent',
                            textShadowOffset: {width: 1, height: 1},
                            textShadowRadius: textShadow ? 3 : 0,
                            textAlign: textAlign,
                          },
                        ]}>
                        {overlayText}
                      </Text>
                    )}
                  </View>
                  {/* Delete button on text overlay - top right */}
                  {textSelected && editMode === 'text' && (
                    <TouchableOpacity
                      style={styles.textDeleteHandle}
                      onPress={clearOverlayText}
                      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {/* Rotation handle - bottom left */}
                  {textSelected && editMode === 'text' && (
                    <View
                      {...rotationPanResponder.panHandlers}
                      style={styles.rotationHandle}>
                      <Ionicons name="refresh" size={14} color="#fff" />
                    </View>
                  )}
                  {/* Resize handle - bottom right */}
                  {textSelected && editMode === 'text' && (
                    <View
                      {...resizePanResponder.panHandlers}
                      style={styles.resizeHandle}>
                      <Ionicons name="resize" size={14} color="#fff" />
                    </View>
                  )}
                </Animated.View>
              )}
              {/* Polaroid/Instant caption area - rendered as overlay since Skia handles the frame */}
              {(selectedFrame === 'polaroid' || selectedFrame === 'instant') && overlayText.length > 0 && (
                <View style={styles.polaroidCaptionOverlay}>
                  <Text
                    style={[
                      styles.polaroidText,
                      {
                        color: textColor === '#ffffff' ? '#333' : textColor,
                        fontSize: Math.min(textFontSize, 16),
                        fontFamily: getCurrentFontFamily(),
                      },
                    ]}>
                    {overlayText}
                  </Text>
                </View>
              )}
                  </View>
                </ViewShot>
              {/* Before image overlay - shown when holding compare button */}
              {showComparison && originalImageForFilter && (
                <View style={[styles.beforeImageOverlay, {width: imageSize, height: imageSize}]}>
                  <Image
                    source={{uri: originalImageForFilter}}
                    style={styles.comparisonImageFull}
                    resizeMode="contain"
                  />
                  <View style={styles.comparisonLabelSingle}>
                    <View style={[styles.comparisonLabelBadge, {backgroundColor: 'rgba(0,0,0,0.7)'}]}>
                      <Text style={styles.comparisonLabelText}>Before</Text>
                    </View>
                  </View>
                </View>
              )}
              {/* Loading overlay - shown when applying filter */}
              {isApplyingFilter && (
                <View style={[styles.loadingOverlay, {width: imageSize, height: imageSize}]}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingOverlayText}>Applying effect...</Text>
                </View>
              )}
            </View>
            {/* Compare button - press and hold to see before */}
            {(filteredImageUrl || selectedFilter !== 'original' || selectedFrame !== 'none') && (
              <TouchableOpacity
                style={[styles.compareBtn, {backgroundColor: showComparison ? colors.primary : 'rgba(0,0,0,0.6)'}]}
                onPressIn={() => setShowComparison(true)}
                onPressOut={() => setShowComparison(false)}
                activeOpacity={0.8}>
                <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            {/* Full-screen button - captures composed image with text overlay */}
            <TouchableOpacity
              style={[styles.fullScreenBtn, {backgroundColor: 'rgba(255,27,109,0.7)'}]}
              onPress={async () => {
                setTextSelected(false);
                await new Promise(r => setTimeout(r, 100));
                try {
                  const uri = await viewShotRef.current?.capture?.();
                  setFullScreenImage(uri || filteredImageUrl || selectedImage);
                } catch {
                  setFullScreenImage(filteredImageUrl || selectedImage);
                }
                setTextSelected(true);
              }}>
              <Ionicons name="expand" size={16} color="#fff" />
            </TouchableOpacity>
            {/* Remove button - positioned relative to photoSlotWrapper */}
            <TouchableOpacity
              style={[styles.removePhotoBtn, {backgroundColor: colors.error}]}
              onPress={handleClearImage}>
              <Text style={styles.removePhotoBtnText}>✕</Text>
            </TouchableOpacity>
            {/* Photo slot label badge - only show when no effect applied */}
            {!filteredImageUrl && selectedFilter === 'original' && selectedFrame === 'none' && (
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.photoSlotContainer}>
            <TouchableOpacity
              style={[styles.photoSlotEmpty, {backgroundColor: colors.cardBackground, borderColor: colors.primary}]}
              onPress={() => setShowPhotoPicker(true)}
              activeOpacity={0.8}>
              <Ionicons name="camera" size={48} color={colors.primary} />
              <Text style={[styles.photoSlotText, {color: colors.textSecondary}]}>
                Add Photo
              </Text>
              <View style={[styles.photoSlotLabelBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.photoSlotLabelText}>Your Photo</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Action Buttons - under preview */}
      {selectedImage && (
        <CopilotStep
          text="When you're done editing, tap Save to download to your gallery or Share to send to friends and social media."
          order={9}
          name="💾 Save & Share">
          <WalkthroughableView style={styles.actionButtonsUnderPreview}>
            <TouchableOpacity
              style={[styles.actionButtonSmall, {backgroundColor: colors.backgroundTertiary}]}
              onPress={pickImage}
              activeOpacity={0.8}>
              <Ionicons name="refresh" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonSmall, styles.mainActionButtonSmall, {backgroundColor: colors.success}]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}>
              <Ionicons name="download" size={20} color="#fff" />
              <Text style={styles.actionButtonTextSmall}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonSmall, styles.mainActionButtonSmall, {backgroundColor: colors.primary}]}
              onPress={handleShare}
              activeOpacity={0.8}>
              <Ionicons name="share" size={20} color="#fff" />
              <Text style={styles.actionButtonTextSmall}>Share</Text>
            </TouchableOpacity>
          </WalkthroughableView>
        </CopilotStep>
      )}

      {/* Edit Mode Tabs */}
      <CopilotStep
        text="Switch between editing modes: Filters for effects, Frames for borders, Text for overlays, and Adjust for brightness, contrast & saturation."
        order={7}
        name="🎛️ Edit Tools">
        <WalkthroughableView>
          {renderModeTabs()}
        </WalkthroughableView>
      </CopilotStep>

      {/* Edit Panel */}
      <CopilotStep
        text="Browse and select from various filters and frames to transform your photo. Tap any option to apply it instantly."
        order={8}
        name="🎨 Filters & Frames">
        <WalkthroughableView style={[styles.editPanel, {backgroundColor: colors.backgroundSecondary}]}>
          {editMode === 'filters' && renderFiltersPanel()}
          {editMode === 'frames' && renderFramesPanel()}
          {editMode === 'text' && renderTextPanel()}
          {editMode === 'adjust' && renderAdjustPanel()}
          {editMode === 'caption' && renderCaptionPanel()}
        </WalkthroughableView>
      </CopilotStep>

      {/* Text Styling Sidebar */}
      {renderTextSidebar()}

      {/* Filters Modal */}
      {renderFiltersModal()}

      {/* Peek Preview Modal for Frames */}
      <Modal
        transparent
        visible={!!peekFilter && !filtersModalVisible}
        animationType="fade"
        onRequestClose={() => setPeekFilter(null)}>
        <View
          style={styles.peekOverlay}
          onTouchEnd={() => setPeekFilter(null)}
          onTouchCancel={() => setPeekFilter(null)}>
          <View style={[styles.peekContainer, {backgroundColor: colors.cardBackground}]}>
            {peekFilter && getFullThumbnailUrl(peekFilter.thumbnailUrl) ? (
              <Image
                source={{uri: getFullThumbnailUrl(peekFilter.thumbnailUrl)!}}
                style={styles.peekImage}
                resizeMode="contain"
              />
            ) : (
              <Ionicons name="image-outline" size={80} color={colors.primary} style={{marginBottom: 16}} />
            )}
            <Text style={[styles.peekLabel, {color: colors.textPrimary}]}>
              {peekFilter?.name}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        visible={showPhotoPicker}
        onClose={() => {
          setShowPhotoPicker(false);
          setPendingFilter(null); // Clear pending filter if user cancels
          pendingFilterRef.current = null;
        }}
        onSelectPhoto={handlePhotoPickerSelect}
        title="Select Photo to Edit"
      />

      {/* Full Screen Image Modal */}
      <FullScreenImageModal
        visible={!!fullScreenImage}
        imageUri={fullScreenImage}
        beforeImageUri={originalImageForFilter}
        onClose={() => setFullScreenImage(null)}
      />

      {/* Text editor modal removed - editing happens inline on the image */}

      {/* Validation Modal */}
      <Modal
        transparent
        visible={showValidationModal}
        animationType="fade"
        onRequestClose={() => setShowValidationModal(false)}>
        <View style={styles.validationModalOverlay}>
          <View style={[styles.validationModal, {backgroundColor: colors.cardBackground}]}>
            <View style={[styles.validationIconContainer, {backgroundColor: colors.primary + '20'}]}>
              <Ionicons name="image-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.validationTitle, {color: colors.textPrimary}]}>
              No Image Selected
            </Text>
            <Text style={[styles.validationText, {color: colors.textSecondary}]}>
              {validationMessage}
            </Text>
            <TouchableOpacity
              style={[styles.validationButton, {backgroundColor: colors.primary}]}
              onPress={() => {
                setShowValidationModal(false);
                setShowPhotoPicker(true);
              }}
              activeOpacity={0.8}>
              <Text style={styles.validationButtonText}>Select Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Message Dialog */}
      <CustomDialog
        visible={messageDialog.visible}
        icon={messageDialog.icon}
        iconColor={messageDialog.iconColor}
        title={messageDialog.title}
        message={messageDialog.message}
        buttons={[{text: 'OK', onPress: hideMessage}]}
        onClose={hideMessage}
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
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  menuButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  headerRight: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
  },
  headerButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellDot: {
    position: 'absolute' as const,
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
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    overflow: 'hidden',
  },
  viewShot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameContainer: {
    borderRadius: 4,
  },
  skiaFrameContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  textOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  overlayTextContent: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  polaroidCaption: {
    alignItems: 'center',
    paddingTop: 8,
  },
  polaroidCaptionOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  polaroidText: {
    fontFamily: Platform.OS === 'ios' ? 'Marker Felt' : 'sans-serif',
    fontSize: 14,
    color: '#333',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    gap: 16,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pickButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editPanel: {
    paddingVertical: 12,
    minHeight: 160,
  },
  panelContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  filterItem: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    minWidth: 70,
  },
  filterPreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    marginBottom: 6,
  },
  filterIcon: {
    fontSize: 24,
  },
  filterName: {
    fontSize: 11,
    fontWeight: '500',
  },
  // API Filters styles - Improved UI
  filtersPanelContainer: {
    flex: 1,
  },
  categoryTabsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  categoryTabLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  loadingText: {
    fontSize: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 12,
    gap: 10,
    paddingBottom: 4,
  },
  // New larger filter tiles
  filterTile: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    width: 90,
  },
  filterTilePreview: {
    width: 70,
    height: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
    overflow: 'visible',
  },
  filterTileIcon: {
    fontSize: 32,
  },
  filterTileName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  filterSelectedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  emptyFiltersContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyFiltersText: {
    fontSize: 13,
    textAlign: 'center',
  },
  // Simple filters panel (button to open modal)
  filtersPanelSimple: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  openFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 18,
  },
  openFiltersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    flex: 1,
  },
  openFiltersIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openFiltersInfo: {
    flex: 1,
  },
  openFiltersLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  openFiltersValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  openFiltersRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  applyingFilterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  applyingFilterText: {
    fontSize: 13,
  },
  // Recent filters thumbnails in the bar
  recentFiltersThumbnails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 10,
    marginLeft: 12,
  },
  recentFiltersPlaceholder: {
    fontSize: 14,
    fontWeight: '500',
    alignSelf: 'center',
  },
  recentFilterThumbContainer: {
    alignItems: 'center',
    width: 60,
  },
  recentFilterThumb: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  recentFilterThumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  recentFilterThumbIcon: {
    fontSize: 26,
  },
  recentFilterThumbLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  // Current filter info below the bar
  currentFilterInfo: {
    alignItems: 'center',
    marginTop: 8,
  },
  currentFilterLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  currentFilterValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Filters Modal styles
  filtersModalContainer: {
    flex: 1,
  },
  filtersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  filtersModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  filtersModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCategorySection: {
    paddingVertical: 12,
  },
  modalCategorySectionBottom: {
    borderTopWidth: 1,
    paddingBottom: 50,
  },
  modalCategoryTabs: {
    paddingHorizontal: 16,
    gap: 8,
  },
  modalCategoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  modalCategoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  modalCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalCategoryLoading: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  filtersGridScroll: {
    flex: 1,
  },
  filtersGridContent: {
    padding: 16,
  },
  filtersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  filterGridTile: {
    width: '45%',
    aspectRatio: 0.9,
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
  },
  filterGridPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  filterGridThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  filterGridIcon: {
    fontSize: 44,
  },
  filterGridBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  filterGridName: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterGridCategory: {
    fontSize: 10,
    marginTop: 2,
  },
  // Search styles
  filterSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
  },
  filterSearchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  searchResultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchResultsText: {
    fontSize: 13,
  },
  emptyFiltersModal: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyFiltersModalText: {
    fontSize: 15,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 16,
    marginBottom: 8,
  },
  loadingFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadingFiltersText: {
    fontSize: 13,
  },
  apiFilteredImageContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiFilteredImage: {
    borderRadius: 8,
  },
  filterLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  filterLoadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  frameItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    minWidth: 90,
  },
  frameIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  framePreview: {
    width: 70,
    height: 70,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  frameThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  frameName: {
    fontSize: 12,
    fontWeight: '600',
  },
  textPanel: {
    paddingHorizontal: 16,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  clearTextButton: {
    padding: 4,
  },
  textHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  adjustPanel: {
    paddingHorizontal: 16,
    gap: 12,
  },
  adjustHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adjustHeaderLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Caption panel styles
  captionPanel: {
    paddingHorizontal: 16,
    maxHeight: 320,
  },
  captionSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  captionStylesContainer: {
    gap: 8,
    paddingBottom: 14,
  },
  captionStyleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  captionStyleChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  captionGenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 14,
  },
  captionGenerateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  captionErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
  },
  captionErrorText: {
    fontSize: 13,
    flex: 1,
  },
  captionResultCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
  },
  captionResultText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  captionCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  captionCopyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  adjustRow: {
    gap: 8,
  },
  adjustLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  adjustValue: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  sliderTrack: {
    flex: 1,
    height: 24,
    borderRadius: 12,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 9,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    top: 2,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainActionButton: {
    width: 'auto',
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 8,
    borderRadius: 25,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Text panel styles
  textPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textStyleButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textAlignButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alignLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: -2,
  },
  presetsStrip: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  presetChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 60,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetChipPreview: {
    fontSize: 16,
    marginBottom: 2,
  },
  presetChipName: {
    fontSize: 10,
    fontWeight: '600',
  },
  // Draggable text overlay
  draggableTextWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  draggableTextOverlay: {
    padding: 8,
    borderRadius: 4,
    minWidth: 80,
    overflow: 'visible',
  },
  draggableTextContent: {
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -12,
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  textDeleteHandle: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
    zIndex: 10,
  },
  rotationHandle: {
    position: 'absolute',
    bottom: -12,
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  curvedTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  curvedChar: {
    textAlign: 'center',
  },
  // Sidebar styles
  sidebarOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarContainer: {
    width: 280,
    height: '100%',
    paddingTop: 50,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {width: -4, height: 0},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sidebarSection: {
    marginBottom: 24,
  },
  sidebarSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  fontOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  fontOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    minWidth: 70,
  },
  fontOptionText: {
    fontSize: 22,
    marginBottom: 4,
  },
  fontOptionName: {
    fontSize: 10,
  },
  sizeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sizeFill: {
    height: '100%',
    borderRadius: 4,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  shadowToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  shadowToggleText: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    justifyContent: 'center',
    padding: 2,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  textPreview: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  textPreviewText: {
    textAlign: 'center',
  },
  textPreviewInner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  swipeBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  styleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  styleButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  styleButtonText: {
    fontSize: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  miniToggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetSmallButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  resetSmallText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Photo Slot styles
  photoSlotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  photoSlotWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  imageOverlayContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoSlotEmpty: {
    width: 240,
    height: 280,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoSlotFilled: {
    borderRadius: 16,
    borderWidth: 2,
    position: 'relative',
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  photoSlotText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  photoSlotLabelBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 200,
    elevation: 200,
  },
  photoSlotLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  compareBtn: {
    position: 'absolute',
    bottom: 10,
    right: 50,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    elevation: 200,
  },
  closeComparisonBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
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
  // Before/After Comparison styles
  comparisonContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
  },
  beforeImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 150,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlayText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  validationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  validationModal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  validationIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  validationTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  validationText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  validationButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  validationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  comparisonImageFull: {
    width: '100%',
    height: '100%',
  },
  afterImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    overflow: 'hidden',
  },
  comparisonSliderLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#fff',
    marginLeft: -2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comparisonSliderHandle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  comparisonSliderIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  comparisonLabels: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  comparisonLabelSingle: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  comparisonLabelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  comparisonLabelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  compareButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Action buttons under preview
  actionButtonsUnderPreview: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    marginTop: 0,
    gap: 12,
  },
  actionButtonSmall: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainActionButtonSmall: {
    width: 'auto',
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 6,
    borderRadius: 21,
  },
  actionButtonTextSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Peek preview styles
  peekOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
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
  // Instagram Stories text editor overlay
  textEditorOverlay: {
    flex: 1,
  },
  textEditorTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  textEditorCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  textEditorPreview: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 200,
    maxWidth: '90%',
  },
  textEditorInput: {
    minHeight: 40,
    maxHeight: 200,
    padding: 0,
  },
  textEditorAlignRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  textEditorAlignBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textEditorBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 34,
  },
  textEditorDone: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  textEditorDoneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  addTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  addTextButtonLabel: {
    fontSize: 16,
    flex: 1,
  },
});

export default EditScreen;
