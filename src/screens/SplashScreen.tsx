import React, {useEffect, useRef} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  useWindowDimensions,
  Image,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Logo from '../components/Logo';

// Local splash background image
const BACKGROUND_IMAGE = require('../../assets/splash_background.jpg');

interface SplashScreenProps {
  progress: number; // 0 to 1
  statusText?: string;
}

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const PROGRESS_BAR_WIDTH = SCREEN_WIDTH * 0.7;

const SplashScreen: React.FC<SplashScreenProps> = ({
  progress,
  statusText = 'Loading...',
}) => {
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Animations
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;
  const progressOpacity = useRef(new Animated.Value(0)).current;
  const progressTranslateY = useRef(new Animated.Value(20)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Responsive sizing
  const isTablet = width >= 768;
  const isSmallPhone = height < 700;
  const logoSize = isTablet ? 360 : isSmallPhone ? 240 : 300;
  const titleSize = isTablet ? 40 : isSmallPhone ? 28 : 34;
  const subtitleSize = isTablet ? 18 : isSmallPhone ? 14 : 16;
  const containerPadding = isTablet ? 48 : isSmallPhone ? 24 : 32;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // Logo animation
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Content animation
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // Progress bar animation
      Animated.parallel([
        Animated.timing(progressOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(progressTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
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

  const features = [
    {icon: 'sparkles', text: 'AI Photo Magic', color: '#FF1B6D'},
    {icon: 'shirt', text: 'Virtual Try-On', color: '#EC4899'},
    {icon: 'brush', text: 'Pro Editing', color: '#A855F7'},
  ];

  return (
    <View style={styles.container}>
      {/* Background Image */}
      <Image
        source={BACKGROUND_IMAGE}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Gradient Overlay */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.4)',
          'rgba(0,0,0,0.5)',
          'rgba(0,0,0,0.7)',
          'rgba(0,0,0,0.9)',
        ]}
        locations={[0, 0.3, 0.6, 1]}
        style={styles.gradientOverlay}
      />

      <View style={[styles.content, {paddingTop: insets.top + 40}]}>
        {/* Logo Section */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: logoOpacity,
              transform: [{scale: logoScale}],
            },
          ]}>
          <Logo size={logoSize} />
        </Animated.View>

        {/* Title Section */}
        <Animated.View
          style={[
            styles.titleSection,
            {
              opacity: contentOpacity,
              transform: [{translateY: contentTranslateY}],
            },
          ]}>
          <Text style={[styles.title, {fontSize: titleSize}]}>
            Transform Your Photos
          </Text>
          <Text style={[styles.subtitle, {fontSize: subtitleSize}]}>
            Transform Your Photos with AI
          </Text>
        </Animated.View>

        {/* Progress Section (replaces buttons) */}
        <Animated.View
          style={[
            styles.progressSection,
            {
              paddingBottom: insets.bottom + 32,
              paddingHorizontal: containerPadding,
              opacity: progressOpacity,
              transform: [{translateY: progressTranslateY}],
            },
          ]}>
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressBarContainer, {width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, PROGRESS_BAR_WIDTH],
              })}]}>
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  featureContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  progressSection: {
    alignItems: 'center',
    gap: 14,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressTrack: {
    width: PROGRESS_BAR_WIDTH,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarContainer: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    flex: 1,
    borderRadius: 4,
  },
  progressText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  statusText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
});

export default SplashScreen;
