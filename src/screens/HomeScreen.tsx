import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, useWindowDimensions} from 'react-native';
import {useNavigation, DrawerActions, useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useCopilot} from 'react-native-copilot';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {setInitialized, toggleBusinessMode} from '../store/slices/appSlice';
import {useTheme} from '../theme/ThemeContext';
import CameraArea from '../components/CameraArea';
import ResultModal from '../components/ResultModal';
import Logo from '../components/Logo';
import {useWalkthrough, WALKTHROUGH_KEYS} from '../hooks/useWalkthrough';

const HomeScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {width} = useWindowDimensions();
  const {unopenedPhotosCount, unplayedVideosCount} = useAppSelector(state => state.app);
  const totalUnreadCount = unopenedPhotosCount + unplayedVideosCount;
  const notificationUnreadCount = useAppSelector(state => state.notification.unreadCount);
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
      // Only complete Studio walkthrough if we started it and current step is in Studio range (1-3)
      const stepOrder = currentStep?.order ?? 0;
      if (walkthroughStarted && stepOrder >= 1 && stepOrder <= 3) {
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
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={openDrawer}
            activeOpacity={0.7}>
            <Ionicons name="menu" size={themeIconSize} color={colors.textPrimary} />
          </TouchableOpacity>
          <Logo size={isTablet ? 140 : 100} />
        </View>

        <View style={styles.headerRight}>
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
            onPress={() => (navigation as any).navigate('Notifications')}
            activeOpacity={0.7}>
            <Ionicons name="notifications" size={themeIconSize} color={colors.textPrimary} />
            {notificationUnreadCount > 0 && (
              <View style={styles.bellDot} />
            )}
          </TouchableOpacity>
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
      </View>

      {/* CameraArea contains steps 1, 2, 3, 4 */}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4757',
    borderWidth: 1.5,
    borderColor: '#fff',
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
