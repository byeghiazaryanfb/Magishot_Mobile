import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {updateUserInfo, clearError} from '../store/slices/authSlice';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
}) => {
  const {colors} = useTheme();
  const dispatch = useAppDispatch();
  const {username, email, accessToken, isLoadingUserInfo, error} = useAppSelector(
    state => state.auth,
  );

  const [newUsername, setNewUsername] = useState(username || '');
  const [newEmail, setNewEmail] = useState(email || '');
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    type: 'success' | 'error';
    message: string;
  }>({visible: false, type: 'success', message: ''});

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setNewUsername(username || '');
      setNewEmail(email || '');
      setDialogState({visible: false, type: 'success', message: ''});
      dispatch(clearError());
    }
  }, [visible, username, email, dispatch]);

  const showDialog = (type: 'success' | 'error', message: string) => {
    setDialogState({visible: true, type, message});
  };

  const hideDialog = () => {
    setDialogState({visible: false, type: 'success', message: ''});
    if (dialogState.type === 'success') {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!accessToken) return;

    // Validate
    if (!newUsername.trim()) {
      showDialog('error', 'Username cannot be empty');
      return;
    }

    // Check if anything changed
    const hasUsernameChanged = newUsername.trim() !== username;
    const hasEmailChanged = newEmail.trim() !== email;

    if (!hasUsernameChanged && !hasEmailChanged) {
      onClose();
      return;
    }

    // Build update data
    const updateData: {username?: string; email?: string} = {};
    if (hasUsernameChanged) {
      updateData.username = newUsername.trim();
    }
    if (hasEmailChanged && newEmail.trim()) {
      updateData.email = newEmail.trim();
    }

    try {
      const result = await dispatch(
        updateUserInfo({accessToken, data: updateData}),
      ).unwrap();
      showDialog('success', 'Profile updated successfully');
    } catch (err) {
      // Error is handled by the reducer
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.container, {backgroundColor: colors.cardBackground}]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              Edit Profile
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
              onPress={onClose}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              activeOpacity={0.7}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Error message */}
          {error && (
            <View style={[styles.errorContainer, {backgroundColor: colors.error + '20'}]}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={[styles.errorText, {color: colors.error}]}>{error}</Text>
            </View>
          )}

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, {color: colors.textSecondary}]}>
              Username
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.backgroundTertiary,
                  borderColor: colors.border,
                },
              ]}>
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.textTertiary}
              />
              <TextInput
                style={[styles.input, {color: colors.textPrimary}]}
                value={newUsername}
                onChangeText={setNewUsername}
                placeholder="Enter username"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, {color: colors.textSecondary}]}>
              Email
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.backgroundTertiary,
                  borderColor: colors.border,
                },
              ]}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.textTertiary}
              />
              <TextInput
                style={[styles.input, {color: colors.textPrimary}]}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="Enter email"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              {backgroundColor: colors.primary},
              isLoadingUserInfo && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isLoadingUserInfo}
            activeOpacity={0.8}>
            {isLoadingUserInfo ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Custom Dialog Overlay */}
          {dialogState.visible && (
            <TouchableWithoutFeedback onPress={hideDialog}>
              <View style={styles.dialogOverlay}>
                <TouchableWithoutFeedback>
                  <View style={[styles.dialogContainer, {backgroundColor: colors.backgroundSecondary}]}>
                    <View style={[
                      styles.dialogIconOuter,
                      {backgroundColor: dialogState.type === 'success' ? '#10B98120' : '#FF475720'}
                    ]}>
                      <View style={[
                        styles.dialogIconInner,
                        {backgroundColor: dialogState.type === 'success' ? '#10B981' : '#FF4757'}
                      ]}>
                        <Ionicons
                          name={dialogState.type === 'success' ? 'checkmark' : 'alert-circle'}
                          size={28}
                          color="#fff"
                        />
                      </View>
                    </View>
                    <Text style={[styles.dialogTitle, {color: colors.textPrimary}]}>
                      {dialogState.type === 'success' ? 'Success!' : 'Oops!'}
                    </Text>
                    <Text style={[styles.dialogMessage, {color: colors.textSecondary}]}>
                      {dialogState.message}
                    </Text>
                    <TouchableOpacity
                      style={[styles.dialogButton, {backgroundColor: colors.primary}]}
                      onPress={hideDialog}
                      activeOpacity={0.8}>
                      <Text style={styles.dialogButtonText}>
                        {dialogState.type === 'success' ? 'Done' : 'Got it'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  container: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  dialogContainer: {
    width: '90%',
    maxWidth: 300,
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
  dialogButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditProfileModal;
