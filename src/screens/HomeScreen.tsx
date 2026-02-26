import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, useWindowDimensions} from 'react-native';
import {useNavigation, DrawerActions, useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {CopilotStep, useCopilot, walkthroughable} from 'react-native-copilot';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {setInitialized} from '../store/slices/appSlice';
import {useTheme} from '../theme/ThemeContext';
import SightsBar from '../components/SightsBar';
import CameraArea from '../components/CameraArea';
import ResultModal from '../components/ResultModal';
import Logo from '../components/Logo';
import {useWalkthrough, WALKTHROUGH_KEYS} from '../hooks/useWalkthrough';

// Create walkthroughable components
const WalkthroughableView = walkthroughable(View);

const HomeScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {width} = useWindowDimensions();
  const {unopenedPhotosCount, unplayedVideosCount} = useAppSelector(state => state.app);
  const totalUnreadCount = unopenedPhotosCount + unplayedVideosCount;
  const styleMode = useAppSelector(state => state.transform.styleMode);
  const templateDisabled = styleMode !== 'effects';

  // Walkthrough for Studio tab
  const {start, copilotEvents, currentStep} = useCopilot();
  const {shouldShowWalkthrough, isLoading: walkthroughLoading, completeWalkthrough} = useWalkthrough(WALKTHROUGH_KEYS.STUDIO);
  const [walkthroughStarted, setWalkthroughStarted] = useState(false);

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  // Responsive sizing for iPad
  const isTablet = width >= 768;
  const themeToggleSize = isTablet ? 52 : 44;
  const themeIconSize = isTablet ? 26 : 22;
  const headerPadding = isTablet ? 32 : 20;

  useEffect(() => {
    dispatch(setInitialized(true));
  }, [dispatch]);

  // Start walkthrough when screen is focused and conditions are met
  useFocusEffect(
    React.useCallback(() => {
      if (!walkthroughLoading && shouldShowWalkthrough && !walkthroughStarted) {
        // Small delay to ensure UI is ready
        const timer = setTimeout(() => {
          setWalkthroughStarted(true);
          start();
        }, 800);
        return () => clearTimeout(timer);
      }
    }, [walkthroughLoading, shouldShowWalkthrough, walkthroughStarted, start])
  );

  // Listen for walkthrough completion
  useEffect(() => {
    const handleStop = () => {
      // Only complete Studio walkthrough if we started it and current step is in Studio range (1-4)
      const stepOrder = currentStep?.order ?? 0;
      if (walkthroughStarted && stepOrder >= 1 && stepOrder <= 4) {
        completeWalkthrough();
        setWalkthroughStarted(false);
      }
    };

    copilotEvents.on('stop', handleStop);
    return () => {
      copilotEvents.off('stop', handleStop);
    };
  }, [copilotEvents, completeWalkthrough, walkthroughStarted, currentStep]);

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: headerPadding,
          },
        ]}>
        <TouchableOpacity
          style={[
            styles.menuButton,
            {
              backgroundColor: colors.backgroundTertiary,
              width: themeToggleSize,
              height: themeToggleSize,
              borderRadius: themeToggleSize / 2,
            },
          ]}
          onPress={openDrawer}
          activeOpacity={0.7}>
          <Ionicons name="menu" size={themeIconSize} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Logo size={isTablet ? 220 : 180} />
        </View>

        <TouchableOpacity
          style={[
            styles.headerButton,
            {
              backgroundColor: colors.backgroundTertiary,
              width: themeToggleSize,
              height: themeToggleSize,
              borderRadius: themeToggleSize / 2,
            },
          ]}
          onPress={() => (navigation as any).navigate('MyCreations')}
          activeOpacity={0.7}>
          <Ionicons name="images" size={themeIconSize} color={colors.textPrimary} />
          {totalUnreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Step 1: Templates/Sights Bar */}
      <View style={{opacity: templateDisabled ? 0.35 : 1}} pointerEvents={templateDisabled ? 'none' : 'auto'}>
        <CopilotStep
          text="Choose a template like Paris, New York, or any style you want to transform your photo into."
          order={1}
          name="🎨 Templates">
          <WalkthroughableView>
            <SightsBar />
          </WalkthroughableView>
        </CopilotStep>
      </View>

      {/* CameraArea contains steps 2, 3, 4 */}
      <CameraArea />

      <ResultModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
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
  menuButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF4757',
    borderWidth: 1.5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});

export default HomeScreen;
