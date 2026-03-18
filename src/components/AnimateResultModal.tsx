import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import Video, {VideoRef} from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import RNFetchBlob from 'rn-fetch-blob';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import {useTheme} from '../theme/ThemeContext';
import CustomDialog from './CustomDialog';
import {useAppSelector} from '../store/hooks';
import {requestPhotoLibraryPermission} from '../utils/permissions';

interface AnimateResultModalProps {
  visible: boolean;
  onClose: () => void;
  videoResult: {
    videoUrl: string;
    videoId?: string;
    fileName: string;
    mimeType: string;
    durationSeconds: number;
  } | null;
}

const AnimateResultModal: React.FC<AnimateResultModalProps> = ({
  visible,
  onClose,
  videoResult,
}) => {
  const accessToken = useAppSelector(state => state.auth.accessToken);
  const {colors, isDark} = useTheme();
  const videoRef = useRef<VideoRef>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dialog, setDialog] = useState<{
    visible: boolean;
    icon: string;
    iconColor: string;
    title: string;
    message: string;
    type: 'success' | 'error' | 'permission';
  }>({visible: false, icon: '', iconColor: '', title: '', message: '', type: 'success'});

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleVideoLoad = (data: any) => {
    setIsLoading(false);
    setDuration(data.duration);
  };

  const handleProgress = (data: any) => {
    setCurrentTime(data.currentTime);
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    videoRef.current?.seek(0);
  };

  const handleVideoError = (error: any) => {
    const errorDetails = error?.error || error;
    console.log('Video playback error:', JSON.stringify(errorDetails, null, 2));
    console.log('Video URL was:', videoResult?.videoUrl);
    setIsLoading(false);
    setVideoError('Failed to load video. Please try again.');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    if (!videoResult) return;

    try {
      setIsSaving(true);

      const {config, fs} = RNFetchBlob;
      const date = new Date();
      const fileName = `Animated_${date.getTime()}.mp4`;

      if (Platform.OS === 'ios') {
        const cachePath = `${fs.dirs.CacheDir}/${fileName}`;

        const res = await config({
          fileCache: true,
          path: cachePath,
        }).fetch('GET', videoResult.videoUrl);

        const hasPermission = await requestPhotoLibraryPermission();
        if (!hasPermission) {
          setDialog({
            visible: true,
            icon: 'lock-closed',
            iconColor: '#f59e0b',
            title: 'Permission Required',
            message: 'Please allow photo library access in Settings to save videos.',
            type: 'permission',
          });
          await fs.unlink(res.path());
          return;
        }

        await CameraRoll.saveAsset(res.path(), {type: 'video'});
        await fs.unlink(res.path());

        setDialog({
          visible: true,
          icon: 'checkmark-circle',
          iconColor: colors.success,
          title: 'Saved!',
          message: 'Your video has been saved to your photo library.',
          type: 'success',
        });
      } else {
        const downloadPath = `${fs.dirs.DownloadDir}/${fileName}`;

        await config({
          fileCache: true,
          addAndroidDownloads: {
            useDownloadManager: true,
            notification: true,
            path: downloadPath,
            description: 'Downloading video',
            mime: 'video/mp4',
            mediaScannable: true,
          },
        }).fetch('GET', videoResult.videoUrl);

        setDialog({
          visible: true,
          icon: 'checkmark-circle',
          iconColor: colors.success,
          title: 'Saved!',
          message: 'Your video has been saved to Downloads.',
          type: 'success',
        });
      }
    } catch (error: any) {
      console.error('Download error:', error);
      const msg = error?.message || '';
      if (msg.includes('denied') || msg.includes('permission') || msg.includes('Permission')) {
        setDialog({
          visible: true,
          icon: 'lock-closed',
          iconColor: '#F59E0B',
          title: 'Permission Required',
          message: 'Please allow photo library access in Settings to save videos.',
          type: 'permission',
        });
      } else {
        setDialog({
          visible: true,
          icon: 'alert-circle',
          iconColor: colors.error,
          title: 'Save Failed',
          message: 'Could not save the video. Please try again.',
          type: 'error',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!videoResult) return;

    try {
      const fileName = `animated_${Date.now()}.mp4`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: videoResult.videoUrl,
        toFile: filePath,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error('Failed to download video');
      }

      await Share.open({
        url: `file://${filePath}`,
        type: 'video/mp4',
      });

      await RNFS.unlink(filePath).catch(() => {});
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Share error:', error);
        Alert.alert('Error', 'Failed to share video');
      }
    }
  };

  const handleDelete = () => {
    handleClose();
  };

  const handleClose = () => {
    setIsPlaying(false);
    setIsLoading(true);
    setVideoError(null);
    setCurrentTime(0);
    setDuration(0);
    onClose();
  };

  if (!videoResult) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <View style={[styles.overlay, {backgroundColor: colors.overlay}]}>
        <View
          style={[
            styles.modalContainer,
            {backgroundColor: colors.backgroundSecondary},
          ]}>
          {/* Header */}
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <View style={styles.headerContent}>
              <Text style={[styles.title, {color: colors.textPrimary}]}>
                Your Animation
              </Text>
              <Text style={[styles.subtitle, {color: colors.textTertiary}]}>
                {videoResult.durationSeconds}s animated video
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={[
                styles.closeButton,
                {backgroundColor: colors.backgroundTertiary},
              ]}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Ionicons name="close" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Video Player */}
          <View style={[styles.videoContainer, {backgroundColor: '#000'}]}>
            <Video
              ref={videoRef}
              source={{uri: videoResult.videoUrl}}
              style={styles.video}
              resizeMode="contain"
              paused={!isPlaying}
              repeat={false}
              onLoad={handleVideoLoad}
              onProgress={handleProgress}
              onEnd={handleVideoEnd}
              onError={handleVideoError}
            />

            {isLoading && !videoError && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Loading video...</Text>
              </View>
            )}

            {videoError && (
              <View style={styles.loadingOverlay}>
                <Ionicons name="alert-circle-outline" size={48} color="#FF4757" />
                <Text style={styles.loadingText}>{videoError}</Text>
              </View>
            )}

            {!isLoading && (
              <TouchableOpacity
                style={styles.playPauseOverlay}
                onPress={handlePlayPause}
                activeOpacity={0.9}>
                {!isPlaying && (
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={40} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View
              style={[
                styles.progressBarContainer,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.1)',
                },
              ]}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width:
                      duration > 0
                        ? `${(currentTime / duration) * 100}%`
                        : '0%',
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
            <View style={styles.timeContainer}>
              <Text style={[styles.timeText, {color: colors.textSecondary}]}>
                {formatTime(currentTime)}
              </Text>
              <Text style={[styles.timeText, {color: colors.textSecondary}]}>
                {formatTime(duration)}
              </Text>
            </View>
          </View>

          {/* Action Buttons — matches photos tab: Save, Share, Delete */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                {backgroundColor: colors.primary + '30'},
                (isSaving || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleDownload}
              activeOpacity={0.7}
              disabled={isSaving || isLoading}>
              <View style={[styles.buttonIconContainer, {backgroundColor: colors.primary}]}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="download-outline" size={18} color="#fff" />
                )}
              </View>
              <Text style={styles.buttonText}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                {backgroundColor: (colors.secondary || '#8B5CF6') + '30'},
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleShare}
              activeOpacity={0.7}
              disabled={isLoading}>
              <View style={[styles.buttonIconContainer, {backgroundColor: colors.secondary || '#8B5CF6'}]}>
                <Ionicons name="share-social-outline" size={18} color="#fff" />
              </View>
              <Text style={styles.buttonText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                {backgroundColor: colors.error + '30'},
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleDelete}
              activeOpacity={0.7}
              disabled={isLoading}>
              <View style={[styles.buttonIconContainer, {backgroundColor: colors.error}]}>
                <Ionicons name="trash-outline" size={18} color="#fff" />
              </View>
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          </View>
          {/* Styled Dialog */}
          <CustomDialog
            visible={dialog.visible}
            icon={dialog.icon}
            iconColor={dialog.iconColor}
            title={dialog.title}
            message={dialog.message}
            buttons={
              dialog.type === 'permission'
                ? [
                    {text: 'Cancel', onPress: () => setDialog(prev => ({...prev, visible: false})), style: 'cancel'},
                    {text: 'Open Settings', onPress: () => { setDialog(prev => ({...prev, visible: false})); Linking.openSettings(); }, style: 'default'},
                  ]
                : [{text: 'Got it', onPress: () => setDialog(prev => ({...prev, visible: false})), style: 'default'}]
            }
            onClose={() => setDialog(prev => ({...prev, visible: false}))}
            autoDismissMs={dialog.type === 'success' ? 2500 : undefined}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    maxHeight: '95%',
    minHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 6,
  },
  progressSection: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 8,
  },
  buttonIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default AnimateResultModal;
