import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
import {useTheme} from '../theme/ThemeContext';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

// Sidebar states: 0 = closed, 1 = open
type SidebarState = 0 | 1;

const CLOSED_WIDTH = 0;
const OPEN_WIDTH = 180;
const TAB_WIDTH = 24;

// Subcategory item (up to 3 levels deep)
interface SubItem {
  id: string;
  icon: string;
  label: string;
  children?: SubItem[];
}

interface AccessoryItem {
  id: string;
  icon: string;
  label: string;
  children?: SubItem[];
}

const ACCESSORIES: AccessoryItem[] = [
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
      {
        id: 'winter',
        icon: '🧣',
        label: 'Winter',
        children: [
          {id: 'beanie', icon: '🧶', label: 'Beanie'},
          {id: 'earflap', icon: '❄️', label: 'Ear Flap'},
        ],
      },
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
];

// Button dimensions
const BUTTON_SQUARE_SIZE = 38;
const BUTTON_RECT_WIDTH = 160;
const BUTTON_RECT_HEIGHT = 44;

interface AccessoryItemComponentProps {
  item: AccessoryItem | SubItem;
  level: number;
  sidebarState: SidebarState;
  expandedIds: string[];
  selectedIds: string[];
  onToggleExpand: (id: string) => void;
  onSelectItem: (item: AccessoryItem | SubItem) => void;
  colors: any;
}

const AccessoryItemComponent: React.FC<AccessoryItemComponentProps> = ({
  item,
  level,
  sidebarState,
  expandedIds,
  selectedIds,
  onToggleExpand,
  onSelectItem,
  colors,
}) => {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedIds.includes(item.id);
  const isSelected = selectedIds.includes(item.id);
  const indentLeft = level * 8; // Reduced indent for deeper levels

  const handleExpandPress = () => {
    onToggleExpand(item.id);
  };

  return (
    <View style={styles.itemContainer}>
      {/* Main row with icon, label, and plus button */}
      <View
        style={[
          styles.accessoryButton,
          {
            backgroundColor: isSelected ? colors.primary + '30' : colors.backgroundTertiary,
            height: BUTTON_RECT_HEIGHT,
            borderBottomLeftRadius: hasChildren && isExpanded ? 0 : 10,
            borderBottomRightRadius: hasChildren && isExpanded ? 0 : 10,
            borderWidth: isSelected ? 2 : 0,
            borderColor: isSelected ? colors.primary : 'transparent',
          },
        ]}>
        {/* Icon */}
        <Text style={styles.accessoryIcon}>{item.icon}</Text>

        {/* Label */}
        {sidebarState === 1 && (
          <Text
            style={[styles.accessoryLabel, {color: isSelected ? colors.primary : colors.textSecondary}]}
            numberOfLines={1}>
            {item.label}
          </Text>
        )}

        {/* + button to add accessory */}
        {sidebarState === 1 && (
          <Pressable
            style={({pressed}) => [
              styles.plusButton,
              {
                backgroundColor: isSelected ? colors.primary : colors.primary + '20',
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            onPress={() => {
              console.log('Plus pressed for:', item.label);
              onSelectItem(item);
            }}>
            <Text style={[styles.plusButtonText, {color: isSelected ? '#fff' : colors.primary}]}>
              {isSelected ? '✓' : '+'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Arrow at bottom - only for items with subcategories */}
      {hasChildren && sidebarState === 1 && (
        <Pressable
          style={[styles.arrowIndicator, {backgroundColor: colors.backgroundTertiary}]}
          onPress={handleExpandPress}>
          <Text style={[styles.arrowIndicatorText, {color: colors.textTertiary}]}>
            {isExpanded ? '▲' : '▼'}
          </Text>
        </Pressable>
      )}

      {/* Render children if expanded - up to 3 levels */}
      {hasChildren && isExpanded && level < 3 && (
        <View style={[styles.childrenContainer, {borderLeftColor: colors.border}]}>
          {item.children!.map(child => (
            <AccessoryItemComponent
              key={child.id}
              item={child}
              level={level + 1}
              sidebarState={sidebarState}
              expandedIds={expandedIds}
              selectedIds={selectedIds}
              onToggleExpand={onToggleExpand}
              onSelectItem={onSelectItem}
              colors={colors}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const AccessoriesSidebar: React.FC = () => {
  const {colors} = useTheme();
  const [sidebarState, setSidebarState] = useState<SidebarState>(0);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const sidebarWidth = useRef(new Animated.Value(CLOSED_WIDTH)).current;
  const tabOpacity = useRef(new Animated.Value(1)).current;

  const getWidthForState = (state: SidebarState): number => {
    return state === 0 ? CLOSED_WIDTH : OPEN_WIDTH;
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectItem = (item: AccessoryItem | SubItem) => {
    setSelectedIds(prev => {
      if (prev.includes(item.id)) {
        return prev.filter(i => i !== item.id);
      } else {
        return [...prev, item.id];
      }
    });
    // TODO: Add the accessory to the photo transformation
    console.log('Selected accessory:', item.label);
  };

  const animateToState = (newState: SidebarState) => {
    const targetWidth = getWidthForState(newState);
    setSidebarState(newState);

    // Collapse all when closing
    if (newState === 0) {
      setExpandedIds([]);
    }

    Animated.parallel([
      Animated.spring(sidebarWidth, {
        toValue: targetWidth,
        useNativeDriver: false,
        friction: 8,
        tension: 40,
      }),
      Animated.timing(tabOpacity, {
        toValue: newState === 0 ? 1 : 0.7,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleTabPress = () => {
    // Toggle between closed and open
    const nextState: SidebarState = sidebarState === 0 ? 1 : 0;
    animateToState(nextState);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal swipes with enough movement
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        const currentWidth = getWidthForState(sidebarState);
        // Negative dx means swipe left (open), positive means swipe right (close)
        const newWidth = Math.max(
          CLOSED_WIDTH,
          Math.min(OPEN_WIDTH, currentWidth - gestureState.dx),
        );
        sidebarWidth.setValue(newWidth);
      },
      onPanResponderRelease: (_, gestureState) => {
        const velocity = gestureState.vx;
        const currentAnimatedWidth = (sidebarWidth as any)._value || 0;

        let targetState: SidebarState;

        // Use velocity to determine direction
        if (velocity < -0.5) {
          // Fast swipe left - open
          targetState = 1;
        } else if (velocity > 0.5) {
          // Fast swipe right - close
          targetState = 0;
        } else {
          // Slow movement - snap to nearest state
          targetState = currentAnimatedWidth > OPEN_WIDTH / 2 ? 1 : 0;
        }

        animateToState(targetState);
      },
    }),
  ).current;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Edge swipe area - always visible for opening when closed */}
      <View
        style={styles.edgeSwipeArea}
        {...panResponder.panHandlers}
      />

      {/* Sidebar Content */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            width: sidebarWidth,
            backgroundColor: colors.cardBackground,
            borderLeftColor: colors.border,
          },
        ]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {ACCESSORIES.map(accessory => (
            <AccessoryItemComponent
              key={accessory.id}
              item={accessory}
              level={0}
              sidebarState={sidebarState}
              expandedIds={expandedIds}
              selectedIds={selectedIds}
              onToggleExpand={handleToggleExpand}
              onSelectItem={handleSelectItem}
              colors={colors}
            />
          ))}
        </ScrollView>
      </Animated.View>

      {/* Tab Handle */}
      <Animated.View
        style={[
          styles.tabContainer,
          {
            right: sidebarWidth,
            opacity: tabOpacity,
          },
        ]}>
        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.shadow,
            },
          ]}
          onPress={handleTabPress}
          activeOpacity={0.8}
          {...panResponder.panHandlers}>
          <Text style={styles.tabText}>A</Text>
          <Text style={styles.tabText}>c</Text>
          <Text style={styles.tabText}>c</Text>
          <Text style={styles.tabText}>e</Text>
          <Text style={styles.tabText}>s</Text>
          <Text style={styles.tabText}>s</Text>
          <Text style={styles.tabText}>o</Text>
          <Text style={styles.tabText}>r</Text>
          <Text style={styles.tabText}>i</Text>
          <Text style={styles.tabText}>e</Text>
          <Text style={styles.tabText}>s</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  edgeSwipeArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 30,
    zIndex: 101,
  },
  sidebar: {
    height: '100%',
    borderLeftWidth: 1,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 60,
    paddingHorizontal: 6,
    gap: 6,
  },
  itemContainer: {
    width: '100%',
  },
  accessoryButton: {
    flexDirection: 'row',
    borderRadius: 10,
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  accessoryIcon: {
    fontSize: 16,
  },
  accessoryLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'left',
    flex: 1,
  },
  plusButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  plusButtonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginTop: -1,
  },
  arrowIndicator: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: -2,
  },
  arrowIndicatorText: {
    fontSize: 8,
    fontWeight: '600',
  },
  childrenContainer: {
    marginLeft: 4,
    borderLeftWidth: 2,
    paddingLeft: 2,
    marginTop: 4,
    gap: 4,
  },
  tabContainer: {
    position: 'absolute',
    top: '50%',
    transform: [{translateY: -60}],
  },
  tab: {
    width: TAB_WIDTH,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {width: -2, height: 0},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  tabText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 11,
  },
});

export default AccessoriesSidebar;
