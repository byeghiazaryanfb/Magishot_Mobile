import React, {useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  FlatList,
  Image,
  useWindowDimensions,
  Animated,
  PanResponder,
} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import {useActions} from '../hooks/useActions';
import {ActionItem} from '../services/actionsApi';
import {config} from '../utils/config';
import PriceBadge from './PriceBadge';
import {triggerHaptic} from '../utils/haptics';

export type SynthesizeAction = ActionItem;

// Helper to get full image URL from relative path
const getFullImageUrl = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  // Prepend API base URL for relative paths
  return `${config.apiBaseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
};

// Number of preview actions to show in collapsed stack
const PREVIEW_COUNT = 4;

// Helper to find item by id in nested structure
const findItemById = (id: string, items: SynthesizeAction[]): SynthesizeAction | null => {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(id, item.children);
      if (found) return found;
    }
  }
  return null;
};

export interface ActionsBarRef {
  collapse: () => void;
}

interface ActionsBarProps {
  selectedAction: SynthesizeAction | null;
  onSelectAction: (action: SynthesizeAction | null) => void;
}

const ActionsBar = forwardRef<ActionsBarRef, ActionsBarProps>(({
  selectedAction,
  onSelectAction,
}, ref) => {
  const {colors} = useTheme();
  const {width, height} = useWindowDimensions();
  const isSmallPhone = height < 700;
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SynthesizeAction | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SynthesizeAction | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [peekItem, setPeekItem] = useState<SynthesizeAction | null>(null);

  // Fetch actions from API
  const {actions, isLoading} = useActions();

  // Memoized preview actions (first 4)
  const previewActions = useMemo(() => {
    return actions.slice(0, PREVIEW_COUNT);
  }, [actions]);

  // Animation values
  const expandAnim = useRef(new Animated.Value(0)).current;
  const isExpandedRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

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
        return (
          isExpandedRef.current &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -30 && isExpandedRef.current) {
          collapseIcons();
        }
      },
    }),
  ).current;

  // Check if action is selected
  const isActionSelected = (id: string) => selectedAction?.id === id;

  // Toggle action selection
  const toggleActionSelection = (action: SynthesizeAction) => {
    if (selectedAction?.id === action.id) {
      onSelectAction(null);
    } else {
      onSelectAction(action);
    }
  };

  const handleCategoryPress = (category: SynthesizeAction) => {
    if (category.children && category.children.length > 0) {
      setSelectedCategory(category);
      setSelectedSubCategory(null);
    } else {
      // This is a leaf node, select it
      onSelectAction(category);
      closeModal();
    }
  };

  const handleSubCategoryPress = (subItem: SynthesizeAction) => {
    if (subItem.children && subItem.children.length > 0) {
      setSelectedSubCategory(subItem);
    } else {
      // This is a leaf node, select it
      onSelectAction(subItem);
      closeModal();
    }
  };

  const handleBackPress = () => {
    if (selectedSubCategory) {
      setSelectedSubCategory(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
  };

  const getCurrentItems = (): SynthesizeAction[] => {
    if (selectedSubCategory && selectedSubCategory.children) {
      return selectedSubCategory.children;
    }
    if (selectedCategory && selectedCategory.children) {
      return selectedCategory.children;
    }
    return actions;
  };

  const getBreadcrumb = () => {
    const parts = ['Actions'];
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
  };

  const handleRemoveAction = () => {
    onSelectAction(null);
  };

  const renderActionItem = ({item}: {item: SynthesizeAction}) => {
    const hasChildren = item.children && item.children.length > 0;
    const isSelected = selectedAction?.id === item.id;

    return (
      <View
        style={[
          styles.gridItem,
          {
            backgroundColor: isSelected
              ? colors.primary + '30'
              : colors.backgroundTertiary,
            borderColor: isSelected ? colors.primary : 'transparent',
          },
        ]}>
        {/* Main content */}
        <Pressable
          style={styles.gridItemContent}
          onPress={() => hasChildren ? handleSubCategoryPress(item) : handleCategoryPress(item)}
          onLongPress={() => {
            triggerHaptic();
            setPeekItem(item);
          }}>
          {item.imageUrl ? (
            <Image
              source={{uri: getFullImageUrl(item.imageUrl)!}}
              style={styles.gridItemImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.gridItemIcon}>{item.icon}</Text>
          )}
          <Text
            style={[
              styles.gridItemLabel,
              {color: isSelected ? colors.primary : colors.textSecondary}
            ]}
            numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>

        <PriceBadge estimatedCoins={item.estimatedCoins} isFree={item.isFree} variant="modal" />

        {/* Select button for leaf nodes */}
        {!hasChildren && (
          <Pressable
            style={[
              styles.selectBadge,
              {
                backgroundColor: isSelected ? colors.primary : 'rgba(255,255,255,0.95)',
                borderColor: colors.primary,
              }
            ]}
            onPress={() => {
              onSelectAction(item);
              closeModal();
            }}>
            <Text style={[styles.selectBadgeText, {color: isSelected ? '#fff' : colors.primary}]}>
              {isSelected ? '✓' : '+'}
            </Text>
          </Pressable>
        )}

        {/* Arrow to navigate to subcategories */}
        {hasChildren && (
          <Pressable
            style={[styles.expandButton, {backgroundColor: colors.primary + '20'}]}
            onPress={() => handleSubCategoryPress(item)}>
            <Text style={[styles.expandButtonText, {color: colors.primary}]}>▶</Text>
          </Pressable>
        )}
      </View>
    );
  };

  // Same sizes as AccessoriesBar
  const iconSize = isSmallPhone ? 32 : 40;
  const stackOffset = isSmallPhone ? 14 : 18;

  // Calculate widths
  const stackedWidth = (previewActions.length - 1) * stackOffset + iconSize;
  const expandedWidth = previewActions.length * (iconSize + 8) + 60; // +60 for "more" button

  // Calculate animated width for the stack container
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
      {/* Stacked/Expandable Action Icons */}
      <View style={styles.stackTouchable}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.stackContainer, {width: containerWidth, height: iconSize}]}>
          {previewActions.map((item, index) => {
            // Animated position for each icon (same as AccessoriesBar)
            const baseLeft = index * stackOffset;
            const expandedLeft = index * (iconSize + 8);
            const leftPosition = expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [baseLeft, expandedLeft],
            });

            return (
              <Animated.View
                key={item.id}
                style={[
                  styles.stackedIcon,
                  {
                    width: iconSize,
                    height: iconSize,
                    backgroundColor: isActionSelected(item.id) ? colors.primary : colors.backgroundTertiary,
                    borderColor: isActionSelected(item.id) ? colors.primary : 'rgba(255,255,255,0.15)',
                    position: 'absolute',
                    left: leftPosition,
                    zIndex: previewActions.length - index,
                  },
                ]}>
                <TouchableOpacity
                  style={styles.stackedIconTouchable}
                  onPress={() => {
                    triggerHaptic();
                    if (isExpanded) {
                      toggleActionSelection(item);
                      collapseIcons();
                    } else {
                      toggleExpand();
                    }
                  }}
                  onLongPress={() => {
                    triggerHaptic();
                    setPeekItem(item);
                  }}
                  delayLongPress={300}
                  activeOpacity={0.8}>
                  {item.imageUrl ? (
                    <Image
                      source={{uri: getFullImageUrl(item.imageUrl)!}}
                      style={styles.stackedIconImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={[styles.stackedIconText, {fontSize: isSmallPhone ? 20 : 24}]}>
                      {item.icon}
                    </Text>
                  )}
                </TouchableOpacity>
                {isActionSelected(item.id) && (
                  <View style={[styles.selectedCheck, {backgroundColor: colors.primary}]}>
                    <Text style={styles.selectedCheckText}>✓</Text>
                  </View>
                )}
              </Animated.View>
            );
          })}

          {/* More Button - appears when expanded */}
          <Animated.View
            style={[
              styles.moreButton,
              {
                backgroundColor: colors.primary,
                opacity: expandAnim,
                height: iconSize,
                left: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [stackedWidth - 10, previewActions.length * (iconSize + 8)],
                }),
              },
            ]}
            onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={styles.moreButtonTouchable}
              onPress={() => {
                setModalVisible(true);
              }}
              activeOpacity={0.8}>
              <Text style={styles.moreButtonText}>More</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Selected Action Display */}
      {selectedAction && (
        <View
          style={[
            styles.selectedItem,
            {
              backgroundColor: colors.primary + '20',
              borderColor: colors.primary,
            }
          ]}>
          {selectedAction.imageUrl ? (
            <Image
              source={{uri: getFullImageUrl(selectedAction.imageUrl)!}}
              style={styles.selectedItemImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.selectedItemIcon}>{selectedAction.icon}</Text>
          )}
          <Pressable
            style={[styles.removeButton, {backgroundColor: colors.error}]}
            onPress={handleRemoveAction}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Text style={styles.removeButtonText}>×</Text>
          </Pressable>
        </View>
      )}

      {/* Actions Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: colors.cardBackground, height: height * 0.7}]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, {borderBottomColor: colors.border}]}>
              <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
                Actions
              </Text>
              {selectedAction && (
                <View style={[styles.countBadge, {backgroundColor: colors.primary}]}>
                  <Text style={styles.countBadgeText}>1</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
                onPress={closeModal}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={[styles.closeButtonText, {color: colors.textPrimary}]}>✕</Text>
              </TouchableOpacity>
            </View>

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
            <FlatList
              data={getCurrentItems()}
              renderItem={renderActionItem}
              keyExtractor={item => item.id}
              numColumns={4}
              contentContainerStyle={styles.gridContent}
              columnWrapperStyle={styles.gridRow}
              showsVerticalScrollIndicator={false}
            />

            {/* Done Button */}
            <TouchableOpacity
              style={[styles.doneButton, {backgroundColor: colors.primary}]}
              onPress={closeModal}
              activeOpacity={0.8}>
              <Text style={styles.doneButtonText}>
                Done {selectedAction ? '(1)' : ''}
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

ActionsBar.displayName = 'ActionsBar';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    flexShrink: 0,
    zIndex: 10,
  },
  stackTouchable: {
    flexShrink: 0,
  },
  stackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  stackedIconTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  stackedIconText: {
    textAlign: 'center',
  },
  stackedIconImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  selectedCheck: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCheckText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  moreButton: {
    position: 'absolute',
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButtonTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedScroll: {
    flex: 1,
  },
  carouselContent: {
    gap: 10,
    paddingRight: 16,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 6,
    borderWidth: 1,
    gap: 6,
  },
  selectedItemIcon: {
    fontSize: 18,
  },
  selectedItemImage: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  selectedItemLabel: {
    fontWeight: '600',
    fontSize: 13,
    maxWidth: 120,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  gridItemLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectBadge: {
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
  selectBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  expandButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandButtonText: {
    fontSize: 10,
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

export default ActionsBar;
