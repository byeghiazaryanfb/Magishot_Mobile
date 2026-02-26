import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  Pressable,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import {useCharacters} from '../hooks/useCharacters';
import {
  CharacterItem,
  CharacterCategory,
  getFullCharacterImageUrl,
} from '../services/charactersApi';
import PriceBadge from './PriceBadge';

interface CharacterPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCharacter: (character: CharacterItem) => void;
}

const CharacterPickerModal: React.FC<CharacterPickerModalProps> = ({
  visible,
  onClose,
  onSelectCharacter,
}) => {
  const {colors} = useTheme();
  const {width, height} = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Fetch characters from API
  const {
    categories,
    allCharacters,
    isLoading,
    error,
    getCharactersByCategory,
    getCharactersBySubcategory,
    searchCharacters,
  } = useCharacters();

  const numColumns = width >= 768 ? 4 : 3;

  // Get current characters to display
  const displayedCharacters = useMemo(() => {
    if (searchQuery.trim()) {
      return searchCharacters(searchQuery);
    }
    if (selectedSubcategory && selectedCategory) {
      return getCharactersBySubcategory(selectedCategory, selectedSubcategory);
    }
    if (selectedCategory) {
      return getCharactersByCategory(selectedCategory);
    }
    return allCharacters;
  }, [searchQuery, selectedCategory, selectedSubcategory, allCharacters, searchCharacters, getCharactersByCategory, getCharactersBySubcategory]);

  // Get subcategories for selected category
  const currentSubcategories = useMemo(() => {
    if (!selectedCategory) return [];
    const mainCategory = categories.find(c => c.categoryId === selectedCategory);
    return mainCategory?.children || [];
  }, [selectedCategory, categories]);

  const handleCategoryPress = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
    } else {
      setSelectedCategory(categoryId);
      setSelectedSubcategory(null);
    }
    setSearchQuery('');
  };

  const handleSubcategoryPress = (subcategoryId: string) => {
    if (selectedSubcategory === subcategoryId) {
      setSelectedSubcategory(null);
    } else {
      setSelectedSubcategory(subcategoryId);
    }
  };

  const handleSelectCharacter = (character: CharacterItem) => {
    onSelectCharacter(character);
    handleClose();
  };

  const handleClose = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSearchQuery('');
    onClose();
  };

  const handleImageError = (id: string) => {
    setFailedImages(prev => ({...prev, [id]: true}));
  };

  const renderCharacterItem = ({item}: {item: CharacterItem}) => {
    const hasFailed = failedImages[item.id];
    const imageUrl = getFullCharacterImageUrl(item.imageUrl);

    return (
      <TouchableOpacity
        style={[
          styles.characterItem,
          {
            backgroundColor: colors.backgroundTertiary,
            width: `${100 / numColumns - 2}%`,
          },
        ]}
        onPress={() => handleSelectCharacter(item)}
        activeOpacity={0.7}>
        <View style={styles.imageContainer}>
          {!hasFailed && imageUrl ? (
            <Image
              source={{uri: imageUrl}}
              style={styles.characterImage}
              resizeMode="cover"
              onError={() => handleImageError(item.id)}
            />
          ) : (
            <View style={[styles.placeholderImage, {backgroundColor: colors.border}]}>
              <Text style={styles.placeholderEmoji}>👤</Text>
            </View>
          )}
          <PriceBadge estimatedCoins={item.estimatedCoins} isFree={item.isFree} variant="modal" />
        </View>
        <Text
          style={[styles.characterName, {color: colors.textPrimary}]}
          numberOfLines={2}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBottomCategoryTabs = () => (
    <View style={[styles.bottomCategorySection, {backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border}]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bottomCategoryTabs}>
        {/* All option */}
        <TouchableOpacity
          style={[
            styles.bottomCategoryTab,
            !selectedCategory
              ? {backgroundColor: colors.primary}
              : {backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.primary},
          ]}
          onPress={() => {
            setSelectedCategory(null);
            setSelectedSubcategory(null);
          }}
          activeOpacity={0.7}>
          <Text style={[styles.bottomCategoryTabIcon, {color: !selectedCategory ? '#fff' : colors.primary}]}>✨</Text>
          <Text
            style={[styles.bottomCategoryTabLabel, {color: !selectedCategory ? '#fff' : colors.primary}]}
            numberOfLines={1}>
            All
          </Text>
        </TouchableOpacity>
        {categories.map((category) => {
          const isSelected = selectedCategory === category.categoryId;
          return (
            <TouchableOpacity
              key={category.categoryId}
              style={[
                styles.bottomCategoryTab,
                isSelected
                  ? {backgroundColor: colors.primary}
                  : {backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.primary},
              ]}
              onPress={() => handleCategoryPress(category.categoryId)}
              activeOpacity={0.7}>
              <Text style={[styles.bottomCategoryTabIcon, {color: isSelected ? '#fff' : colors.primary}]}>{category.icon}</Text>
              <Text
                style={[styles.bottomCategoryTabLabel, {color: isSelected ? '#fff' : colors.primary}]}
                numberOfLines={1}>
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderSubcategoryTabs = () => {
    if (!selectedCategory || currentSubcategories.length === 0) return null;

    return (
      <View style={styles.subcategoryContainer}>
        <FlatList
          horizontal
          data={currentSubcategories}
          keyExtractor={(item) => item.categoryId}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subcategoryList}
          renderItem={({item}) => {
            const isSelected = selectedSubcategory === item.categoryId;
            return (
              <TouchableOpacity
                style={[
                  styles.subcategoryChip,
                  {
                    backgroundColor: isSelected
                      ? colors.primary + '30'
                      : colors.backgroundTertiary,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleSubcategoryPress(item.categoryId)}
                activeOpacity={0.7}>
                <Text style={styles.subcategoryIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.subcategoryLabel,
                    {color: isSelected ? colors.primary : colors.textSecondary},
                  ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            {backgroundColor: colors.cardBackground, height: height * 0.85},
          ]}>
          {/* Header */}
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              Choose a Character
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
              onPress={handleClose}>
              <Text style={[styles.closeButtonText, {color: colors.textPrimary}]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View
              style={[
                styles.searchInputContainer,
                {backgroundColor: colors.backgroundTertiary, borderColor: colors.border},
              ]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.searchInput, {color: colors.textPrimary}]}
                placeholder="Search characters..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Text style={[styles.clearSearch, {color: colors.textTertiary}]}>✕</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Loading State */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, {color: colors.textTertiary}]}>
                Loading characters...
              </Text>
            </View>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={[styles.errorText, {color: colors.error}]}>{error}</Text>
            </View>
          )}

          {/* Content */}
          {!isLoading && !error && (
            <>
              {/* Subcategory Chips (shown when category is selected) */}
              {!searchQuery && renderSubcategoryTabs()}

              {/* Results count */}
              <View style={styles.resultsHeader}>
                <Text style={[styles.resultsCount, {color: colors.textTertiary}]}>
                  {displayedCharacters.length} character{displayedCharacters.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Characters Grid */}
              <FlatList
                data={displayedCharacters}
                renderItem={renderCharacterItem}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                key={numColumns}
                contentContainerStyle={styles.gridContent}
                columnWrapperStyle={styles.gridRow}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>🔍</Text>
                    <Text style={[styles.emptyText, {color: colors.textTertiary}]}>
                      No characters found
                    </Text>
                  </View>
                }
              />

              {/* Category Tabs at bottom (hidden when searching) */}
              {!searchQuery && categories.length > 0 && renderBottomCategoryTabs()}
            </>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  clearSearch: {
    fontSize: 16,
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bottomCategorySection: {
    paddingTop: 12,
    borderTopWidth: 1,
    paddingBottom: 50,
  },
  bottomCategoryTabs: {
    paddingHorizontal: 16,
    gap: 8,
  },
  bottomCategoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  bottomCategoryTabIcon: {
    fontSize: 14,
  },
  bottomCategoryTabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  subcategoryContainer: {
    marginBottom: 8,
  },
  subcategoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  subcategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  subcategoryIcon: {
    fontSize: 14,
  },
  subcategoryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  characterItem: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  imageContainer: {
    aspectRatio: 1,
    width: '100%',
    position: 'relative',
  },
  characterImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 40,
    opacity: 0.5,
  },
  characterName: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});

export default CharacterPickerModal;
