import React, {useState, useRef, useEffect, useMemo, useCallback, useImperativeHandle, forwardRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../theme/ThemeContext';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {addAccessory, removeAccessory, SelectedAccessory} from '../store/slices/transformSlice';
import {useAccessories} from '../hooks/useAccessories';
import {AccessoryItem, AccessoryType} from '../services/accessoriesApi';
import {config} from '../utils/config';
import PriceBadge from './PriceBadge';
import {triggerHaptic} from '../utils/haptics';

// Number of preview accessories to show in collapsed stack
const PREVIEW_COUNT = 5;

// Storage key for recently used effects
const RECENT_EFFECTS_KEY = '@recent_effects';
const MAX_RECENT_EFFECTS = 20;

// Number of featured accessories to show initially in modal
const FEATURED_COUNT = 8;

// Helper to find item by id in nested structure
const findItemById = (id: string, items: AccessoryItem[]): AccessoryItem | null => {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(id, item.children);
      if (found) return found;
    }
  }
  return null;
};

// Helper to get all IDs in a category tree (including the root)
const getAllIdsInTree = (item: AccessoryItem): string[] => {
  const ids = [item.id];
  if (item.children) {
    for (const child of item.children) {
      ids.push(...getAllIdsInTree(child));
    }
  }
  return ids;
};

// Helper to find the top-level category that contains an item
const findTopLevelCategory = (id: string, categories: AccessoryItem[]): AccessoryItem | null => {
  for (const category of categories) {
    const allIds = getAllIdsInTree(category);
    if (allIds.includes(id)) {
      return category;
    }
  }
  return null;
};

// Helper to get full image URL from relative path
const getFullImageUrl = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  if (imageUrl.startsWith('/')) {
    return `${config.apiBaseUrl}${imageUrl}`;
  }
  return `${config.apiBaseUrl}/${imageUrl}`;
};

// Small helper: shows a light spinner until the image has loaded
const ImageWithLoader: React.FC<{
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
        style={[StyleSheet.absoluteFill, {borderRadius: 12, opacity: loaded ? 1 : 0}]}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
};

export interface AccessoriesBarRef {
  collapse: () => void;
}

const AccessoriesBar = forwardRef<AccessoriesBarRef>((_, ref) => {
  const {colors} = useTheme();
  const {height} = useWindowDimensions();
  const dispatch = useAppDispatch();
  const selectedAccessories = useAppSelector(state => state.transform.selectedAccessories);
  const isSmallPhone = height < 700;

  // Fetch accessories from API
  const {accessories, isLoading: isLoadingAccessories} = useAccessories();

  // State declarations
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AccessoryItem | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<AccessoryItem | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'appearance' | 'accessories'>('appearance');
  const [peekItem, setPeekItem] = useState<AccessoryItem | null>(null);
  const [recentEffects, setRecentEffects] = useState<AccessoryItem[]>([]);

  // Load recent effects from storage
  const loadRecentEffects = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_EFFECTS_KEY);
      if (stored) {
        const recentIds: string[] = JSON.parse(stored);
        // Map IDs to actual accessory items (including nested children)
        const recentItems: AccessoryItem[] = [];
        for (const id of recentIds) {
          const item = findItemById(id, accessories);
          if (item) {
            recentItems.push(item);
          }
        }
        setRecentEffects(recentItems);
      }
    } catch {
      // Silently fail
    }
  }, [accessories]);

  // Save effect to recent list
  const saveToRecent = useCallback(async (item: AccessoryItem) => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_EFFECTS_KEY);
      let recentIds: string[] = stored ? JSON.parse(stored) : [];

      // Remove if already exists, then add to front
      recentIds = recentIds.filter(id => id !== item.id);
      recentIds.unshift(item.id);

      // Limit size
      recentIds = recentIds.slice(0, MAX_RECENT_EFFECTS);

      await AsyncStorage.setItem(RECENT_EFFECTS_KEY, JSON.stringify(recentIds));

      // Update state
      setRecentEffects(prev => {
        const filtered = prev.filter(i => i.id !== item.id);
        return [item, ...filtered].slice(0, MAX_RECENT_EFFECTS);
      });
    } catch {
      // Silently fail
    }
  }, []);

  // Remove single item from recent
  const removeFromRecent = useCallback(async (itemId: string) => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_EFFECTS_KEY);
      let recentIds: string[] = stored ? JSON.parse(stored) : [];
      recentIds = recentIds.filter(id => id !== itemId);
      await AsyncStorage.setItem(RECENT_EFFECTS_KEY, JSON.stringify(recentIds));
      setRecentEffects(prev => prev.filter(i => i.id !== itemId));
    } catch {
      // Silently fail
    }
  }, []);

  // Clear all recent items
  const clearAllRecent = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(RECENT_EFFECTS_KEY);
      setRecentEffects([]);
    } catch {
      // Silently fail
    }
  }, []);

  // Load recent effects when accessories are loaded
  useEffect(() => {
    if (accessories.length > 0) {
      loadRecentEffects();
    }
  }, [accessories, loadRecentEffects]);

  // Watch for successful transforms and save selected accessories to recent
  const showResultModal = useAppSelector(state => state.transform.showResultModal);
  const transformedImageUrl = useAppSelector(state => state.transform.transformedImageUrl);
  const synthesizedImages = useAppSelector(state => state.transform.synthesizedImages);
  const prevShowResultModalRef = useRef(false);

  useEffect(() => {
    // When result modal shows (transform completed successfully)
    const hasResult = transformedImageUrl || synthesizedImages.length > 0;
    if (showResultModal && hasResult && !prevShowResultModalRef.current) {
      // Save all selected accessories to recent
      if (selectedAccessories.length > 0) {
        selectedAccessories.forEach(acc => {
          // Try to find full item, or create from selected accessory
          const item = findItemById(acc.id, accessories);
          const itemToSave: AccessoryItem = item || {
            id: acc.id,
            label: acc.label,
            icon: acc.icon,
            prompt: acc.prompt,
            imageUrl: acc.imageUrl,
          };
          saveToRecent(itemToSave);
        });
      }
    }
    prevShowResultModalRef.current = showResultModal;
  }, [showResultModal, transformedImageUrl, synthesizedImages, selectedAccessories, accessories, saveToRecent]);

  // Filter accessories by type (appearance vs accessories)
  // Type = 1: Accessory, Type = 2: Appearance
  const appearanceItems = useMemo(() => {
    return accessories.filter(item => item.type === AccessoryType.Appearance);
  }, [accessories]);

  const accessoryItems = useMemo(() => {
    return accessories.filter(item => item.type === AccessoryType.Accessory);
  }, [accessories]);

  // Check if type filtering is available (backend provides types)
  const hasTypeFiltering = appearanceItems.length > 0 || accessoryItems.length > 0;

  // Get items based on active tab
  const currentTabItems = useMemo(() => {
    if (activeTab === 'recent') return recentEffects;
    if (!hasTypeFiltering) return accessories;
    return activeTab === 'appearance' ? appearanceItems : accessoryItems;
  }, [activeTab, appearanceItems, accessoryItems, hasTypeFiltering, accessories, recentEffects]);

  // Curated preview accessories:
  // 1st Accessory (non-crown), Headphones, "Complete Makeup", "Blunt Bob", "Wavy" from Hairstyles
  const previewAccessories = useMemo(() => {
    const findByLabel = (label: string) =>
      findItemById(label.toLowerCase().replace(/\s+/g, '-'), accessories)
      || accessories.find(a => a.label.toLowerCase().includes(label.toLowerCase()))
      || accessories.flatMap(a => a.children || []).find(c => c.label.toLowerCase().includes(label.toLowerCase()))
      || accessories.flatMap(a => (a.children || []).flatMap(c => c.children || [])).find(c => c.label.toLowerCase().includes(label.toLowerCase()));

    const accessoryTypeItems = accessories.filter(item => item.type === AccessoryType.Accessory);
    const firstAccessory = accessoryTypeItems.find(a => !a.label.toLowerCase().includes('crown'));
    const headphones = findByLabel('headphone');
    const completeMakeup = findByLabel('complete makeup');
    const bluntBob = findByLabel('blunt bob');
    const wavy = findByLabel('wavy');

    const result: AccessoryItem[] = [];
    if (firstAccessory) result.push(firstAccessory);
    if (headphones) result.push(headphones);
    if (completeMakeup) result.push(completeMakeup);
    if (bluntBob) result.push(bluntBob);
    if (wavy) result.push(wavy);

    // Fallback: fill remaining slots if some weren't found
    if (result.length < PREVIEW_COUNT) {
      for (const item of accessories) {
        if (result.length >= PREVIEW_COUNT) break;
        if (!result.find(r => r.id === item.id)) result.push(item);
      }
    }
    return result.slice(0, PREVIEW_COUNT);
  }, [accessories]);

  // Memoized featured accessories (first 8 from current tab)
  const featuredAccessories = useMemo(() => {
    return currentTabItems.slice(0, FEATURED_COUNT);
  }, [currentTabItems]);

  // Animation values
  const expandAnim = useRef(new Animated.Value(0)).current;
  const isExpandedRef = useRef(false); // Track state for PanResponder

  // Keep ref in sync with state
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  // Get selected IDs from Redux state
  const selectedIds = selectedAccessories.map(a => a.id);

  // Collapse animation function
  const collapseIcons = () => {
    Animated.spring(expandAnim, {
      toValue: 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
    setIsExpanded(false);
  };

  useImperativeHandle(ref, () => ({collapse: collapseIcons}));

  // Expand animation function
  const expandIcons = () => {
    Animated.spring(expandAnim, {
      toValue: 1,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
    setIsExpanded(true);
  };

  // Toggle expand/collapse animation
  const toggleExpand = () => {
    if (isExpanded) {
      collapseIcons();
    } else {
      expandIcons();
    }
  };

  // Pan responder for swipe left to collapse
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes when expanded
        return (
          isExpandedRef.current &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        // Swipe left (negative dx) to collapse
        if (gestureState.dx < -30 && isExpandedRef.current) {
          collapseIcons();
        }
      },
    }),
  ).current;

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      dispatch(removeAccessory(id));
    } else {
      const item = findItemById(id, accessories);
      if (item) {
        dispatch(addAccessory({
          id: item.id,
          label: item.label,
          icon: item.icon,
          prompt: item.prompt,
          imageUrl: item.imageUrl,
          estimatedCoins: item.estimatedCoins,
          isFree: item.isFree,
        }));
      }
    }
  };

  const isSelected = (id: string) => selectedIds.includes(id);

  // Check if an item should be disabled
  const isDisabled = (id: string): boolean => {
    const topCategory = findTopLevelCategory(id, accessories);
    if (!topCategory) return false;
    const allIdsInTree = getAllIdsInTree(topCategory);
    for (const selectedId of selectedIds) {
      if (selectedId !== id && allIdsInTree.includes(selectedId)) {
        return true;
      }
    }
    return false;
  };

  const handleCategoryPress = (category: AccessoryItem) => {
    if (category.children && category.children.length > 0) {
      setSelectedCategory(category);
      setSelectedSubCategory(null);
    } else {
      toggleSelection(category.id);
    }
  };

  const handleSubCategoryPress = (subItem: AccessoryItem) => {
    if (subItem.children && subItem.children.length > 0) {
      setSelectedSubCategory(subItem);
    } else {
      toggleSelection(subItem.id);
    }
  };

  const handleBackPress = () => {
    if (selectedSubCategory) {
      setSelectedSubCategory(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
  };

  const getCurrentItems = (): AccessoryItem[] => {
    if (selectedSubCategory && selectedSubCategory.children) {
      return selectedSubCategory.children;
    }
    if (selectedCategory && selectedCategory.children) {
      return selectedCategory.children;
    }
    if (!showAllCategories) {
      return featuredAccessories;
    }
    return currentTabItems;
  };

  const hiddenCount = Math.max(0, currentTabItems.length - FEATURED_COUNT);

  const getBreadcrumb = () => {
    const tabName = activeTab === 'recent' ? 'Recent' : activeTab === 'appearance' ? 'Appearance' : 'Accessories';
    const parts = hasTypeFiltering ? [tabName] : ['Effects'];
    if (selectedCategory) {
      parts.push(selectedCategory.label);
    }
    if (selectedSubCategory) {
      parts.push(selectedSubCategory.label);
    }
    return parts;
  };

  const closeModal = () => {
    setPeekItem(null);
    setModalVisible(false);
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setShowAllCategories(false);
  };

  const handleRemoveAccessory = (id: string) => {
    dispatch(removeAccessory(id));
  };

  const renderAccessoryItem = ({item}: {item: AccessoryItem}) => {
    const hasChildren = item.children && item.children.length > 0;
    const selected = isSelected(item.id);
    const disabled = isDisabled(item.id);
    const imageUrl = getFullImageUrl(item.imageUrl);

    return (
      <TouchableOpacity
        onPress={() => {
          if (hasChildren && !disabled) {
            handleSubCategoryPress(item);
          } else if (!disabled) {
            toggleSelection(item.id);
          }
        }}
        onLongPress={() => {
          triggerHaptic();
          setPeekItem(item);
        }}
        delayLongPress={300}
        activeOpacity={0.7}
        style={[
          styles.gridItem,
          {
            backgroundColor: selected
              ? colors.primary + '30'
              : disabled
                ? colors.backgroundTertiary + '50'
                : colors.backgroundTertiary,
            borderColor: selected ? colors.primary : 'transparent',
            opacity: disabled ? 0.4 : 1,
          },
        ]}>
        <View style={styles.gridItemContent}>
          {imageUrl ? (
            <ImageWithLoader
              uri={imageUrl}
              style={[styles.gridItemImage, disabled && styles.disabledImage]}
            />
          ) : (
            <Text style={[styles.gridItemIcon, disabled && styles.disabledText]}>{item.icon}</Text>
          )}
          <Text
            style={[
              styles.gridItemLabel,
              {color: selected ? colors.primary : disabled ? colors.textTertiary : colors.textSecondary}
            ]}
            numberOfLines={1}>
            {item.label}
          </Text>
        </View>

        <PriceBadge estimatedCoins={item.estimatedCoins} isFree={item.isFree} variant="modal" />

        {!disabled && (
          <Pressable
            style={[
              styles.addRemoveBadge,
              {
                backgroundColor: selected ? colors.primary : 'rgba(255,255,255,0.95)',
                borderColor: colors.primary,
              }
            ]}
            onPress={() => toggleSelection(item.id)}>
            <Text style={[styles.addRemoveBadgeText, {color: selected ? '#fff' : colors.primary}]}>
              {selected ? '✓' : '+'}
            </Text>
          </Pressable>
        )}

        {disabled && (
          <View style={[styles.disabledBadge, {backgroundColor: colors.textTertiary}]}>
            <Text style={styles.disabledBadgeText}>—</Text>
          </View>
        )}

        {hasChildren && !disabled && (
          <Pressable
            style={[styles.expandButton, {backgroundColor: colors.primary + '20'}]}
            onPress={() => handleSubCategoryPress(item)}>
            <Text style={[styles.expandButtonText, {color: colors.primary}]}>▶</Text>
          </Pressable>
        )}

        {/* Remove from recent button */}
        {activeTab === 'recent' && (
          <Pressable
            style={[styles.removeFromRecentButton, {backgroundColor: colors.error}]}
            onPress={() => removeFromRecent(item.id)}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Text style={styles.removeFromRecentText}>×</Text>
          </Pressable>
        )}
      </TouchableOpacity>
    );
  };

  const selectedItems = selectedAccessories;
  const iconSize = isSmallPhone ? 32 : 40;
  const stackOffset = isSmallPhone ? 14 : 18;

  // Calculate animated positions for stacked icons
  const getIconStyle = (index: number) => {
    const baseLeft = index * stackOffset;
    const expandedLeft = index * (iconSize + 8);

    const animatedLeft = expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [baseLeft, expandedLeft],
    });

    const animatedZIndex = previewAccessories.length - index;

    return {
      position: 'absolute' as const,
      left: animatedLeft,
      zIndex: animatedZIndex,
    };
  };

  // Calculate container width based on expansion state
  const stackedWidth = (previewAccessories.length - 1) * stackOffset + iconSize;
  const expandedWidth = previewAccessories.length * (iconSize + 8) + 60; // +60 for "more" button

  const containerWidth = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [stackedWidth, expandedWidth],
  });

  return (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: colors.backgroundSecondary,
          paddingVertical: isSmallPhone ? 4 : 6,
          minHeight: isSmallPhone ? 46 : 52,
        },
      ]}
      onPress={() => {
        if (isExpanded) {
          collapseIcons();
        }
      }}>
      {/* Stacked/Expandable Accessory Icons */}
      <View style={styles.stackTouchable}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.stackContainer, {width: containerWidth, height: iconSize}]}>
          {previewAccessories.map((item, index) => {
            const stackImageUrl = getFullImageUrl(item.imageUrl);
            return (
              <Animated.View key={item.id} style={getIconStyle(index)}>
                <Pressable
                  style={[
                    styles.stackedIcon,
                    {
                      width: iconSize,
                      height: iconSize,
                      backgroundColor: isSelected(item.id) ? colors.primary : colors.backgroundTertiary,
                      borderColor: isSelected(item.id) ? colors.primary : 'rgba(255,255,255,0.15)',
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    if (isExpanded) {
                      toggleSelection(item.id);
                      collapseIcons();
                    } else {
                      toggleExpand();
                    }
                  }}
                  onLongPress={() => {
                    if (stackImageUrl) {
                      triggerHaptic();
                      setPeekItem(item);
                    }
                  }}
                  delayLongPress={300}>
                  {stackImageUrl ? (
                    <Image
                      source={{uri: stackImageUrl}}
                      style={styles.stackedIconImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={[styles.stackedIconText, {fontSize: isSmallPhone ? 18 : 22}]}>
                      {item.icon}
                    </Text>
                  )}
                  {isSelected(item.id) && (
                    <View style={[styles.selectedCheck, {backgroundColor: colors.primary}]}>
                      <Text style={styles.selectedCheckText}>✓</Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}

          {/* Show More Button - appears when expanded */}
          <Animated.View
            style={[
              styles.moreButtonContainer,
              {
                left: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [stackedWidth - 10, previewAccessories.length * (iconSize + 8)],
                }),
                opacity: expandAnim,
              },
            ]}
            onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={[
                styles.moreButton,
                {
                  height: iconSize,
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => {
                setModalVisible(true);
              }}
              activeOpacity={0.8}>
              <Text style={styles.moreButtonText}>More</Text>
              <Text style={styles.moreButtonIcon}>›</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Hint label when no accessory selected */}
      {selectedAccessories.length === 0 && !isExpanded && (
        <Text style={[styles.hintLabel, {color: colors.textTertiary}]}>
          Choose the style or accessory
        </Text>
      )}

      {/* Selected Accessories Display */}
      {selectedItems.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.selectedScroll}
          contentContainerStyle={styles.carouselContent}>
          {selectedItems.map(item => {
            const selectedImageUrl = getFullImageUrl(item.imageUrl);
            return (
              <View
                key={item.id}
                style={[
                  styles.selectedItem,
                  {
                    backgroundColor: colors.primary + '20',
                    borderColor: colors.primary,
                  }
                ]}>
                {selectedImageUrl ? (
                  <Image
                    source={{uri: selectedImageUrl}}
                    style={styles.selectedItemImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.selectedItemIcon}>{item.icon}</Text>
                )}
                <Pressable
                  style={[styles.removeButton, {backgroundColor: colors.error}]}
                  onPress={() => handleRemoveAccessory(item.id)}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Text style={styles.removeButtonText}>×</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Accessories Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: colors.cardBackground, height: height * 0.85}]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, {borderBottomColor: colors.border}]}>
              <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
                Effects
              </Text>
              {selectedIds.length > 0 && (
                <View style={[styles.countBadge, {backgroundColor: colors.primary}]}>
                  <Text style={styles.countBadgeText}>{selectedIds.length}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
                onPress={closeModal}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={[styles.closeButtonText, {color: colors.textPrimary}]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs for Appearance / Accessories / Recent */}
            {hasTypeFiltering && (
              <View style={[styles.tabsContainer, {borderBottomColor: colors.border}]}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'appearance' && styles.activeTab,
                    activeTab === 'appearance' && {borderBottomColor: colors.primary},
                  ]}
                  onPress={() => {
                    setActiveTab('appearance');
                    setSelectedCategory(null);
                    setSelectedSubCategory(null);
                    setShowAllCategories(false);
                  }}
                  activeOpacity={0.7}>
                  {/* <Text style={styles.tabIcon}>👤</Text> */}
                  <Text
                    style={[
                      styles.tabText,
                      {color: activeTab === 'appearance' ? colors.primary : colors.textSecondary},
                    ]}>
                    Appearance
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'accessories' && styles.activeTab,
                    activeTab === 'accessories' && {borderBottomColor: colors.primary},
                  ]}
                  onPress={() => {
                    setActiveTab('accessories');
                    setSelectedCategory(null);
                    setSelectedSubCategory(null);
                    setShowAllCategories(false);
                  }}
                  activeOpacity={0.7}>
                  {/* <Text style={styles.tabIcon}>🎩</Text> */}
                  <Text
                    style={[
                      styles.tabText,
                      {color: activeTab === 'accessories' ? colors.primary : colors.textSecondary},
                    ]}>
                    Accessories
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'recent' && styles.activeTab,
                    activeTab === 'recent' && {borderBottomColor: colors.primary},
                  ]}
                  onPress={() => {
                    setActiveTab('recent');
                    setSelectedCategory(null);
                    setSelectedSubCategory(null);
                    setShowAllCategories(false);
                  }}
                  activeOpacity={0.7}>
                  {/* <Text style={styles.tabIcon}>🕐</Text> */}
                  <Text
                    style={[
                      styles.tabText,
                      {color: activeTab === 'recent' ? colors.primary : colors.textSecondary},
                    ]}>
                    Recent
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Breadcrumb navigation */}
            {(selectedCategory || selectedSubCategory) && (
              <View style={[styles.breadcrumbContainer, {borderBottomColor: colors.border}]}>
                <Pressable onPress={handleBackPress} style={styles.backButton}>
                  <Text style={[styles.backButtonText, {color: colors.primary}]}>← Back</Text>
                </Pressable>
                <Text style={[styles.breadcrumb, {color: colors.textTertiary}]}>
                  {getBreadcrumb().join(' > ')}
                </Text>
              </View>
            )}

            {/* Grid */}
            {isLoadingAccessories && activeTab !== 'recent' ? (
              <View style={styles.gridContent}>
                {[0, 1, 2].map(rowIdx => (
                  <View key={rowIdx} style={styles.skeletonRow}>
                    {[0, 1, 2, 3].map(colIdx => (
                      <View
                        key={colIdx}
                        style={[
                          styles.skeletonTile,
                          {backgroundColor: colors.backgroundTertiary},
                        ]}>
                        <ActivityIndicator size="small" color={colors.primary} style={{opacity: 0.4}} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
            <FlatList
              data={getCurrentItems()}
              renderItem={renderAccessoryItem}
              keyExtractor={item => item.id}
              numColumns={4}
              contentContainerStyle={styles.gridContent}
              columnWrapperStyle={styles.gridRow}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                activeTab === 'recent' && recentEffects.length > 0 ? (
                  <TouchableOpacity
                    style={[styles.clearAllButton, {borderColor: colors.error}]}
                    onPress={clearAllRecent}
                    activeOpacity={0.7}>
                    <Text style={[styles.clearAllText, {color: colors.error}]}>
                      Clear All
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={
                activeTab === 'recent' ? (
                  <View style={styles.emptyState}>
                    {/* <Text style={styles.emptyStateIcon}>🕐</Text> */}
                    <Text style={[styles.emptyStateTitle, {color: colors.textPrimary}]}>
                      No Recent Effects
                    </Text>
                    <Text style={[styles.emptyStateText, {color: colors.textSecondary}]}>
                      Effects you apply will appear here for quick access
                    </Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                activeTab !== 'recent' && !selectedCategory && !selectedSubCategory && (showAllCategories || hiddenCount > 0) ? (
                  <TouchableOpacity
                    style={[
                      styles.showMoreButton,
                      {
                        backgroundColor: colors.backgroundTertiary,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setShowAllCategories(!showAllCategories)}
                    activeOpacity={0.7}>
                    <Text style={[styles.showMoreText, {color: colors.primary}]}>
                      {showAllCategories ? 'Show Less' : `Show More (+${hiddenCount})`}
                    </Text>
                    <Text style={[styles.showMoreIcon, {color: colors.primary}]}>
                      {showAllCategories ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
            )}

            {/* Done Button */}
            <TouchableOpacity
              style={[styles.doneButton, {backgroundColor: colors.primary}]}
              onPress={closeModal}
              activeOpacity={0.8}>
              <Text style={styles.doneButtonText}>
                Done {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Peek Preview inside modal - rendered here to appear on top of modal content */}
        {!!peekItem && (
          <View
            style={styles.peekOverlay}
            onTouchEnd={() => setPeekItem(null)}
            onTouchCancel={() => setPeekItem(null)}>
            <View style={[styles.peekContainer, {backgroundColor: colors.cardBackground}]}>
              {getFullImageUrl(peekItem.imageUrl) ? (
                <Image
                  source={{uri: getFullImageUrl(peekItem.imageUrl)!}}
                  style={styles.peekImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.peekEmoji}>{peekItem.icon}</Text>
              )}
              <Text style={[styles.peekLabel, {color: colors.textPrimary}]}>
                {peekItem.label}
              </Text>
            </View>
          </View>
        )}
      </Modal>

      {/* Peek Preview - for studio tab long-press (when modal is closed) */}
      {!!peekItem && !modalVisible && (
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
              {getFullImageUrl(peekItem.imageUrl) ? (
                <Image
                  source={{uri: getFullImageUrl(peekItem.imageUrl)!}}
                  style={styles.peekImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.peekEmoji}>{peekItem.icon}</Text>
              )}
              <Text style={[styles.peekLabel, {color: colors.textPrimary}]}>
                {peekItem.label}
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hintLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
    zIndex: 10,
  },
  stackTouchable: {
    flexShrink: 0,
  },
  stackContainer: {
    position: 'relative',
  },
  stackedIcon: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  stackedIconText: {},
  stackedIconImage: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
  },
  selectedCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCheckText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  moreButtonContainer: {
    position: 'absolute',
    top: 0,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 2,
  },
  moreButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  moreButtonIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '300',
  },
  selectedScroll: {
    flex: 1,
  },
  carouselContent: {
    gap: 8,
    paddingRight: 8,
    alignItems: 'center',
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  selectedItemIcon: {
    fontSize: 16,
  },
  selectedItemImage: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  removeButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  breadcrumb: {
    fontSize: 12,
    flex: 1,
  },
  gridContent: {
    padding: 16,
    paddingBottom: 100,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  gridItem: {
    width: '23%',
    aspectRatio: 0.85,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  skeletonTile: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItemContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  gridItemIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  gridItemImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 4,
  },
  disabledImage: {
    opacity: 0.5,
  },
  gridItemLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  addRemoveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  addRemoveBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  disabledBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledText: {
    opacity: 0.5,
  },
  expandButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandButtonText: {
    fontSize: 8,
    fontWeight: '700',
  },
  doneButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1.5,
    marginTop: 8,
    marginBottom: 20,
    alignSelf: 'center',
    gap: 8,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  showMoreIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Tab styles
  tabsContainer: {
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
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabText: {
    fontSize: 17,
    fontWeight: '600',
  },
  // Empty state styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Remove from recent button
  removeFromRecentButton: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFromRecentText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: -1,
  },
  // Clear all button
  clearAllButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Peek preview styles
  peekOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
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
  peekEmoji: {
    fontSize: 120,
    marginBottom: 16,
  },
  peekLabel: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});

AccessoriesBar.displayName = 'AccessoriesBar';

export default AccessoriesBar;
