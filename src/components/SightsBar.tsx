import React, {useMemo, useState} from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  useWindowDimensions,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {Sight, isNewSight, SightCategory} from '../constants/sights';
import PriceBadge from './PriceBadge';
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {setSelectedSight, togglePinSight, setSelectedCategory} from '../store/slices/transformSlice';
import {useTheme} from '../theme/ThemeContext';
import {usePrompts, CategoryWithIcon} from '../hooks/usePrompts';
import {triggerHaptic} from '../utils/haptics';

// Featured category IDs to show initially
const FEATURED_CATEGORY_IDS = ['all', 'sights', 'celebrity', 'cartoon', 'effects', 'eras', 'art'];

// Helper to check if icon is a URL
const isIconUrl = (icon: string): boolean => {
  if (!icon) return false;
  return icon.startsWith('http://') || icon.startsWith('https://');
};

// Get default emoji for category
const getCategoryEmoji = (categoryId: string): string => {
  const emojiMap: Record<string, string> = {
    'all': '✨',
    'sights': '🏛️',
    'celebrity': '⭐',
    'cartoon': '🎭',
    'effects': '✨',
    'games': '🎮',
    'eras': '⏰',
    'seasons': '🌸',
    'art': '🖼️',
    'fantasy': '🧙',
    'mountain': '🏔️',
    'birthday': '🎂',
    'cars': '🚗',
    'movies': '🎬',
    'professional': '💼',
  };
  return emojiMap[categoryId] || '✨';
};

// Number of sights to show initially
const INITIAL_SIGHTS_COUNT = 6;

const SightsBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const {colors} = useTheme();
  const {width, height} = useWindowDimensions();
  const selectedSight = useAppSelector(state => state.transform.selectedSight);
  const pinnedSightIds = useAppSelector(state => state.transform.pinnedSightIds);
  const selectedCategory = useAppSelector(state => state.transform.selectedCategory);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCategory, setModalCategory] = useState<SightCategory | 'all'>('all');
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalSight, setPinModalSight] = useState<Sight | null>(null);

  // Fetch prompts from API (with fallback to local sights)
  const {sights: SIGHTS, categories: CATEGORIES, isLoading} = usePrompts(true);

  // Responsive sizing for iPad and small phones
  const isTablet = width >= 768;
  const isSmallPhone = height < 700; // iPhone SE, iPhone 8, etc.
  const itemWidth = isTablet ? 120 : isSmallPhone ? 68 : 84;
  const thumbnailSize = isTablet ? 84 : isSmallPhone ? 48 : 60;
  const fontSize = isTablet ? 14 : isSmallPhone ? 10 : 12;
  const titleFontSize = isTablet ? 24 : isSmallPhone ? 16 : 20;

  // Filter and sort sights: filter by category, then pinned first, then sights category first when "all"
  const filteredAndSortedSights = useMemo(() => {
    // First filter by category
    const filtered = selectedCategory === 'all'
      ? SIGHTS
      : SIGHTS.filter(sight => sight.category === selectedCategory);

    // Then sort: pinned first
    const pinned = filtered.filter(sight => pinnedSightIds.includes(sight.id));
    const unpinned = filtered.filter(sight => !pinnedSightIds.includes(sight.id));

    // When "all" is selected, show sights category first among unpinned
    if (selectedCategory === 'all') {
      const sightsCategory = unpinned.filter(sight => sight.category === 'sights');
      const otherCategories = unpinned.filter(sight => sight.category !== 'sights');
      return [...pinned, ...sightsCategory, ...otherCategories];
    }

    return [...pinned, ...unpinned];
  }, [pinnedSightIds, selectedCategory, SIGHTS]);

  // Sights to display (limited)
  const displayedSights = useMemo(() => {
    return filteredAndSortedSights.slice(0, INITIAL_SIGHTS_COUNT);
  }, [filteredAndSortedSights]);

  const hiddenSightsCount = filteredAndSortedSights.length - INITIAL_SIGHTS_COUNT;

  // Modal sights - filtered by modal category, sights first when "all"
  const modalSights = useMemo(() => {
    const filtered = modalCategory === 'all'
      ? SIGHTS
      : SIGHTS.filter(sight => sight.category === modalCategory);
    const pinned = filtered.filter(sight => pinnedSightIds.includes(sight.id));
    const unpinned = filtered.filter(sight => !pinnedSightIds.includes(sight.id));

    // When "all" is selected, show sights category first among unpinned
    if (modalCategory === 'all') {
      const sightsCategory = unpinned.filter(sight => sight.category === 'sights');
      const otherCategories = unpinned.filter(sight => sight.category !== 'sights');
      return [...pinned, ...sightsCategory, ...otherCategories];
    }

    return [...pinned, ...unpinned];
  }, [modalCategory, pinnedSightIds, SIGHTS]);

  const handleSightPress = (sight: Sight) => {
    dispatch(setSelectedSight(sight));
  };

  const handleLongPress = (sight: Sight) => {
    triggerHaptic();
    setPinModalSight(sight);
    setPinModalVisible(true);
  };

  const handlePinConfirm = () => {
    if (pinModalSight) {
      dispatch(togglePinSight(pinModalSight.id));
    }
    setPinModalVisible(false);
    setPinModalSight(null);
  };

  const handlePinCancel = () => {
    setPinModalVisible(false);
    setPinModalSight(null);
  };

  const handlePinPress = (sight: Sight) => {
    dispatch(togglePinSight(sight.id));
  };

  const handleCategoryPress = (categoryId: SightCategory | 'all') => {
    dispatch(setSelectedCategory(categoryId));
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background, paddingVertical: isSmallPhone ? 8 : 16}]}>
      <View style={[styles.titleContainer, {marginBottom: isSmallPhone ? 6 : 12}]}>
        <Text style={[styles.title, {color: colors.textPrimary, fontSize: titleFontSize}]}>
          Choose scenario
        </Text>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{marginLeft: 8}} />
        ) : (
          <View style={[styles.badge, {backgroundColor: colors.primary + '20'}]}>
            <Text style={[styles.badgeText, {color: colors.primary}]}>
              {filteredAndSortedSights.length} scenarios
            </Text>
          </View>
        )}
        {pinnedSightIds.length > 0 && (
          <View style={[styles.badge, {backgroundColor: colors.warning + '20'}]}>
            <Text style={[styles.badgeText, {color: colors.warning}]}>
              {pinnedSightIds.length} pinned
            </Text>
          </View>
        )}
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filterContainer, {marginBottom: isSmallPhone ? 8 : 16}]}>
        {(showAllCategories ? CATEGORIES : CATEGORIES.filter(c => FEATURED_CATEGORY_IDS.includes(c.id))).map(category => {
          const isActive = selectedCategory === category.id;
          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.filterButton,
                {
                  backgroundColor: isActive ? colors.primary : colors.backgroundTertiary,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handleCategoryPress(category.id)}
              activeOpacity={0.7}>
              <Text style={styles.filterIcon}>{getCategoryEmoji(category.id)}</Text>
              <Text
                style={[
                  styles.filterText,
                  {color: isActive ? '#fff' : colors.textSecondary},
                ]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* Show More / Show Less Button - only show if there are additional categories */}
        {(showAllCategories || CATEGORIES.length > FEATURED_CATEGORY_IDS.length) && (
          <TouchableOpacity
            style={[
              styles.showMoreButton,
              {
                backgroundColor: colors.backgroundTertiary,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => setShowAllCategories(!showAllCategories)}
            activeOpacity={0.7}>
            <Text style={[styles.showMoreText, {color: colors.primary}]}>
              {showAllCategories ? 'Less' : `+${CATEGORIES.length - FEATURED_CATEGORY_IDS.length}`}
            </Text>
            <Text style={[styles.showMoreIcon, {color: colors.primary}]}>
              {showAllCategories ? '◀' : '▶'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Sights List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, {gap: isTablet ? 16 : 12}]}>
        {/* None option - always first */}
        <TouchableOpacity
          style={[
            styles.sightItem,
            {backgroundColor: colors.cardBackground, width: itemWidth},
            !selectedSight && {
              backgroundColor: colors.primary + '30',
            },
          ]}
          onPress={() => dispatch(setSelectedSight(null))}
          activeOpacity={0.7}>
          <View style={styles.imageWrapper}>
            <View
              style={[
                styles.noneThumbnail,
                {
                  width: thumbnailSize,
                  height: thumbnailSize,
                  backgroundColor: colors.backgroundTertiary,
                },
              ]}>
              <Text style={[styles.noneIcon, {color: colors.textTertiary}]}>✕</Text>
            </View>
            {!selectedSight && (
              <View
                style={[
                  styles.checkmark,
                  {backgroundColor: colors.primary},
                  isTablet && styles.checkmarkTablet,
                ]}>
                <Text style={[styles.checkmarkText, isTablet && {fontSize: 14}]}>✓</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.sightName,
              {color: !selectedSight ? colors.primary : colors.textSecondary, fontSize},
            ]}
            numberOfLines={2}>
            None
          </Text>
        </TouchableOpacity>

        {displayedSights.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
              No items in this category
            </Text>
          </View>
        ) : (
          displayedSights.map(sight => {
            const isSelected = selectedSight?.id === sight.id;
            const isNew = isNewSight(sight);
            const isPinned = pinnedSightIds.includes(sight.id);
            return (
              <TouchableOpacity
                key={sight.id}
                style={[
                  styles.sightItem,
                  {backgroundColor: colors.cardBackground, width: itemWidth},
                  isSelected && {
                    backgroundColor: colors.primary + '30',
                  },
                  isPinned && !isSelected && {
                    borderColor: colors.warning,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => handleSightPress(sight)}
                onLongPress={() => handleLongPress(sight)}
                delayLongPress={500}
                activeOpacity={0.7}>
                <View style={styles.imageWrapper}>
                  <Image
                    source={{uri: sight.thumbnailUrl}}
                    style={[
                      styles.thumbnail,
                      {width: thumbnailSize, height: thumbnailSize},
                    ]}
                    resizeMode="cover"
                  />
                  {!isPinned && (
                    <PriceBadge estimatedCoins={sight.estimatedCoins} isFree={sight.isFree} variant="inline" />
                  )}
                  {isPinned && (
                    <TouchableOpacity
                      style={[styles.pinBadge, {backgroundColor: colors.warning}]}
                      onPress={() => handlePinPress(sight)}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                      <Text style={styles.pinBadgeText}>📌</Text>
                    </TouchableOpacity>
                  )}
                  {isNew && !isPinned && (
                    <View style={[styles.newBadge, isTablet && styles.newBadgeTablet]}>
                      <Text style={[styles.newBadgeText, isTablet && {fontSize: 10}]}>New</Text>
                    </View>
                  )}
                  {isSelected && (
                    <View
                      style={[
                        styles.checkmark,
                        {backgroundColor: colors.primary},
                        isTablet && styles.checkmarkTablet,
                      ]}>
                      <Text style={[styles.checkmarkText, isTablet && {fontSize: 14}]}>✓</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.sightName,
                    {color: isSelected ? colors.primary : colors.textSecondary, fontSize},
                  ]}
                  numberOfLines={2}>
                  {sight.name}
                </Text>
              </TouchableOpacity>
            );
          })
        )}

        {/* Show More Button - Opens Modal */}
        {hiddenSightsCount > 0 && (
          <TouchableOpacity
            style={[
              styles.showMoreSightsButton,
              {
                backgroundColor: colors.backgroundTertiary,
                borderColor: colors.primary,
                width: itemWidth,
                height: thumbnailSize + 40,
              },
            ]}
            onPress={() => {
              setModalCategory(selectedCategory);
              setModalVisible(true);
            }}
            activeOpacity={0.7}>
            <View
              style={[
                styles.showMoreSightsIcon,
                {
                  backgroundColor: colors.primary + '15',
                  width: thumbnailSize * 0.7,
                  height: thumbnailSize * 0.7,
                },
              ]}>
              <Text style={[styles.showMoreSightsIconText, {color: colors.primary}]}>
                ▶
              </Text>
            </View>
            <Text style={[styles.showMoreSightsText, {color: colors.primary, fontSize}]}>
              +{hiddenSightsCount} more
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Destinations Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: colors.cardBackground, height: height * 0.85}]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, {borderBottomColor: colors.border}]}>
              <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
                All Scenarios
              </Text>
              <View style={[styles.modalBadge, {backgroundColor: colors.primary + '20'}]}>
                <Text style={[styles.modalBadgeText, {color: colors.primary}]}>
                  {modalSights.length} scenarios
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseButton, {backgroundColor: colors.backgroundTertiary}]}
                onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalCloseButtonText, {color: colors.textPrimary}]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Category Filter in Modal */}
            <View style={[styles.modalFilterWrapper, {borderBottomColor: colors.border}]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalFilterContainer}>
                {CATEGORIES.map(category => {
                  const isActive = modalCategory === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.modalFilterButton,
                        {
                          backgroundColor: isActive ? colors.primary : colors.backgroundTertiary,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setModalCategory(category.id)}
                      activeOpacity={0.7}>
                      <Text style={styles.modalFilterIcon}>{getCategoryEmoji(category.id)}</Text>
                      <Text
                        style={[
                          styles.modalFilterText,
                          {color: isActive ? '#fff' : colors.textSecondary},
                        ]}>
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Sights Grid */}
            <FlatList
              data={modalSights}
              renderItem={({item: sight}) => {
                const isSelected = selectedSight?.id === sight.id;
                const isNew = isNewSight(sight);
                const isPinned = pinnedSightIds.includes(sight.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalSightItem,
                      {backgroundColor: colors.backgroundTertiary},
                      isSelected && {
                        backgroundColor: colors.primary + '30',
                      },
                      isPinned && !isSelected && {
                        borderColor: colors.warning,
                      },
                    ]}
                    onPress={() => {
                      handleSightPress(sight);
                      setModalVisible(false);
                    }}
                    onLongPress={() => handleLongPress(sight)}
                    delayLongPress={500}
                    activeOpacity={0.7}>
                    <Image
                      source={{uri: sight.thumbnailUrl}}
                      style={styles.modalThumbnail}
                      resizeMode="cover"
                    />
                    {!isPinned && (
                      <PriceBadge estimatedCoins={sight.estimatedCoins} isFree={sight.isFree} variant="modal" />
                    )}
                    {isPinned && (
                      <View style={[styles.modalPinBadge, {backgroundColor: colors.warning}]}>
                        <Text style={styles.modalPinBadgeText}>📌</Text>
                      </View>
                    )}
                    {isNew && !isPinned && (
                      <View style={styles.modalNewBadge}>
                        <Text style={styles.modalNewBadgeText}>New</Text>
                      </View>
                    )}
                    {isSelected && (
                      <View style={[styles.modalCheckmark, {backgroundColor: colors.primary}]}>
                        <Text style={styles.modalCheckmarkText}>✓</Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.modalSightName,
                        {color: isSelected ? colors.primary : colors.textSecondary},
                      ]}
                      numberOfLines={2}>
                      {sight.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={item => item.id}
              numColumns={3}
              contentContainerStyle={styles.modalGridContent}
              columnWrapperStyle={styles.modalGridRow}
              showsVerticalScrollIndicator={false}
            />

            {/* Done Button */}
            <TouchableOpacity
              style={[styles.modalDoneButton, {backgroundColor: colors.primary}]}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}>
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modern Pin/Unpin Modal */}
      <Modal
        visible={pinModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={handlePinCancel}>
        <View style={styles.pinModalOverlay}>
          <View style={[styles.pinModalContent, {backgroundColor: colors.cardBackground}]}>
            {/* Template Preview */}
            {pinModalSight && (
              <>
                <View style={[styles.pinModalImageContainer, {backgroundColor: colors.backgroundTertiary}]}>
                  <Image
                    source={{uri: pinModalSight.thumbnailUrl}}
                    style={styles.pinModalImage}
                    resizeMode="cover"
                  />
                  <View style={[
                    styles.pinModalIconBadge,
                    {backgroundColor: pinnedSightIds.includes(pinModalSight.id) ? colors.warning : colors.primary}
                  ]}>
                    <Text style={styles.pinModalIconText}>
                      {pinnedSightIds.includes(pinModalSight.id) ? '📌' : '📍'}
                    </Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={[styles.pinModalTitle, {color: colors.textPrimary}]}>
                  {pinnedSightIds.includes(pinModalSight.id) ? 'Unpin Template' : 'Pin Template'}
                </Text>

                {/* Template Name */}
                <Text style={[styles.pinModalTemplateName, {color: colors.primary}]}>
                  "{pinModalSight.name}"
                </Text>

                {/* Description */}
                <Text style={[styles.pinModalDescription, {color: colors.textSecondary}]}>
                  {pinnedSightIds.includes(pinModalSight.id)
                    ? 'Remove this template from your pinned favorites?'
                    : 'Pin this template to keep it at the front for quick access.'}
                </Text>

                {/* Buttons */}
                <View style={styles.pinModalButtons}>
                  <TouchableOpacity
                    style={[styles.pinModalCancelButton, {borderColor: colors.border}]}
                    onPress={handlePinCancel}
                    activeOpacity={0.7}>
                    <Text style={[styles.pinModalCancelText, {color: colors.textSecondary}]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.pinModalConfirmButton,
                      {backgroundColor: pinnedSightIds.includes(pinModalSight.id) ? colors.error : colors.primary}
                    ]}
                    onPress={handlePinConfirm}
                    activeOpacity={0.8}>
                    <Text style={styles.pinModalConfirmText}>
                      {pinnedSightIds.includes(pinModalSight.id) ? 'Unpin' : 'Pin'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 6,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
    flexWrap: 'wrap',
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterIcon: {
    fontSize: 14,
  },
  filterIconImage: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  sightItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageWrapper: {
    position: 'relative',
  },
  thumbnail: {
    borderRadius: 16,
  },
  noneThumbnail: {
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noneIcon: {
    fontSize: 28,
    fontWeight: '300',
  },
  pinBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pinBadgeText: {
    fontSize: 12,
  },
  newBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#EF4444',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  newBadgeTablet: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  checkmarkTablet: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sightName: {
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 4,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  showMoreIcon: {
    fontSize: 10,
    fontWeight: '700',
  },
  showMoreSightsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  showMoreSightsIcon: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  showMoreSightsIconText: {
    fontSize: 20,
    fontWeight: '600',
  },
  showMoreSightsText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  // Modal styles
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
  modalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalCloseButton: {
    position: 'absolute',
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalFilterWrapper: {
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  modalFilterContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  modalFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  modalFilterIcon: {
    fontSize: 16,
  },
  modalFilterIconImage: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  modalFilterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalGridContent: {
    padding: 16,
    paddingBottom: 100,
  },
  modalGridRow: {
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  modalSightItem: {
    width: '31%',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
  },
  modalPinBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPinBadgeText: {
    fontSize: 10,
  },
  modalNewBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalNewBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalCheckmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCheckmarkText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalSightName: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  modalDoneButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Pin Modal styles
  pinModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pinModalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  pinModalImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  pinModalImage: {
    width: '100%',
    height: '100%',
  },
  pinModalIconBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  pinModalIconText: {
    fontSize: 16,
  },
  pinModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  pinModalTemplateName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  pinModalDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  pinModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  pinModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pinModalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinModalConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default SightsBar;
