import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  ImageBackground,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';

interface OnboardingPage {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  features: string[];
  backgroundImage: any;
}

interface Props {
  onComplete: () => void;
}

const PAGES: OnboardingPage[] = [
  {
    id: 'welcome',
    icon: 'sparkles',
    iconColor: '#FF1B6D',
    title: 'Welcome to MagiShot',
    subtitle: 'Your AI-powered photo transformation studio',
    features: [
      'Transform photos with AI magic',
      'Virtual try-on for clothes',
      'Professional editing tools',
    ],
    backgroundImage: require('../../assets/onboarding_step1.jpg'),
  },
  {
    id: 'studio',
    icon: 'color-wand',
    iconColor: '#A855F7',
    title: 'AI Photo Studio',
    subtitle: 'Transform yourself into anything imaginable',
    features: [
      'Become celebrities & characters',
      'Travel to world landmarks instantly',
      'Transform into cartoon styles',
      'Experience different eras & art styles',
    ],
    backgroundImage: require('../../assets/onboarding_step2.jpg'),
  },
  {
    id: 'tryon',
    icon: 'shirt',
    iconColor: '#EC4899',
    title: 'Virtual Try-On',
    subtitle: 'See how clothes look on you before buying',
    features: [
      'Try on outfits virtually',
      'See how products look on you',
      'Save time shopping online',
      'Share looks with friends',
    ],
    backgroundImage: require('../../assets/onboarding_step3.jpg'),
  },
  {
    id: 'edit',
    icon: 'brush',
    iconColor: '#8B5CF6',
    title: 'Photo Editor',
    subtitle: 'Professional editing tools at your fingertips',
    features: [
      'AI-powered filters & effects',
      'Stylish frames & borders',
      'Open closed eyes with AI',
      'Fuse two photos together',
    ],
    backgroundImage: require('../../assets/onboarding_step4.jpg'),
  },
];

const OnboardingScreen: React.FC<Props> = ({onComplete}) => {
  const {colors, isDark} = useTheme();
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Responsive calculations
  const isTablet = width >= 768;
  const isSmallPhone = height < 700;

  // Responsive sizing
  const titleSize = isTablet ? 38 : isSmallPhone ? 26 : 32;
  const subtitleSize = isTablet ? 18 : isSmallPhone ? 14 : 16;
  const featureSize = isTablet ? 15 : isSmallPhone ? 13 : 14;
  const buttonHeight = isTablet ? 60 : isSmallPhone ? 50 : 56;
  const dotSize = isTablet ? 12 : isSmallPhone ? 8 : 10;
  const containerPadding = isTablet ? 48 : isSmallPhone ? 20 : 28;

  const handleScroll = Animated.event(
    [{nativeEvent: {contentOffset: {x: scrollX}}}],
    {useNativeDriver: false},
  );

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const goToNextPage = () => {
    if (currentIndex < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleGetStarted = () => {
    onComplete();
  };

  const renderPage = ({item, index}: {item: OnboardingPage; index: number}) => {
    return (
      <View style={[styles.page, {width}]}>
        {/* Background Image */}
        <Image
          source={item.backgroundImage}
          style={styles.backgroundImage}
          resizeMode="cover"
        />

        {/* Gradient Overlay */}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.3)',
            'rgba(0,0,0,0.5)',
            isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.75)',
            isDark ? colors.background : 'rgba(0,0,0,0.9)',
          ]}
          locations={[0, 0.3, 0.6, 1]}
          style={styles.gradientOverlay}
        />

        {/* Content */}
        <View style={[styles.contentContainer, {paddingHorizontal: containerPadding}]}>
          {/* Spacer */}
          <View style={styles.topSection} />

          {/* Bottom Section - Text Content */}
          <View style={styles.bottomSection}>
            <Text
              style={[
                styles.title,
                {fontSize: titleSize},
              ]}>
              {item.title}
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  fontSize: subtitleSize,
                  lineHeight: subtitleSize * 1.5,
                },
              ]}>
              {item.subtitle}
            </Text>

            {/* Features List */}
            <View style={styles.featuresContainer}>
              {item.features.map((feature, idx) => (
                <View key={idx} style={styles.featureRow}>
                  <View
                    style={[
                      styles.featureIcon,
                      {backgroundColor: item.iconColor},
                    ]}>
                    <Ionicons
                      name="checkmark"
                      size={isTablet ? 14 : 12}
                      color="#fff"
                    />
                  </View>
                  <Text
                    style={[
                      styles.featureText,
                      {fontSize: featureSize},
                    ]}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {PAGES.map((page, index) => {
        const inputRange = [
          (index - 1) * width,
          index * width,
          (index + 1) * width,
        ];
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [dotSize, dotSize * 3, dotSize],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.4, 1, 0.4],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotWidth,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: '#fff',
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );

  const isLastPage = currentIndex === PAGES.length - 1;
  const currentPage = PAGES[currentIndex];

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Fixed Bottom Controls */}
      <View
        style={[
          styles.controlsContainer,
          {
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: containerPadding,
          },
        ]}>
        {renderDots()}

        {isLastPage ? (
          <LinearGradient
            colors={['#FF1B6D', '#A855F7']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={[styles.getStartedGradient, {height: buttonHeight}]}>
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={handleGetStarted}
              activeOpacity={0.9}>
              <Text
                style={[styles.getStartedText, {fontSize: isTablet ? 20 : 18}]}>
                Get Started
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={{marginLeft: 8}} />
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <View style={styles.navigationRow}>
            <TouchableOpacity
              style={[styles.skipButton, {height: buttonHeight}]}
              onPress={handleSkip}
              activeOpacity={0.7}>
              <Text style={[styles.skipText, {fontSize: isTablet ? 17 : 15}]}>
                Skip
              </Text>
            </TouchableOpacity>
            <LinearGradient
              colors={[currentPage.iconColor, currentPage.iconColor + 'CC']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={[styles.nextGradient, {height: buttonHeight}]}>
              <TouchableOpacity
                style={styles.nextButton}
                onPress={goToNextPage}
                activeOpacity={0.9}>
                <Text style={[styles.nextText, {fontSize: isTablet ? 17 : 15}]}>
                  Next
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{marginLeft: 6}} />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  page: {
    flex: 1,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 180,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    alignItems: 'flex-start',
  },
  title: {
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 24,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  featuresContainer: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {},
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  skipText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  nextGradient: {
    borderRadius: 16,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextText: {
    color: '#fff',
    fontWeight: '700',
  },
  getStartedGradient: {
    borderRadius: 16,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  getStartedButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default OnboardingScreen;
