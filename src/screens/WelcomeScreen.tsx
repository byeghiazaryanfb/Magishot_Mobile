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

interface WelcomeScreenProps {
  progress?: number; // 0 to 1
  statusText?: string;
}

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const PROGRESS_BAR_WIDTH = SCREEN_WIDTH * 0.7;

// Local splash background image
const BACKGROUND_IMAGE = require('../../assets/splash_background.jpg');

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  progress = 0,
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
  const logoSize = isTablet ? 300 : isSmallPhone ? 180 : 240;
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

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PROGRESS_BAR_WIDTH],
  });

  const tileIconSize = isTablet ? 28 : isSmallPhone ? 18 : 22;
  const tileLabelSize = isTablet ? 12 : isSmallPhone ? 9 : 10;

  const features = [
    {icon: 'sparkles', title: 'AI Effects', color: '#FF1B6D'},
    {icon: 'shirt-outline', title: 'Try-On', color: '#EC4899'},
    {icon: 'videocam', title: 'Videos', color: '#8B5CF6'},
    {icon: 'brush', title: 'Editing', color: '#A855F7'},
    {icon: 'eye-outline', title: 'Open Eyes', color: '#F59E0B'},
    {icon: 'expand-outline', title: 'Expand', color: '#10B981'},
    {icon: 'image-outline', title: 'Restore', color: '#06B6D4'},
    {icon: 'git-merge-outline', title: 'Fusion', color: '#F472B6'},
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
          <View style={styles.logoBorder}>
            <Logo size={logoSize} />
          </View>
        </Animated.View>

        {/* Title & Features Section */}
        <Animated.View
          style={[
            styles.titleSection,
            {
              opacity: contentOpacity,
              transform: [{translateY: contentTranslateY}],
            },
          ]}>
          <Text style={[styles.title, {fontSize: isTablet ? 28 : isSmallPhone ? 18 : 22}]}>
            Transform Your Photos
          </Text>
          <Text style={[styles.subtitle, {fontSize: isTablet ? 16 : isSmallPhone ? 13 : 14}]}>
            AI-powered editing, virtual try-on, and magical transformations
          </Text>

          {/* 2x2 Feature Grid */}
          <View style={styles.featureGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureTile}>
                <LinearGradient
                  colors={[feature.color + '25', feature.color + '10']}
                  style={styles.tileGradient}>
                  <Ionicons
                    name={feature.icon as any}
                    size={tileIconSize}
                    color={feature.color}
                  />
                  <Text style={[styles.tileLabel, {fontSize: tileLabelSize}]}>
                    {feature.title}
                  </Text>
                </LinearGradient>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Progress Section */}
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
  logoBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255,100,150,0.45)',
    borderRadius: 180,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  subtitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  featureTile: {
    width: '22%',
    aspectRatio: 0.85,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tileGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tileLabel: {
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
    textAlign: 'center',
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

export default WelcomeScreen;
