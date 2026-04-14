import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {logoutUser, deleteAccount, fetchCoinBalance} from '../store/slices/authSlice';
import {fetchUnreadCounts, setAccountDeleted} from '../store/slices/appSlice';
import TabNavigator from './TabNavigator';
import Logo from '../components/Logo';
import {config} from '../utils/config';
import PalettePickerModal from '../components/PalettePickerModal';
import ContactSupportModal from '../components/ContactSupportModal';
import CustomDialog from '../components/CustomDialog';
import RateAppModal from '../components/RateAppModal';
import OnboardingScreen from '../screens/OnboardingScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

const Drawer = createDrawerNavigator();

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  badge?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  isDestructive,
  badge,
}) => {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.menuItemLeft}>
        <View
          style={[
            styles.menuIconContainer,
            isDestructive && styles.menuIconContainerDestructive,
          ]}>
          <Ionicons
            name={icon}
            size={22}
            color={isDestructive ? '#FF4757' : '#fff'}
          />
        </View>
        <Text
          style={[
            styles.menuItemText,
            isDestructive && styles.menuItemTextDestructive,
          ]}>
          {label}
        </Text>
      </View>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons
        name="chevron-forward"
        size={20}
        color={isDestructive ? '#FF4757' : 'rgba(255,255,255,0.3)'}
      />
    </TouchableOpacity>
  );
};

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = props => {
  const {colors, isDark, toggleTheme, currentPalette} = useTheme();
  const dispatch = useAppDispatch();
  const [showPalettePicker, setShowPalettePicker] = useState(false);
  const [showContactSupport, setShowContactSupport] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRateApp, setShowRateApp] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState('');
  const [showOnboardingPreview, setShowOnboardingPreview] = useState(false);
  const [showWelcomePreview, setShowWelcomePreview] = useState(false);
  const [legalModal, setLegalModal] = useState<{visible: boolean; title: string; content: string; isLoading: boolean}>({
    visible: false, title: '', content: '', isLoading: false,
  });
  const {username, email, refreshToken, accessToken, coinBalance} = useAppSelector(state => state.auth);
  const {unopenedPhotosCount, unplayedVideosCount} = useAppSelector(state => state.app);
  const totalUnreadCount = unopenedPhotosCount + unplayedVideosCount;

  const drawerStatus = useDrawerStatus();

  useEffect(() => {
    if (drawerStatus === 'open' && accessToken) {
      dispatch(fetchCoinBalance(accessToken));
      dispatch(fetchUnreadCounts());
    }
  }, [drawerStatus, accessToken, dispatch]);

  const openLegalContent = async (type: 'terms' | 'privacy') => {
    const title = type === 'terms' ? 'Terms & Conditions' : 'Privacy Policy';
    const endpoint = type === 'terms' ? 'terms_and_conditions' : 'privacy_policy';
    setLegalModal({visible: true, title, content: '', isLoading: true});
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/SystemSettings/${endpoint}`);
      const json = await response.json();
      setLegalModal(prev => ({...prev, content: json.value || '', isLoading: false}));
    } catch {
      setLegalModal(prev => ({...prev, content: 'Failed to load content. Please try again.', isLoading: false}));
    }
  };

  const renderMarkdownLine = (line: string, index: number) => {
    const trimmed = line.trim();
    if (!trimmed) return <View key={index} style={{height: 10}} />;
    if (trimmed.startsWith('### ')) return <Text key={index} style={styles.mdH3}>{trimmed.slice(4).replace(/\*\*/g, '')}</Text>;
    if (trimmed.startsWith('## ')) return <Text key={index} style={styles.mdH2}>{trimmed.slice(3).replace(/\*\*/g, '')}</Text>;
    if (trimmed.startsWith('# ')) return <Text key={index} style={styles.mdH1}>{trimmed.slice(2).replace(/\*\*/g, '')}</Text>;
    if (/^[-*_]{3,}$/.test(trimmed)) return <View key={index} style={styles.mdHr} />;
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <View key={index} style={styles.mdBulletRow}>
          <Text style={styles.mdBulletDot}>{'\u2022'}</Text>
          <Text style={styles.mdBody}>{renderInlineBold(trimmed.slice(2))}</Text>
        </View>
      );
    }
    return <Text key={index} style={styles.mdBody}>{renderInlineBold(trimmed)}</Text>;
  };

  const renderInlineBold = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <Text key={i} style={styles.mdBold}>{part.slice(2, -2)}</Text>
        : part,
    );
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    dispatch(logoutUser(refreshToken || undefined));
  };

  const handleDeleteAccount = () => {
    setShowDeleteAccountConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    if (!accessToken) return;
    setIsDeletingAccount(true);
    try {
      await dispatch(deleteAccount({accessToken, email: email || ''})).unwrap();
      setShowDeleteAccountConfirm(false);
      dispatch(setAccountDeleted(true));
    } catch {
      setShowDeleteAccountConfirm(false);
      setErrorMessage('Failed to delete account. Please try again.');
      setShowErrorDialog(true);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleMenuPress = (screen: string) => {
    // Close drawer
    props.navigation.closeDrawer();

    // Navigate to Profile screen
    if (screen === 'Profile') {
      props.navigation.navigate('Profile');
      return;
    }

    // Navigate to Help Center screen
    if (screen === 'Help Center') {
      props.navigation.navigate('HelpCenter');
      return;
    }

    // Navigate to Subscription screen
    if (screen === 'Subscription') {
      props.navigation.navigate('Subscription');
      return;
    }

    // Navigate to My Creations screen
    if (screen === 'My Creations') {
      props.navigation.navigate('MyCreations');
      return;
    }

    // Show contact support modal
    if (screen === 'Contact Us') {
      setShowContactSupport(true);
      return;
    }

    // Show rate app modal
    if (screen === 'Rate App') {
      setShowRateApp(true);
      return;
    }

    // Show dialog for other features
    setComingSoonFeature(screen);
    setShowComingSoon(true);
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f0f23']}
      style={styles.container}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <TouchableOpacity
          style={styles.profileSection}
          onPress={() => handleMenuPress('Profile')}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['#FF1B6D', '#FF758C']}
            style={styles.avatarGradient}>
            <Text style={styles.avatarText}>
              {username ? username.charAt(0).toUpperCase() : 'U'}
            </Text>
          </LinearGradient>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{username || 'User'}</Text>
            <View style={styles.proBadgeRow}>
              <View style={styles.proBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.proBadgeText}>Free Plan</Text>
              </View>
              {coinBalance !== null && (
                <View style={styles.coinBadge}>
                  <Text style={styles.coinBadgeText}>★ {coinBalance}</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <MenuItem
            icon="person-outline"
            label="Profile"
            onPress={() => handleMenuPress('Profile')}
          />
          <MenuItem
            icon="card-outline"
            label="Subscription"
            onPress={() => handleMenuPress('Subscription')}
            badge="PRO"
          />
          <MenuItem
            icon="images-outline"
            label="My Creations"
            onPress={() => handleMenuPress('My Creations')}
            badge={totalUnreadCount > 0 ? String(totalUnreadCount) : undefined}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons
                name={isDark ? 'moon' : 'sunny'}
                size={22}
                color="rgba(255,255,255,0.7)"
              />
              <Text style={styles.menuItemLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{false: 'rgba(255,255,255,0.2)', true: '#FF1B6D'}}
              thumbColor={isDark ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="rgba(255,255,255,0.2)"
            />
          </View>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowPalettePicker(true)}
            activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.colorThemeCircle, {backgroundColor: colors.primary}]} />
              <Text style={styles.menuItemLabel}>Color Theme</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="rgba(255,255,255,0.5)"
            />
          </TouchableOpacity>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons
                name={notificationsEnabled ? 'notifications' : 'notifications-outline'}
                size={22}
                color="rgba(255,255,255,0.7)"
              />
              <Text style={styles.menuItemLabel}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{false: 'rgba(255,255,255,0.2)', true: '#FF1B6D'}}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="rgba(255,255,255,0.2)"
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          <MenuItem
            icon="help-circle-outline"
            label="Help Center"
            onPress={() => handleMenuPress('Help Center')}
          />
          <MenuItem
            icon="chatbubble-outline"
            label="Contact Us"
            onPress={() => handleMenuPress('Contact Us')}
          />
          <MenuItem
            icon="star-outline"
            label="Rate App"
            onPress={() => handleMenuPress('Rate App')}
          />
          <MenuItem
            icon="document-text-outline"
            label="Terms & Conditions"
            onPress={() => openLegalContent('terms')}
          />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => openLegalContent('privacy')}
          />
        </View>

{/* Logout & Account */}
        <View style={styles.logoutSection}>
          <MenuItem
            icon="log-out-outline"
            label="Logout"
            onPress={handleLogout}
            isDestructive
          />
          <MenuItem
            icon="trash-outline"
            label="Delete Account"
            onPress={handleDeleteAccount}
            isDestructive
          />
        </View>
      </DrawerContentScrollView>

      {/* App Version */}
      <View style={styles.footer}>
        <Logo size={32} showBorder={false} />
        <Text style={styles.versionText}>MagiShot v1.0.0</Text>
      </View>
      <PalettePickerModal
        visible={showPalettePicker}
        onClose={() => setShowPalettePicker(false)}
      />
      <ContactSupportModal
        visible={showContactSupport}
        onClose={() => setShowContactSupport(false)}
        onSuccess={() => setShowSuccessDialog(true)}
        onError={(msg) => {
          setErrorMessage(msg);
          setShowErrorDialog(true);
        }}
      />
      <CustomDialog
        visible={showSuccessDialog}
        icon="checkmark-circle"
        title="Message Sent!"
        message="Thank you for contacting us. We'll get back to you as soon as possible."
        buttons={[
          {text: 'Done', onPress: () => setShowSuccessDialog(false), style: 'default'},
        ]}
        onClose={() => setShowSuccessDialog(false)}
      />
      <CustomDialog
        visible={showErrorDialog}
        icon="alert-circle"
        iconColor="#FF4757"
        title="Error"
        message={errorMessage}
        buttons={[
          {text: 'OK', onPress: () => setShowErrorDialog(false), style: 'default'},
        ]}
        onClose={() => setShowErrorDialog(false)}
      />
      <RateAppModal
        visible={showRateApp}
        onClose={() => setShowRateApp(false)}
      />
      <CustomDialog
        visible={showLogoutConfirm}
        icon="log-out-outline"
        iconColor="#FF4757"
        title="Logout"
        message="Are you sure you want to logout?"
        buttons={[
          {text: 'Cancel', onPress: () => setShowLogoutConfirm(false), style: 'cancel'},
          {text: 'Logout', onPress: confirmLogout, style: 'destructive'},
        ]}
        onClose={() => setShowLogoutConfirm(false)}
      />
      <CustomDialog
        visible={showDeleteAccountConfirm}
        icon="warning-outline"
        iconColor="#FF4757"
        title="Delete Account"
        message="This will permanently delete your account and all your data including photos, videos, comics, and coins. This action cannot be undone."
        buttons={[
          {text: 'Cancel', onPress: () => setShowDeleteAccountConfirm(false), style: 'cancel'},
          {text: isDeletingAccount ? 'Deleting...' : 'Delete Forever', onPress: confirmDeleteAccount, style: 'destructive'},
        ]}
        onClose={() => setShowDeleteAccountConfirm(false)}
      />
      <CustomDialog
        visible={showComingSoon}
        icon="time-outline"
        title="Coming Soon"
        message={`${comingSoonFeature} feature will be available soon!`}
        buttons={[
          {text: 'Got it', onPress: () => setShowComingSoon(false), style: 'default'},
        ]}
        onClose={() => setShowComingSoon(false)}
      />
      {/* Legal Content Modal */}
      <Modal
        visible={legalModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setLegalModal(prev => ({...prev, visible: false}))}>
        <View style={styles.legalOverlay}>
          <View style={styles.legalContainer}>
            <View style={styles.legalHeader}>
              <Text style={styles.legalTitle}>{legalModal.title}</Text>
              <TouchableOpacity
                onPress={() => setLegalModal(prev => ({...prev, visible: false}))}
                style={styles.legalClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {legalModal.isLoading ? (
              <View style={styles.legalLoading}>
                <ActivityIndicator size="large" color="#FF1B6D" />
              </View>
            ) : (
              <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator>
                {legalModal.content.split('\n').map((line, i) => renderMarkdownLine(line, i))}
                <View style={{height: 20}} />
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.legalButton}
              onPress={() => setLegalModal(prev => ({...prev, visible: false}))}
              activeOpacity={0.8}>
              <Text style={styles.legalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Welcome Screen Preview Overlay */}
      {showWelcomePreview && (
        <View style={styles.previewOverlay}>
          <WelcomeScreen
            onGetStarted={() => setShowWelcomePreview(false)}
            onLogin={() => setShowWelcomePreview(false)}
          />
          <TouchableOpacity
            style={styles.closePreviewButton}
            onPress={() => setShowWelcomePreview(false)}>
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      {/* Onboarding Screen Preview Overlay */}
      {showOnboardingPreview && (
        <View style={styles.previewOverlay}>
          <OnboardingScreen onComplete={() => setShowOnboardingPreview(false)} />
          <TouchableOpacity
            style={styles.closePreviewButton}
            onPress={() => setShowOnboardingPreview(false)}>
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
};

const DrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          width: '80%',
          backgroundColor: 'transparent',
        },
        overlayColor: 'rgba(0,0,0,0.7)',
        swipeEdgeWidth: 50,
      }}>
      <Drawer.Screen name="MainTabs" component={TabNavigator} />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  proBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFD700',
  },
  coinBadge: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  coinBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuIconContainerDestructive: {
    backgroundColor: 'rgba(255,71,87,0.15)',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  menuItemTextDestructive: {
    color: '#FF4757',
  },
  badge: {
    backgroundColor: '#FF1B6D',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  logoutSection: {
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  colorThemeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 14,
  },
  // Legal modal
  legalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  legalContainer: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  legalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  legalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  legalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalLoading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  legalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  legalButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#FF1B6D',
  },
  legalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Markdown
  mdH1: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  mdH2: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  mdH3: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 6,
    marginTop: 12,
  },
  mdBody: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  mdBold: {
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  mdBulletRow: {
    flexDirection: 'row' as const,
    paddingLeft: 4,
    marginBottom: 4,
  },
  mdBulletDot: {
    fontSize: 14,
    color: '#FF1B6D',
    marginRight: 8,
    marginTop: 1,
  },
  mdHr: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  closePreviewButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default DrawerNavigator;
