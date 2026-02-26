import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Logo from './Logo';

interface LoadingOverlayProps {
  visible: boolean;
  progress: number; // 0 to 1
  statusText?: string;
}

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const PROGRESS_BAR_WIDTH = SCREEN_WIDTH * 0.7;

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  progress,
  statusText = 'Loading...',
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (!visible) {
      // Fade out when done loading
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible && progress >= 1) {
    return null;
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PROGRESS_BAR_WIDTH],
  });

  return (
    <Animated.View style={[styles.container, {opacity: fadeAnim}]}>
      <LinearGradient
        colors={['rgba(10,10,15,0.97)', 'rgba(15,15,25,0.98)', 'rgba(10,10,15,0.99)']}
        style={styles.gradient}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: logoOpacity,
            transform: [{scale: logoScale}],
          },
        ]}>
        {/* Logo */}
        <Logo size={220} />

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBarContainer, {width: progressWidth}]}>
              <LinearGradient
                colors={['#FF1B6D', '#A855F7']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.progressBar}
              />
            </Animated.View>
          </View>

          {/* Progress percentage */}
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </View>

        {/* Status text */}
        <Text style={styles.statusText}>{statusText}</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    alignItems: 'center',
  },
  progressContainer: {
    marginTop: 48,
    alignItems: 'center',
  },
  progressTrack: {
    width: PROGRESS_BAR_WIDTH,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarContainer: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    flex: 1,
    borderRadius: 3,
  },
  progressText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  statusText: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
});

export default LoadingOverlay;
