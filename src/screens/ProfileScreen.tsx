import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../theme/ThemeContext';
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {logoutUser, fetchUserInfo} from '../store/slices/authSlice';
import EditProfileModal from '../components/EditProfileModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import PaywallScreen from './PaywallScreen';

interface ProfileOptionProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
}

const ProfileOption: React.FC<ProfileOptionProps> = ({
  icon,
  label,
  value,
  onPress,
  showArrow = true,
}) => {
  const {colors} = useTheme();

  return (
    <TouchableOpacity
      style={[styles.optionItem, {backgroundColor: colors.cardBackground}]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}>
      <View style={styles.optionLeft}>
        <View style={[styles.optionIconContainer, {backgroundColor: colors.primary + '20'}]}>
          <Ionicons name={icon as any} size={20} color={colors.primary} />
        </View>
        <Text style={[styles.optionLabel, {color: colors.textPrimary}]}>{label}</Text>
      </View>
      <View style={styles.optionRight}>
        {value && (
          <Text style={[styles.optionValue, {color: colors.textSecondary}]}>{value}</Text>
        )}
        {showArrow && onPress && (
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const dispatch = useAppDispatch();
  const {
    username,
    email,
    firstName,
    lastName,
    profilePictureUrl,
    refreshToken,
    accessToken,
    isLoadingUserInfo,
    coinBalance,
  } = useAppSelector(state => state.auth);

  // Fetch user info on mount
  useEffect(() => {
    if (accessToken) {
      dispatch(fetchUserInfo(accessToken));
    }
  }, [accessToken, dispatch]);

  // State for modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // State for custom dialogs
  const [infoDialog, setInfoDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    icon: string;
    iconColor: string;
  }>({visible: false, title: '', message: '', icon: 'information-circle', iconColor: ''});

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    icon: string;
    iconColor: string;
    confirmText: string;
    confirmColor: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    icon: 'alert-circle',
    iconColor: '',
    confirmText: 'Confirm',
    confirmColor: '',
    onConfirm: () => {},
  });

  const showInfo = (title: string, message: string, icon = 'information-circle') => {
    setInfoDialog({
      visible: true,
      title,
      message,
      icon,
      iconColor: colors.primary,
    });
  };

  const hideInfoDialog = () => {
    setInfoDialog(prev => ({...prev, visible: false}));
  };

  const showConfirm = (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void,
    isDanger = false,
  ) => {
    setConfirmDialog({
      visible: true,
      title,
      message,
      icon: isDanger ? 'warning' : 'help-circle',
      iconColor: isDanger ? colors.error : colors.warning,
      confirmText,
      confirmColor: isDanger ? colors.error : colors.primary,
      onConfirm,
    });
  };

  const hideConfirmDialog = () => {
    setConfirmDialog(prev => ({...prev, visible: false}));
  };

  // Get display name (prefer first/last name if available)
  const displayName = firstName && lastName
    ? `${firstName} ${lastName}`
    : firstName || lastName || username || 'User';

  const handleBack = () => {
    navigation.goBack();
  };

  const handleLogout = () => {
    showConfirm(
      'Logout',
      'Are you sure you want to logout?',
      'Logout',
      () => {
        hideConfirmDialog();
        dispatch(logoutUser(refreshToken || undefined));
      },
      true,
    );
  };

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleChangePassword = () => {
    setShowChangePasswordModal(true);
  };

  const handlePrivacySettings = () => {
    showInfo('Coming Soon', 'Privacy settings will be available soon!', 'time-outline');
  };

  const handleDeleteAccount = () => {
    showConfirm(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      'Delete',
      () => {
        hideConfirmDialog();
        showInfo('Coming Soon', 'Account deletion will be available soon.', 'time-outline');
      },
      true,
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.backgroundSecondary}]}>
        <TouchableOpacity
          style={[styles.backButton, {backgroundColor: colors.backgroundTertiary}]}
          onPress={handleBack}
          activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.profileCard, {backgroundColor: colors.cardBackground}]}>
          {profilePictureUrl ? (
            <Image
              source={{uri: profilePictureUrl}}
              style={styles.avatarImage}
            />
          ) : (
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.avatarGradient}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <View style={styles.profileInfo}>
            {isLoadingUserInfo ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Text style={[styles.profileName, {color: colors.textPrimary}]}>
                  {displayName}
                </Text>
                <Text style={[styles.profileEmail, {color: colors.textSecondary}]}>
                  {email || 'No email provided'}
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={[styles.editButton, {backgroundColor: colors.primary}]}
            onPress={handleEditProfile}
            activeOpacity={0.8}>
            <Ionicons name="pencil" size={16} color="#fff" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>ACCOUNT</Text>
          <View style={styles.optionsGroup}>
            <ProfileOption
              icon="person-outline"
              label="Username"
              value={username || 'Not set'}
              showArrow={false}
            />
            {(firstName || lastName) && (
              <ProfileOption
                icon="text-outline"
                label="Full Name"
                value={`${firstName || ''} ${lastName || ''}`.trim() || 'Not set'}
                showArrow={false}
              />
            )}
            <ProfileOption
              icon="mail-outline"
              label="Email"
              value={email || 'Not set'}
              showArrow={false}
            />
            <ProfileOption
              icon="lock-closed-outline"
              label="Change Password"
              onPress={handleChangePassword}
            />
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>SUBSCRIPTION</Text>
          {coinBalance !== null && (
            <View style={[styles.coinBalanceCard, {backgroundColor: colors.cardBackground}]}>
              <View style={[styles.coinBalanceIcon, {backgroundColor: '#FFD700' + '20'}]}>
                <Ionicons name="star" size={20} color="#FFD700" />
              </View>
              <View style={styles.coinBalanceInfo}>
                <Text style={[styles.coinBalanceValue, {color: colors.textPrimary}]}>
                  {coinBalance} Coins
                </Text>
                <Text style={[styles.coinBalanceLabel, {color: colors.textSecondary}]}>
                  Available balance
                </Text>
              </View>
            </View>
          )}
          <View style={[styles.subscriptionCard, {backgroundColor: colors.cardBackground}]}>
            <View style={styles.subscriptionLeft}>
              <View style={[styles.planBadge, {backgroundColor: colors.warning + '20'}]}>
                <Ionicons name="star" size={16} color={colors.warning} />
                <Text style={[styles.planBadgeText, {color: colors.warning}]}>Free Plan</Text>
              </View>
              <Text style={[styles.subscriptionDesc, {color: colors.textSecondary}]}>
                Upgrade to unlock all features
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.upgradeButton, {backgroundColor: colors.primary}]}
              activeOpacity={0.8}
              onPress={() => setShowPaywall(true)}>
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>PRIVACY</Text>
          <View style={styles.optionsGroup}>
            <ProfileOption
              icon="shield-outline"
              label="Privacy Settings"
              onPress={handlePrivacySettings}
            />
            <ProfileOption
              icon="document-text-outline"
              label="Terms of Service"
              onPress={() => showInfo('Coming Soon', 'Terms of Service will be available soon!', 'time-outline')}
            />
            <ProfileOption
              icon="information-circle-outline"
              label="Privacy Policy"
              onPress={() => showInfo('Coming Soon', 'Privacy Policy will be available soon!', 'time-outline')}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.error}]}>DANGER ZONE</Text>
          <View style={styles.optionsGroup}>
            <TouchableOpacity
              style={[styles.dangerOption, {backgroundColor: colors.error + '10'}]}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}>
              <View style={styles.optionLeft}>
                <View style={[styles.optionIconContainer, {backgroundColor: colors.error + '20'}]}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </View>
                <Text style={[styles.optionLabel, {color: colors.error}]}>Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, {borderColor: colors.error}]}
          onPress={handleLogout}
          activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutButtonText, {color: colors.error}]}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />

      {/* Info Dialog Overlay */}
      {infoDialog.visible && (
        <TouchableWithoutFeedback onPress={hideInfoDialog}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.dialogContainer, {backgroundColor: colors.cardBackground}]}>
                <View style={[styles.dialogIconOuter, {backgroundColor: infoDialog.iconColor + '20'}]}>
                  <View style={[styles.dialogIconInner, {backgroundColor: infoDialog.iconColor}]}>
                    <Ionicons name={infoDialog.icon as any} size={28} color="#fff" />
                  </View>
                </View>
                <Text style={[styles.dialogTitle, {color: colors.textPrimary}]}>
                  {infoDialog.title}
                </Text>
                <Text style={[styles.dialogMessage, {color: colors.textSecondary}]}>
                  {infoDialog.message}
                </Text>
                <TouchableOpacity
                  style={[styles.dialogButton, {backgroundColor: colors.primary}]}
                  onPress={hideInfoDialog}
                  activeOpacity={0.8}>
                  <Text style={styles.dialogButtonText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Confirm Dialog Overlay */}
      {confirmDialog.visible && (
        <TouchableWithoutFeedback onPress={hideConfirmDialog}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.dialogContainer, {backgroundColor: colors.cardBackground}]}>
                <View style={[styles.dialogIconOuter, {backgroundColor: confirmDialog.iconColor + '20'}]}>
                  <View style={[styles.dialogIconInner, {backgroundColor: confirmDialog.iconColor}]}>
                    <Ionicons name={confirmDialog.icon as any} size={28} color="#fff" />
                  </View>
                </View>
                <Text style={[styles.dialogTitle, {color: colors.textPrimary}]}>
                  {confirmDialog.title}
                </Text>
                <Text style={[styles.dialogMessage, {color: colors.textSecondary}]}>
                  {confirmDialog.message}
                </Text>
                <View style={styles.dialogButtonRow}>
                  <TouchableOpacity
                    style={[styles.dialogButtonHalf, {backgroundColor: colors.backgroundTertiary}]}
                    onPress={hideConfirmDialog}
                    activeOpacity={0.8}>
                    <Text style={[styles.dialogButtonText, {color: colors.textPrimary}]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dialogButtonHalf, {backgroundColor: confirmDialog.confirmColor}]}
                    onPress={confirmDialog.onConfirm}
                    activeOpacity={0.8}>
                    <Text style={styles.dialogButtonText}>{confirmDialog.confirmText}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Paywall Overlay */}
      {showPaywall && (
        <View style={styles.paywallOverlay}>
          <PaywallScreen
            onClose={() => setShowPaywall(false)}
            onPurchase={(planId) => {
              console.log('Purchase plan:', planId);
              setShowPaywall(false);
            }}
          />
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  avatarGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  optionsGroup: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionValue: {
    fontSize: 14,
  },
  coinBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  coinBalanceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinBalanceInfo: {
    flex: 1,
  },
  coinBalanceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  coinBalanceLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
  },
  subscriptionLeft: {
    flex: 1,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginBottom: 8,
  },
  planBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionDesc: {
    fontSize: 13,
  },
  upgradeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dangerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    gap: 8,
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  dialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dialogContainer: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  dialogIconOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  dialogIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  dialogButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  dialogButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  dialogButtonHalf: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  dialogButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paywallOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
  },
});

export default ProfileScreen;
