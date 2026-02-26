import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Video, {VideoRef} from 'react-native-video';
import {useTheme} from '../theme/ThemeContext';
import GradientButton from '../components/GradientButton';
import RNFetchBlob from 'rn-fetch-blob';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';

interface VideoResult {
  videoUrl: string;
  fileName: string;
  mimeType: string;
  prompt: string;
  durationSeconds: number;
}

type RootStackParamList = {
  VideoResult: {videoResult: VideoResult};
};

type VideoResultRouteProp = RouteProp<RootStackParamList, 'VideoResult'>;

const VideoResultScreen: React.FC = () => {
  const {colors, isDark} = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<VideoResultRouteProp>();
  const {videoResult} = route.params;
  const videoRef = useRef<VideoRef>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    try {
      setIsSaving(true);

      const {config, fs} = RNFetchBlob;
      const date = new Date();
      const fileName = `MagiShot_${date.getTime()}.mp4`;

      if (Platform.OS === 'ios') {
        // For iOS, download to cache and then save to camera roll
        const cachePath = `${fs.dirs.CacheDir}/${fileName}`;

        const res = await config({
          fileCache: true,
          path: cachePath,
        }).fetch('GET', videoResult.videoUrl);

        // Save to camera roll
        await CameraRoll.saveAsset(res.path(), {type: 'video'});

        // Clean up cache file
        await fs.unlink(res.path());

        Alert.alert('Success', 'Video saved to your photo library!');
      } else {
        // For Android, download to Downloads folder
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

        Alert.alert('Success', 'Video saved to Downloads!');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to save video. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        url: videoResult.videoUrl,
        message: 'Check out this video I created with MagiShot!',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.backgroundSecondary}]}>
        <TouchableOpacity
          style={[styles.backButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
          onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]} numberOfLines={1}>
            Your Video
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.shareButton, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}]}
          onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Video Player */}
      <View style={styles.videoSection}>
        <View style={[styles.videoWrapper, {shadowColor: isDark ? '#000' : '#333'}]}>
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
          />

          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}

          {/* Play/Pause Overlay */}
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
          <View style={[styles.progressBarContainer, {backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}]}>
            <View
              style={[
                styles.progressBar,
                {
                  width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
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
      </View>

      {/* Download Notice */}
      <View style={[styles.noticeContainer, {backgroundColor: isDark ? 'rgba(255,193,7,0.15)' : 'rgba(255,193,7,0.1)'}]}>
        <Ionicons name="information-circle" size={20} color="#F59E0B" />
        <Text style={[styles.noticeText, {color: colors.textSecondary}]}>
          This video is temporary and will not be stored. Please save it to your gallery to keep it.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonSection}>
        <GradientButton
          title={isSaving ? 'Saving...' : 'Save to Gallery'}
          onPress={handleDownload}
          disabled={isSaving || isLoading}
        />

        <TouchableOpacity
          style={[styles.secondaryButton, {borderColor: colors.primary}]}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.7}>
          <Text style={[styles.secondaryButtonText, {color: colors.primary}]}>
            Create Another Video
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  videoWrapper: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 400,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    alignSelf: 'center',
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
    marginTop: 12,
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
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 12,
  },
  secondaryButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VideoResultScreen;
