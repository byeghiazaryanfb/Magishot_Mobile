import React, {useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
  Pressable,
  FlatList,
} from 'react-native';
import {useTheme} from '../theme/ThemeContext';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// Sheet widths (horizontal from right)
const COLLAPSED_WIDTH = 50; // Just the tab handle
const HALF_WIDTH = SCREEN_WIDTH * 0.45;
const FULL_WIDTH = SCREEN_WIDTH * 0.75;

// Snap points
type SheetState = 'collapsed' | 'half' | 'full';

interface SubItem {
  id: string;
  icon: string;
  label: string;
  children?: SubItem[];
}

interface AccessoryCategory {
  id: string;
  icon: string;
  label: string;
  children?: SubItem[];
}

const ACCESSORIES: AccessoryCategory[] = [
  {
    id: 'glasses',
    icon: '👓',
    label: 'Glasses',
    children: [
      {
        id: 'sunglasses',
        icon: '🕶️',
        label: 'Sunglasses',
        children: [
          {id: 'rayban', icon: '🕶️', label: 'Ray-Ban'},
          {id: 'diesel', icon: '🕶️', label: 'Diesel'},
          {id: 'gucci', icon: '🕶️', label: 'Gucci'},
        ],
      },
      {
        id: 'optical',
        icon: '👓',
        label: 'Optical',
        children: [
          {id: 'round', icon: '⭕', label: 'Round'},
          {id: 'square', icon: '⬜', label: 'Square'},
          {id: 'aviator', icon: '🔷', label: 'Aviator'},
        ],
      },
    ],
  },
  {
    id: 'hat',
    icon: '🎩',
    label: 'Hat',
    children: [
      {id: 'tophat', icon: '🎩', label: 'Top Hat'},
      {id: 'cap', icon: '🧢', label: 'Cap'},
      {id: 'beanie', icon: '🧶', label: 'Beanie'},
    ],
  },
  {
    id: 'crown',
    icon: '👑',
    label: 'Crown',
    children: [
      {id: 'gold', icon: '👑', label: 'Gold'},
      {id: 'silver', icon: '🥈', label: 'Silver'},
      {id: 'tiara', icon: '👸', label: 'Tiara'},
    ],
  },
  {
    id: 'mask',
    icon: '🎭',
    label: 'Mask',
    children: [
      {id: 'theater', icon: '🎭', label: 'Theater'},
      {id: 'superhero', icon: '🦸', label: 'Superhero'},
    ],
  },
  {id: 'bow', icon: '🎀', label: 'Bow'},
  {id: 'star', icon: '⭐', label: 'Star'},
  {id: 'heart', icon: '❤️', label: 'Heart'},
  {id: 'flower', icon: '🌸', label: 'Flower'},
  {id: 'butterfly', icon: '🦋', label: 'Butterfly'},
  {id: 'rainbow', icon: '🌈', label: 'Rainbow'},
];

const AccessoriesBottomSheet: React.FC = () => {
  const {colors} = useTheme();
  const [sheetState, setSheetState] = useState<SheetState>('collapsed');
  const [selectedCategory, setSelectedCategory] = useState<AccessoryCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Start with only COLLAPSED_WIDTH visible (push right by FULL_WIDTH - COLLAPSED_WIDTH)
  const translateX = useRef(new Animated.Value(FULL_WIDTH - COLLAPSED_WIDTH)).current;
  const lastGestureDx = useRef(0);

  const getWidthForState = (state: SheetState): number => {
    switch (state) {
      case 'collapsed':
        return COLLAPSED_WIDTH;
      case 'half':
        return HALF_WIDTH;
      case 'full':
        return FULL_WIDTH;
    }
  };

  const animateToState = useCallback((state: SheetState) => {
    // With right: 0, translateX pushes sheet right (off screen)
    // Collapsed: show only COLLAPSED_WIDTH, so push right by (FULL_WIDTH - COLLAPSED_WIDTH)
    // Half: show HALF_WIDTH, so push right by (FULL_WIDTH - HALF_WIDTH)
    // Full: show FULL_WIDTH, so translateX = 0
    const targetX = FULL_WIDTH - getWidthForState(state);
    setSheetState(state);
    Animated.spring(translateX, {
      toValue: targetX,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Capture horizontal swipes
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        lastGestureDx.current = 0;
      },
      onPanResponderMove: (_, gestureState) => {
        // With right: 0, translateX represents how much sheet is pushed right
        const currentTranslateX = FULL_WIDTH - getWidthForState(sheetState);
        const newTranslateX = Math.max(
          0, // Full width (no translation)
          Math.min(FULL_WIDTH - COLLAPSED_WIDTH, currentTranslateX + gestureState.dx)
        );
        translateX.setValue(newTranslateX);
        lastGestureDx.current = gestureState.dx;
      },
      onPanResponderRelease: (_, gestureState) => {
        const velocity = gestureState.vx;
        const currentTranslateX = FULL_WIDTH - getWidthForState(sheetState) + lastGestureDx.current;

        let targetState: SheetState;

        if (velocity > 0.5) {
          // Fast swipe right - collapse more
          if (sheetState === 'full') {
            targetState = 'half';
          } else {
            targetState = 'collapsed';
          }
        } else if (velocity < -0.5) {
          // Fast swipe left - expand more
          if (sheetState === 'collapsed') {
            targetState = 'half';
          } else {
            targetState = 'full';
          }
        } else {
          // Snap to nearest based on current position
          const collapsedTranslateX = FULL_WIDTH - COLLAPSED_WIDTH;
          const halfTranslateX = FULL_WIDTH - HALF_WIDTH;
          const fullTranslateX = 0;

          const distToCollapsed = Math.abs(currentTranslateX - collapsedTranslateX);
          const distToHalf = Math.abs(currentTranslateX - halfTranslateX);
          const distToFull = Math.abs(currentTranslateX - fullTranslateX);

          if (distToCollapsed <= distToHalf && distToCollapsed <= distToFull) {
            targetState = 'collapsed';
          } else if (distToHalf <= distToFull) {
            targetState = 'half';
          } else {
            targetState = 'full';
          }
        }

        animateToState(targetState);
      },
    })
  ).current;

  const handleCategoryPress = (category: AccessoryCategory) => {
    if (category.children && category.children.length > 0) {
      setSelectedCategory(category);
      setSelectedSubCategory(null);
      if (sheetState === 'collapsed') {
        animateToState('half');
      }
    } else {
      toggleSelection(category.id);
    }
  };

  const handleSubCategoryPress = (subItem: SubItem) => {
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

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const isSelected = (id: string) => selectedIds.includes(id);

  const renderAccessoryItem = ({item}: {item: AccessoryCategory | SubItem}) => {
    const hasChildren = item.children && item.children.length > 0;
    const selected = isSelected(item.id);

    return (
      <Pressable
        style={({pressed}) => [
          styles.gridItem,
          {
            backgroundColor: selected ? colors.primary + '30' : colors.backgroundTertiary,
            borderColor: selected ? colors.primary : 'transparent',
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        onPress={() => {
          if ('children' in item && item.children) {
            handleSubCategoryPress(item as SubItem);
          } else {
            toggleSelection(item.id);
          }
        }}>
        <Text style={styles.gridItemIcon}>{item.icon}</Text>
        <Text
          style={[styles.gridItemLabel, {color: selected ? colors.primary : colors.textSecondary}]}
          numberOfLines={1}>
          {item.label}
        </Text>
        {hasChildren && (
          <View style={[styles.hasChildrenBadge, {backgroundColor: colors.primary}]}>
            <Text style={styles.hasChildrenBadgeText}>+</Text>
          </View>
        )}
        {selected && !hasChildren && (
          <View style={[styles.selectedBadge, {backgroundColor: colors.primary}]}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const getCurrentItems = (): (AccessoryCategory | SubItem)[] => {
    if (selectedSubCategory && selectedSubCategory.children) {
      return selectedSubCategory.children;
    }
    if (selectedCategory && selectedCategory.children) {
      return selectedCategory.children;
    }
    return ACCESSORIES;
  };

  const getBreadcrumb = () => {
    const parts = ['Accessories'];
    if (selectedCategory) {
      parts.push(selectedCategory.label);
    }
    if (selectedSubCategory) {
      parts.push(selectedSubCategory.label);
    }
    return parts;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.cardBackground,
          transform: [{translateX}],
        },
      ]}>
      {/* Handle on left side */}
      <View style={styles.handleContainer} {...panResponder.panHandlers}>
        <View style={[styles.handle, {backgroundColor: colors.border}]} />
        {sheetState === 'collapsed' && (
          <View style={styles.collapsedLabel}>
            {'Accessories'.split('').map((char, i) => (
              <Text key={i} style={[styles.collapsedLabelChar, {color: colors.textPrimary}]}>
                {char}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Main content area */}
      <View style={styles.contentArea}>
        {/* Header */}
        {sheetState !== 'collapsed' && (
          <View style={styles.header}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              Accessories
            </Text>
            {selectedIds.length > 0 && (
              <View style={[styles.countBadge, {backgroundColor: colors.primary}]}>
                <Text style={styles.countBadgeText}>{selectedIds.length}</Text>
              </View>
            )}
          </View>
        )}

        {/* Breadcrumb navigation */}
        {sheetState !== 'collapsed' && (selectedCategory || selectedSubCategory) && (
          <View style={styles.breadcrumbContainer}>
            <Pressable onPress={handleBackPress} style={styles.backButton}>
              <Text style={[styles.backButtonText, {color: colors.primary}]}>← Back</Text>
            </Pressable>
            <Text style={[styles.breadcrumb, {color: colors.textTertiary}]} numberOfLines={1}>
              {getBreadcrumb().join(' > ')}
            </Text>
          </View>
        )}

        {/* Categories / Items Grid */}
        {sheetState !== 'collapsed' && (
          <FlatList
            data={getCurrentItems()}
            renderItem={renderAccessoryItem}
            keyExtractor={item => item.id}
            numColumns={sheetState === 'full' ? 3 : 2}
            key={sheetState === 'full' ? 'full' : 'half'}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Collapsed preview - vertical */}
        {sheetState === 'collapsed' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.collapsedContent}>
            {ACCESSORIES.slice(0, 8).map(item => (
              <Pressable
                key={item.id}
                style={[
                  styles.collapsedItem,
                  {
                    backgroundColor: isSelected(item.id) ? colors.primary + '30' : colors.backgroundTertiary,
                  },
                ]}
                onPress={() => handleCategoryPress(item)}>
                <Text style={styles.collapsedItemIcon}>{item.icon}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 120,
    bottom: 100,
    right: 0,
    width: FULL_WIDTH,
    flexDirection: 'row',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: -4, height: 0},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  handleContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  handle: {
    position: 'absolute',
    left: 8,
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  collapsedLabel: {
    alignItems: 'center',
  },
  collapsedLabelChar: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  contentArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
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
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  breadcrumb: {
    fontSize: 11,
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  gridItem: {
    flex: 1,
    maxWidth: '48%',
    aspectRatio: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    padding: 6,
  },
  gridItemIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  gridItemLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  hasChildrenBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hasChildrenBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  collapsedContent: {
    paddingVertical: 8,
    alignItems: 'center',
    gap: 6,
  },
  collapsedItem: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedItemIcon: {
    fontSize: 18,
  },
  moreText: {
    fontSize: 9,
    fontWeight: '600',
  },
});

export default AccessoriesBottomSheet;
