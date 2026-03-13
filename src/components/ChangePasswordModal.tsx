import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {useAppSelector} from '../store/hooks';
import api from '../services/api';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

type Step = 'form' | 'success';

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onError,
}) => {
  const {colors} = useTheme();
  const {accessToken} = useAppSelector(state => state.auth);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [errorMessage, setErrorMessage] = useState('');

  const handleClose = () => {
    // Reset state when closing
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setStep('form');
    setErrorMessage('');
    onClose();
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword.trim()) {
      setErrorMessage('Please enter your current password');
      return;
    }

    if (!newPassword.trim()) {
      setErrorMessage('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage('New password must be different from current password');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      await api.put(
        '/api/auth/change-password',
        {
          currentPassword: currentPassword,
          newPassword: newPassword,
        },
        accessToken || undefined,
      );
      setIsLoading(false);
      setStep('success');
    } catch (error: any) {
      setIsLoading(false);
      const message = error?.message || 'Failed to change password. Please try again.';
      setErrorMessage(message);
    }
  };

  const handleSuccessClose = () => {
    handleClose();
    onSuccess?.();
  };

  const renderForm = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
          onPress={handleClose}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          activeOpacity={0.7}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
          Change Password
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, {backgroundColor: colors.primary + '20'}]}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.primary} />
          </View>
        </View>

        <Text style={[styles.description, {color: colors.textSecondary}]}>
          Enter your current password and choose a new secure password
        </Text>

        {/* Error Message */}
        {errorMessage ? (
          <View style={[styles.errorContainer, {backgroundColor: colors.error + '15'}]}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={[styles.errorText, {color: colors.error}]}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Current Password */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
            Current Password
          </Text>
          <View style={[styles.inputWrapper, {backgroundColor: colors.cardBackground, borderColor: colors.border}]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, {color: colors.textPrimary}]}
              placeholder="Enter current password"
              placeholderTextColor={colors.textTertiary}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrentPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              style={styles.eyeButton}>
              <Ionicons
                name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* New Password */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
            New Password
          </Text>
          <View style={[styles.inputWrapper, {backgroundColor: colors.cardBackground, borderColor: colors.border}]}>
            <Ionicons name="key-outline" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, {color: colors.textPrimary}]}
              placeholder="Enter new password"
              placeholderTextColor={colors.textTertiary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              style={styles.eyeButton}>
              <Ionicons
                name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm New Password */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
            Confirm New Password
          </Text>
          <View style={[styles.inputWrapper, {backgroundColor: colors.cardBackground, borderColor: colors.border}]}>
            <Ionicons name="key-outline" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, {color: colors.textPrimary}]}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textTertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Password Requirements */}
        <View style={[styles.requirementsContainer, {backgroundColor: colors.cardBackground}]}>
          <Text style={[styles.requirementsTitle, {color: colors.textPrimary}]}>
            Password Requirements:
          </Text>
          <View style={styles.requirementRow}>
            <Ionicons
              name={newPassword.length >= 6 ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={newPassword.length >= 6 ? '#10B981' : colors.textTertiary}
            />
            <Text style={[styles.requirementText, {color: colors.textSecondary}]}>
              At least 6 characters
            </Text>
          </View>
          <View style={styles.requirementRow}>
            <Ionicons
              name={newPassword && newPassword === confirmPassword ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={newPassword && newPassword === confirmPassword ? '#10B981' : colors.textTertiary}
            />
            <Text style={[styles.requirementText, {color: colors.textSecondary}]}>
              Passwords match
            </Text>
          </View>
        </View>

        {/* Change Password Button */}
        <TouchableOpacity
          style={[styles.changeButton, {backgroundColor: colors.primary}]}
          onPress={handleChangePassword}
          disabled={isLoading}
          activeOpacity={0.8}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.changeButtonText}>Change Password</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </>
  );

  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <View style={[styles.successIcon, {backgroundColor: '#10B98120'}]}>
        <Ionicons name="checkmark-circle" size={64} color="#10B981" />
      </View>
      <Text style={[styles.successTitle, {color: colors.textPrimary}]}>
        Password Changed!
      </Text>
      <Text style={[styles.successMessage, {color: colors.textSecondary}]}>
        Your password has been successfully updated. Use your new password next time you log in.
      </Text>
      <TouchableOpacity
        style={[styles.doneButton, {backgroundColor: colors.primary}]}
        onPress={handleSuccessClose}
        activeOpacity={0.8}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <View style={[styles.container, {backgroundColor: colors.backgroundSecondary}]}>
          {step === 'form' && renderForm()}
          {step === 'success' && renderSuccess()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  eyeButton: {
    padding: 4,
  },
  requirementsContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  successContainer: {
    alignItems: 'center',
    padding: 32,
    paddingTop: 48,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  doneButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChangePasswordModal;
