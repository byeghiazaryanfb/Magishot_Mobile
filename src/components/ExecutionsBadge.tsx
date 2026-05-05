import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAppSelector} from '../store/hooks';
import {useTheme} from '../theme/ThemeContext';
import type {ImageJob} from '../store/slices/imageNotificationSlice';
import type {VideoJob} from '../store/slices/videoNotificationSlice';
import type {ComicJob} from '../store/slices/comicNotificationSlice';

type ExecutionRow = {
  id: string;
  kind: 'image' | 'video' | 'comic';
  status: 'pending' | 'processing';
  createdAt: string;
};

interface ExecutionsBadgeProps {
  size: number;
  iconSize: number;
}

const KIND_LABEL: Record<ExecutionRow['kind'], string> = {
  image: 'Image',
  video: 'Video',
  comic: 'Comic',
};

const KIND_ICON: Record<ExecutionRow['kind'], string> = {
  image: 'image',
  video: 'videocam',
  comic: 'book',
};

const ExecutionsBadge: React.FC<ExecutionsBadgeProps> = ({size, iconSize}) => {
  const {colors} = useTheme();
  const [open, setOpen] = useState(false);

  const imageJobs = useAppSelector(state => state.imageNotification.jobs);
  const videoJobs = useAppSelector(state => state.videoNotification.jobs);
  const comicJobs = useAppSelector(state => state.comicNotification.jobs);

  const executions: ExecutionRow[] = useMemo(() => {
    const rows: ExecutionRow[] = [];
    Object.values(imageJobs as Record<string, ImageJob>).forEach(j => {
      if (j.status === 'pending' || j.status === 'processing') {
        rows.push({
          id: `image-${j.photoId}`,
          kind: 'image',
          status: j.status,
          createdAt: j.createdAt,
        });
      }
    });
    Object.values(videoJobs as Record<string, VideoJob>).forEach(j => {
      if (j.status === 'pending' || j.status === 'processing') {
        rows.push({
          id: `video-${j.videoId}`,
          kind: 'video',
          status: j.status,
          createdAt: j.createdAt,
        });
      }
    });
    Object.values(comicJobs as Record<string, ComicJob>).forEach(j => {
      if (j.status === 'pending' || j.status === 'processing') {
        rows.push({
          id: `comic-${j.comicId}`,
          kind: 'comic',
          status: j.status,
          createdAt: j.createdAt,
        });
      }
    });
    return rows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [imageJobs, videoJobs, comicJobs]);

  const count = executions.length;

  // Auto-close when the list becomes empty
  React.useEffect(() => {
    if (count === 0 && open) {
      setOpen(false);
    }
  }, [count, open]);

  if (count === 0) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: colors.backgroundTertiary,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityLabel={`${count} ongoing executions`}>
        <ActivityIndicator size="small" color={colors.primary} />
        <View style={[styles.badge, {backgroundColor: colors.primary}]}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.dropdown,
              {
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.border,
                shadowColor: '#000',
              },
            ]}>
            <View style={[styles.header, {borderBottomColor: colors.borderLight}]}>
              <View style={styles.headerLeft}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
                  In progress
                </Text>
                <View style={[styles.headerCount, {backgroundColor: colors.primary + '20'}]}>
                  <Text style={[styles.headerCountText, {color: colors.primary}]}>
                    {count}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {executions.map(row => (
                <View
                  key={row.id}
                  style={[styles.row, {borderBottomColor: colors.borderLight}]}>
                  <View
                    style={[
                      styles.iconBubble,
                      {backgroundColor: colors.primary + '15'},
                    ]}>
                    <Ionicons
                      name={KIND_ICON[row.kind]}
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text
                      style={[styles.rowTitle, {color: colors.textPrimary}]}
                      numberOfLines={1}>
                      {KIND_LABEL[row.kind]} generation
                    </Text>
                    <Text
                      style={[styles.rowSubtitle, {color: colors.textSecondary}]}
                      numberOfLines={1}>
                      {row.status === 'pending' ? 'Queued...' : 'Processing...'}
                    </Text>
                  </View>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingTop: 100,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  dropdown: {
    width: 300,
    maxHeight: 380,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerCount: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});

export default ExecutionsBadge;
