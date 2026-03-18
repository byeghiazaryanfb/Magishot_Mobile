import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {useNavigation, DrawerActions} from '@react-navigation/native';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {config} from '../utils/config';
import {RootStackParamList} from '../navigation/RootNavigator';
import GifPlayer from '../components/GifPlayer';
import Logo from '../components/Logo';
import PriceBadge from '../components/PriceBadge';

interface VideoTemplate {
  id: string;
  displayName: string;
  gifUrl: string;
  description: string;
  minImages: number;
  maxImages: number;
  requiredPhotoCount?: number;
  templateType: number; // 1 = image, 2 = video
  categoryId?: string | null;
  categoryName?: string | null;
  estimatedCoins?: number;
  isFree?: boolean;
  videoAnimationEnabled?: boolean;
  freeCredits?: number;
  freeUsageRemaining?: number | null;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const VideoScreen: React.FC = () => {
  const {colors} = useTheme();
  const {width} = useWindowDimensions();
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const {unopenedPhotosCount, unplayedVideosCount} = useAppSelector(state => state.app);
  const totalUnreadCount = unopenedPhotosCount + unplayedVideosCount;
  const notificationUnreadCount = useAppSelector(state => state.notification.unreadCount);
  const accessToken = useAppSelector(state => state.auth.accessToken);
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique categories from templates
  const categories = useMemo(() => {
    const categoryMap = new Map<string, string>();
    templates.forEach(t => {
      if (t.categoryId && t.categoryName) {
        categoryMap.set(t.categoryId, t.categoryName);
      }
    });
    return Array.from(categoryMap, ([id, name]) => ({id, name}));
  }, [templates]);

  // Filter templates by selected category and search query
  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (selectedCategoryId) {
      result = result.filter(t => t.categoryId === selectedCategoryId);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(t =>
        t.displayName.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)) ||
        (t.categoryName && t.categoryName.toLowerCase().includes(query))
      );
    }
    return result;
  }, [templates, selectedCategoryId, searchQuery]);
  const isTablet = width >= 768;
  const numColumns = isTablet ? 3 : 2;
  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const themeToggleSize = isTablet ? 52 : 44;
  const themeIconSize = isTablet ? 26 : 22;
  const headerPadding = isTablet ? 32 : 20;

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const fetchTemplates = async () => {
    try {
      setError(null);
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch(`${config.apiBaseUrl}/api/videotemplates`, {headers});
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [accessToken]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTemplates();
  };

  const handleTemplatePress = (template: VideoTemplate) => {
    if (template.templateType === 1) {
      // Image template - pass filtered image templates for swipe navigation
      const imageTemplates = filteredTemplates.filter(t => t.templateType === 1);
      const currentIndex = imageTemplates.findIndex(t => t.id === template.id);
      navigation.navigate('ImageTemplateDetail', {
        template,
        templates: imageTemplates,
        currentIndex,
      });
    } else {
      // Video template (templateType === 2)
      navigation.navigate('TemplateDetail', {template});
    }
  };

  const renderTemplate = ({item}: {item: VideoTemplate}) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          width: cardWidth,
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
        },
      ]}
      onPress={() => handleTemplatePress(item)}
      activeOpacity={0.8}>
      <View style={styles.gifContainer}>
        <GifPlayer uri={item.gifUrl} style={styles.gif} resizeMode="cover" />
        <PriceBadge estimatedCoins={item.estimatedCoins} isFree={item.isFree} variant="modal" />
        {item.freeCredits != null && item.freeCredits > 0 && item.freeUsageRemaining != null && item.freeUsageRemaining > 0 && (
          <View style={styles.freeUsageBadge}>
            <Text style={styles.freeUsageText}>{item.freeUsageRemaining} free</Text>
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text
          style={[styles.templateName, {color: colors.textPrimary}]}
          numberOfLines={1}>
          {item.displayName}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.backgroundSecondary,
              paddingHorizontal: headerPadding,
            },
          ]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.menuButton} onPress={openDrawer} activeOpacity={0.7}>
              <Ionicons name="menu" size={themeIconSize} color={colors.textPrimary} />
            </TouchableOpacity>
            <Logo size={isTablet ? 140 : 100} />
          </View>
        </View>
        <View style={styles.listContent}>
          {[0, 1, 2].map(rowIdx => (
            <View key={rowIdx} style={styles.row}>
              {Array.from({length: numColumns}).map((_, colIdx) => (
                <View
                  key={colIdx}
                  style={[
                    styles.card,
                    {
                      width: cardWidth,
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.border,
                    },
                  ]}>
                  <View style={[styles.gifContainer, {justifyContent: 'center', alignItems: 'center'}]}>
                    <ActivityIndicator size="small" color={colors.primary} style={{opacity: 0.4}} />
                  </View>
                  <View style={styles.cardContent}>
                    <View style={{width: '60%', height: 12, borderRadius: 6, backgroundColor: colors.backgroundTertiary}} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, {backgroundColor: colors.background}]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={[styles.errorText, {color: colors.textPrimary}]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, {backgroundColor: colors.primary}]}
          onPress={() => {
            setLoading(true);
            fetchTemplates();
          }}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
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
            onPress={() => navigation.navigate('Notifications' as any)}
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
            onPress={() => navigation.navigate('MyCreations' as any)}
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

      {/* Search Box */}
      <View style={[styles.searchContainer, {backgroundColor: colors.background}]}>
        <View style={[styles.searchBox, {backgroundColor: colors.backgroundTertiary, borderColor: colors.border}]}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, {color: colors.textPrimary}]}
            placeholder="Search templates..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredTemplates}
        renderItem={renderTemplate}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        key={numColumns}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
              No templates available
            </Text>
          </View>
        }
      />

      {/* Category Filter - Bottom */}
      {categories.length > 0 && (
        <View style={[styles.categoryBar, {backgroundColor: colors.backgroundSecondary}]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                {
                  backgroundColor: !selectedCategoryId ? colors.primary : colors.backgroundTertiary,
                  borderColor: !selectedCategoryId ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedCategoryId(null)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.categoryChipText,
                  {color: !selectedCategoryId ? '#fff' : colors.textSecondary},
                ]}>
                All
              </Text>
            </TouchableOpacity>
            {categories.map(cat => {
              const isActive = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isActive ? colors.primary : colors.backgroundTertiary,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.categoryChipText,
                      {color: isActive ? '#fff' : colors.textSecondary},
                    ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    paddingVertical: 0,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellDot: {
    position: 'absolute',
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
  categoryBar: {
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  categoryScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 8,
  },
  row: {
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gifContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#000',
  },
  freeUsageBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 10,
  },
  freeUsageText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    padding: 8,
  },
  templateName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  templateDescription: {
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 4,
  },
  imageCountBadge: {
    alignSelf: 'flex-start',
  },
  imageCountText: {
    fontSize: 9,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
  },
});

export default VideoScreen;
