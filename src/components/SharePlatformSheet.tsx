import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import type {SharePlatform} from '../utils/shareToSocial';

interface SharePlatformSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (platform: SharePlatform) => void;
  isProcessing?: boolean;
  mediaType?: 'image' | 'video';
}

const SharePlatformSheet: React.FC<SharePlatformSheetProps> = ({
  visible,
  onClose,
  onSelect,
  isProcessing = false,
  mediaType = 'image',
}) => {
  const {colors} = useTheme();

  const platforms: {
    key: SharePlatform;
    label: string;
    icon: string;
    color: string;
    description: string;
  }[] = [
    {
      key: 'instagram',
      label: 'Instagram',
      icon: 'logo-instagram',
      color: '#E1306C',
      description: mediaType === 'video' ? 'Share as Reel' : 'Share as Reel / Story',
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      icon: 'logo-tiktok',
      color: '#000000',
      description: mediaType === 'video' ? 'Save & open TikTok' : 'Save to gallery & open TikTok',
    },
    {
      key: 'generic',
      label: 'More...',
      icon: 'share-social-outline',
      color: colors.textSecondary,
      description: 'Share via other apps',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={isProcessing ? undefined : onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                {backgroundColor: colors.backgroundSecondary},
              ]}>
              <View style={styles.handle} />

              <Text style={[styles.title, {color: colors.textPrimary}]}>
                Share to
              </Text>

              {isProcessing && (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[
                      styles.processingText,
                      {color: colors.textSecondary},
                    ]}>
                    Preparing {mediaType}...
                  </Text>
                </View>
              )}

              <View style={styles.platformList}>
                {platforms.map(platform => (
                  <TouchableOpacity
                    key={platform.key}
                    style={[
                      styles.platformRow,
                      {backgroundColor: colors.backgroundTertiary},
                    ]}
                    onPress={() => onSelect(platform.key)}
                    activeOpacity={0.7}
                    disabled={isProcessing}>
                    <View
                      style={[
                        styles.platformIcon,
                        {backgroundColor: platform.color + '20'},
                      ]}>
                      <Ionicons
                        name={platform.icon}
                        size={24}
                        color={platform.color}
                      />
                    </View>
                    <View style={styles.platformInfo}>
                      <Text
                        style={[
                          styles.platformLabel,
                          {color: colors.textPrimary},
                        ]}>
                        {platform.label}
                      </Text>
                      <Text
                        style={[
                          styles.platformDesc,
                          {color: colors.textTertiary},
                        ]}>
                        {platform.description}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  {backgroundColor: colors.backgroundTertiary},
                ]}
                onPress={onClose}
                activeOpacity={0.7}
                disabled={isProcessing}>
                <Text
                  style={[styles.cancelText, {color: colors.textSecondary}]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  processingText: {
    fontSize: 14,
  },
  platformList: {
    gap: 10,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 14,
  },
  platformIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformInfo: {
    flex: 1,
  },
  platformLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  platformDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SharePlatformSheet;
