import React, {useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Animated,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FastImage from 'react-native-fast-image';
import {Swipeable} from 'react-native-gesture-handler';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  toggleNotificationReadStatus,
  deleteNotification,
  deleteAllNotifications,
} from '../store/slices/notificationSlice';
import {useTheme} from '../theme/ThemeContext';
import {getTimeAgo} from '../utils/timeAgo';
import type {Notification} from '../types/notification';
import type {RootStackParamList} from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const NotificationsScreen: React.FC = () => {
  const {colors} = useTheme();
  const {width} = useWindowDimensions();
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  const {notifications, unreadCount, hasMore, nextCursor, isLoading, isMarkingAllRead, isDeletingAll} =
    useAppSelector(state => state.notification);

  const isTablet = width >= 768;
  const headerPadding = isTablet ? 32 : 20;

  useEffect(() => {
    dispatch(fetchNotifications({}));
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchNotifications({}));
  }, [dispatch]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading && nextCursor) {
      dispatch(fetchNotifications({cursor: nextCursor}));
    }
  }, [hasMore, isLoading, nextCursor, dispatch]);

  const handleMarkAllRead = useCallback(() => {
    if (unreadCount > 0 && !isMarkingAllRead) {
      dispatch(markAllNotificationsRead());
    }
  }, [unreadCount, isMarkingAllRead, dispatch]);

  const handleDeleteAll = useCallback(() => {
    if (notifications.length > 0 && !isDeletingAll) {
      dispatch(deleteAllNotifications());
    }
  }, [notifications.length, isDeletingAll, dispatch]);

  const handleNotificationPress = useCallback(
    (item: Notification) => {
      if (!item.isRead) {
        dispatch(markNotificationRead(item.id));
      }
      const isComicNotif = item.resourceType === 'comic' || /comic/i.test(item.title);
      const isVideoNotif = item.resourceType === 'video' || /video/i.test(item.title);
      const initialTab = isComicNotif ? 'comics' : isVideoNotif ? 'videos' : 'photos';
      navigation.push('MyCreations', {initialTab});
    },
    [dispatch, navigation],
  );

  const handleDelete = useCallback(
    (id: string) => {
      dispatch(deleteNotification(id));
    },
    [dispatch],
  );

  const handleToggleRead = useCallback(
    (id: string, currentlyRead: boolean) => {
      swipeableRefs.current[id]?.close();
      dispatch(toggleNotificationReadStatus({id, isRead: !currentlyRead}));
    },
    [dispatch],
  );

  const renderRightActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
      item: Notification,
    ) => {
      const scale = dragX.interpolate({
        inputRange: [-160, 0],
        outputRange: [1, 0.5],
        extrapolate: 'clamp',
      });

      return (
        <View style={styles.swipeActionsContainer}>
          <TouchableOpacity
            style={[styles.swipeAction, styles.readToggleAction]}
            onPress={() => handleToggleRead(item.id, item.isRead)}
            activeOpacity={0.8}>
            <Animated.View style={{transform: [{scale}], alignItems: 'center'}}>
              <Ionicons
                name={item.isRead ? 'mail-unread-outline' : 'mail-open-outline'}
                size={22}
                color="#fff"
              />
              <Text style={styles.swipeActionText}>
                {item.isRead ? 'Unread' : 'Read'}
              </Text>
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeAction, styles.deleteAction]}
            onPress={() => {
              swipeableRefs.current[item.id]?.close();
              handleDelete(item.id);
            }}
            activeOpacity={0.8}>
            <Animated.View style={{transform: [{scale}], alignItems: 'center'}}>
              <Ionicons name="trash" size={22} color="#fff" />
              <Text style={styles.swipeActionText}>Delete</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      );
    },
    [handleDelete, handleToggleRead],
  );

  const renderItem = useCallback(
    ({item}: {item: Notification}) => {
      const isFailed = item.status === 'failed' || /fail/i.test(item.title);
      const statusColor = isFailed ? '#FF4757' : '#2ED573';
      const isComic =
        item.resourceType === 'comic' ||
        /comic/i.test(item.title);
      const isVideo =
        !isComic && (item.resourceType === 'video' ||
        /video/i.test(item.title));
      const unreadBg = isFailed
        ? 'rgba(255, 71, 87, 0.08)'
        : 'rgba(46, 213, 115, 0.08)';

      return (
        <Swipeable
          ref={ref => {
            swipeableRefs.current[item.id] = ref;
          }}
          renderRightActions={(progress, dragX) =>
            renderRightActions(progress, dragX, item)
          }
          rightThreshold={40}
          overshootRight={false}>
          <TouchableOpacity
            style={[
              styles.row,
              {
                backgroundColor: item.isRead
                  ? colors.backgroundSecondary
                  : unreadBg,
                borderBottomColor: colors.border,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => handleNotificationPress(item)}>
            {item.thumbnailUrl ? (
              <View>
                <FastImage
                  source={{uri: item.thumbnailUrl}}
                  style={styles.thumbnail}
                  resizeMode={FastImage.resizeMode.cover}
                />
                <View
                  style={[
                    styles.statusIndicator,
                    {backgroundColor: statusColor},
                  ]}
                />
              </View>
            ) : (
              <View
                style={[
                  styles.thumbnail,
                  styles.iconFallback,
                  {backgroundColor: isFailed ? 'rgba(255, 71, 87, 0.15)' : 'rgba(46, 213, 115, 0.15)'},
                ]}>
                <Ionicons
                  name={isComic ? 'book' : isVideo ? 'videocam' : 'image'}
                  size={22}
                  color={statusColor}
                />
              </View>
            )}

            <View style={styles.textContainer}>
              <Text
                style={[
                  styles.title,
                  {color: isFailed ? '#FF4757' : colors.textPrimary},
                  !item.isRead && styles.titleUnread,
                ]}
                numberOfLines={1}>
                {item.title}
              </Text>
              <Text
                style={[styles.message, {color: colors.textSecondary}]}
                numberOfLines={2}>
                {item.message}
              </Text>
              <Text style={[styles.time, {color: colors.textTertiary}]}>
                {getTimeAgo(item.createdAt)}
              </Text>
            </View>

            {!item.isRead && (
              <View style={[styles.unreadDot, {backgroundColor: statusColor}]} />
            )}
          </TouchableOpacity>
        </Swipeable>
      );
    },
    [colors, handleNotificationPress, renderRightActions],
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="notifications-off-outline"
          size={64}
          color={colors.textTertiary}
        />
        <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
          No notifications yet
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isLoading || notifications.length === 0) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

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
        <TouchableOpacity
          style={[styles.backButton, {backgroundColor: colors.backgroundTertiary}]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
          Notifications
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={unreadCount === 0 || isMarkingAllRead}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.headerActionText,
                {
                  color:
                    unreadCount > 0 && !isMarkingAllRead
                      ? colors.primary
                      : colors.textTertiary,
                },
              ]}>
              Read all
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteAll}
            disabled={notifications.length === 0 || isDeletingAll}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.headerActionText,
                {
                  color:
                    notifications.length > 0 && !isDeletingAll
                      ? '#FF4757'
                      : colors.textTertiary,
                },
              ]}>
              Delete all
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={notifications}
        extraData={notifications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && notifications.length === 0}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
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
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 14,
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  iconFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  titleUnread: {
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  time: {
    fontSize: 11,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF1B6D',
  },
  swipeActionsContainer: {
    flexDirection: 'row',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  readToggleAction: {
    backgroundColor: '#3498db',
  },
  deleteAction: {
    backgroundColor: '#FF4757',
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default NotificationsScreen;
