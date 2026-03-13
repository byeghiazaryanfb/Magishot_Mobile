/**
 * MagiShot Mobile App
 * @format
 */

import React, {useState, useEffect, useRef} from 'react';
import {LogBox, StatusBar, StyleSheet, View, Text, Pressable, AppState} from 'react-native';

LogBox.ignoreAllLogs();
import {Provider} from 'react-redux';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {CopilotProvider} from 'react-native-copilot';
import {store} from './src/store';
import {useAppDispatch, useAppSelector} from './src/store/hooks';
import {ThemeProvider, useTheme} from './src/theme/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import {OnboardingStorage, AuthStorage} from './src/utils/storage';
import {initializeAuth, clearAuth, updateTokens} from './src/store/slices/authSlice';
import {fetchVideoGallery, resetGallery, clearStaleJobs} from './src/store/slices/videoNotificationSlice';
import {clearStaleImageJobs} from './src/store/slices/imageNotificationSlice';
import {fetchUnreadCounts} from './src/store/slices/appSlice';
import {fetchNotificationUnreadCount} from './src/store/slices/notificationSlice';
import api from './src/services/api';
import SignalRListener from './src/components/SignalRListener';
import InAppNotificationBanner from './src/components/InAppNotificationBanner';
import {navigationRef} from './src/navigation/navigationRef';

// Custom tooltip component for walkthrough
const CustomTooltip = ({
  isFirstStep,
  isLastStep,
  handleNext,
  handlePrev,
  handleStop,
  currentStep,
}: any) => (
  <View style={walkthroughStyles.tooltipContainer}>
    <Text style={walkthroughStyles.tooltipTitle}>{currentStep?.name}</Text>
    <Text style={walkthroughStyles.tooltipText}>{currentStep?.text}</Text>
    <View style={walkthroughStyles.buttonRow}>
      {!isFirstStep && (
        <Pressable
          style={({pressed}) => [
            walkthroughStyles.buttonWrapper,
            pressed && walkthroughStyles.buttonPressed,
          ]}
          onPress={handlePrev}>
          <Text style={walkthroughStyles.buttonText}>Previous</Text>
        </Pressable>
      )}
      {!isLastStep ? (
        <Pressable
          style={({pressed}) => [
            walkthroughStyles.buttonWrapper,
            walkthroughStyles.primaryButton,
            pressed && walkthroughStyles.primaryButtonPressed,
          ]}
          onPress={handleNext}>
          <Text style={walkthroughStyles.primaryButtonText}>Next</Text>
        </Pressable>
      ) : (
        <Pressable
          style={({pressed}) => [
            walkthroughStyles.buttonWrapper,
            walkthroughStyles.primaryButton,
            pressed && walkthroughStyles.primaryButtonPressed,
          ]}
          onPress={handleStop}>
          <Text style={walkthroughStyles.primaryButtonText}>Done</Text>
        </Pressable>
      )}
    </View>
    <Pressable
      style={({pressed}) => [pressed && {opacity: 0.5}]}
      onPress={handleStop}>
      <Text style={walkthroughStyles.skipText}>Skip Tour</Text>
    </Pressable>
  </View>
);

const walkthroughStyles = StyleSheet.create({
  tooltipContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 20,
    width: 260,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 27, 109, 0.4)',
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF1B6D',
    marginBottom: 8,
  },
  tooltipText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  buttonWrapper: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryButton: {
    backgroundColor: '#FF1B6D',
  },
  primaryButtonPressed: {
    backgroundColor: '#cc1557',
  },
  buttonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
});

function App() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Provider store={store}>
        <ThemeProvider>
          <SafeAreaProvider>
            <CopilotProvider
              stepNumberComponent={() => null}
              overlay="view"
              animated
              backdropColor="rgba(0, 0, 0, 0.85)"
              verticalOffset={0}
              stopOnOutsideClick={false}
              tooltipStyle={{
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 14,
                maxWidth: 240,
              }}
              arrowColor="#fff">
              <ThemedApp />
            </CopilotProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

function ThemedApp() {
  const {colors, isDark} = useTheme();

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <SignalRListener />
      <InAppNotificationBanner />
      <AppContent />
    </>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const {colors} = useTheme();
  const dispatch = useAppDispatch();

  // Auth state
  const {isAuthenticated, isInitialized} =
    useAppSelector(state => state.auth);

  // Loading state
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Starting up...');
  const [isLoading, setIsLoading] = useState(true);
  const [minDelayComplete, setMinDelayComplete] = useState(false);
  const [appReady, setAppReady] = useState(false);

  // Onboarding state
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  // Minimum 5 second delay with smooth progress animation
  const SPLASH_DURATION = 5000; // 5 seconds

  // Smooth progress animation over 5 seconds
  useEffect(() => {
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / SPLASH_DURATION, 1);
      setLoadingProgress(progress);

      // Update status text based on progress
      if (progress < 0.15) {
        setLoadingStatus('✨ Waking up the magic...');
      } else if (progress < 0.30) {
        setLoadingStatus('🎨 Loading AI models...');
      } else if (progress < 0.45) {
        setLoadingStatus('👗 Preparing virtual try-on...');
      } else if (progress < 0.60) {
        setLoadingStatus('📸 Setting up photo studio...');
      } else if (progress < 0.75) {
        setLoadingStatus('🪄 Polishing the experience...');
      } else if (progress < 0.90) {
        setLoadingStatus('🚀 Almost there...');
      } else {
        setLoadingStatus('✅ Ready to transform!');
      }

      if (progress >= 1) {
        clearInterval(progressInterval);
        setMinDelayComplete(true);
      }
    }, 50); // Update every 50ms for smooth animation

    return () => clearInterval(progressInterval);
  }, []);

  // Check if we can hide the loading screen (both delay complete and app ready)
  useEffect(() => {
    if (minDelayComplete && appReady) {
      setTimeout(() => setIsLoading(false), 300);
    }
  }, [minDelayComplete, appReady]);

  // Set up API token callbacks for automatic token refresh
  useEffect(() => {
    api.setTokenCallbacks(
      // Get current tokens
      () => ({
        accessToken: store.getState().auth.accessToken,
        refreshToken: store.getState().auth.refreshToken,
      }),
      // On token refresh success
      async (newAccessToken: string, newRefreshToken: string) => {
        dispatch(updateTokens({accessToken: newAccessToken, refreshToken: newRefreshToken}));
        // Also persist to storage
        const currentAuth = store.getState().auth;
        await AuthStorage.saveAuthData({
          userId: currentAuth.userId || '',
          username: currentAuth.username || '',
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: currentAuth.expiresIn || 0,
        });
      },
      // On auth failure (refresh failed)
      () => {
        dispatch(clearAuth());
        AuthStorage.clearAuthData();
      },
    );
  }, [dispatch]);

  // Initialize auth from storage on mount
  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Fetch gallery and unread counts once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchVideoGallery({}));
      dispatch(fetchUnreadCounts());
      dispatch(fetchNotificationUnreadCount());
    }
  }, [isAuthenticated, dispatch]);

  // Refresh galleries when app comes back to foreground
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isAuthenticated
      ) {
        dispatch(clearStaleJobs());
        dispatch(clearStaleImageJobs());
        dispatch(resetGallery());
        dispatch(fetchVideoGallery({}));
        dispatch(fetchUnreadCounts());
        dispatch(fetchNotificationUnreadCount());
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, dispatch]);

  // Check onboarding status after auth is initialized
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      checkOnboardingStatus();
    } else if (isInitialized && !isAuthenticated) {
      setIsCheckingOnboarding(false);
      // Mark app as ready (effect above will handle hiding loading screen)
      setAppReady(true);
    }
  }, [isInitialized, isAuthenticated]);

  const checkOnboardingStatus = async () => {
    const seen = await OnboardingStorage.hasSeenOnboarding();
    setHasSeenOnboarding(seen);
    setIsCheckingOnboarding(false);
    // Mark app as ready (effect above will handle hiding loading screen)
    setAppReady(true);
  };

  const handleOnboardingComplete = async () => {
    await OnboardingStorage.setOnboardingComplete();
    setHasSeenOnboarding(true);
    // Show paywall after onboarding
    setShowPaywall(true);
  };

  const handlePaywallClose = () => {
    setShowPaywall(false);
  };

  const handlePurchase = (planId: string) => {
    console.log('Purchase plan:', planId);
    // TODO: Implement purchase logic
    setShowPaywall(false);
  };

  // Determine which content to show
  const renderContent = () => {
    // Still initializing - show welcome screen with progress bar
    if (!isInitialized || isCheckingOnboarding || isLoading) {
      return (
        <WelcomeScreen
          progress={loadingProgress}
          statusText={loadingStatus}
        />
      );
    }

    // Show auth screens if not authenticated (navigates to login immediately)
    if (!isAuthenticated) {
      return <AuthNavigator />;
    }

    // Show onboarding if not seen
    if (!hasSeenOnboarding) {
      return <OnboardingScreen onComplete={handleOnboardingComplete} />;
    }

    // Show paywall if needed
    if (showPaywall) {
      return (
        <PaywallScreen
          onClose={handlePaywallClose}
          onPurchase={handlePurchase}
        />
      );
    }

    // Show main app with drawer + tab navigation (opens app immediately)
    return (
      <View
        style={[
          styles.container,
          {paddingTop: safeAreaInsets.top, backgroundColor: colors.background},
        ]}>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
      </View>
    );
  };

  return (
    <View style={styles.appContainer}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  appContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});

export default App;
