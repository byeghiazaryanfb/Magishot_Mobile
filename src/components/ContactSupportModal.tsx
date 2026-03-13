import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import {useAppSelector} from '../store/hooks';
import emailService from '../services/emailService';

interface ContactSupportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

const subjectOptions = [
  {id: 'general', label: 'General Inquiry', icon: 'help-circle-outline'},
  {id: 'bug', label: 'Report a Bug', icon: 'bug-outline'},
  {id: 'feature', label: 'Feature Request', icon: 'bulb-outline'},
  {id: 'account', label: 'Account Issue', icon: 'person-outline'},
  {id: 'billing', label: 'Billing Question', icon: 'card-outline'},
  {id: 'other', label: 'Other', icon: 'chatbubble-outline'},
];

const ContactSupportModal: React.FC<ContactSupportModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onError,
}) => {
  const {colors} = useTheme();
  const {email, username, accessToken} = useAppSelector(state => state.auth);

  const [userEmail, setUserEmail] = useState(email || '');
  const [userName, setUserName] = useState(username || '');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setUserEmail(email || '');
      setUserName(username || '');
      setSelectedSubject(null);
      setMessage('');
      setValidationError(null);
    }
  }, [visible, email, username]);

  const handleSend = async () => {
    // Validation
    if (!userEmail.trim()) {
      setValidationError('Please enter your email address');
      return;
    }
    if (!selectedSubject) {
      setValidationError('Please select a subject');
      return;
    }
    if (!message.trim()) {
      setValidationError('Please enter your message');
      return;
    }

    setIsLoading(true);

    try {
      const subjectLabel = subjectOptions.find(s => s.id === selectedSubject)?.label || 'Support';
      console.log('Sending support email...');
      const response = await emailService.sendSupportEmail(
        userEmail.trim(),
        userName.trim() || 'Anonymous User',
        subjectLabel,
        message.trim(),
        accessToken || undefined,
      );
      console.log('Email sent successfully:', response);
      setIsLoading(false);
      // Close modal first, then trigger success callback
      onClose();
      // Small delay to ensure modal is closed before showing dialog
      setTimeout(() => {
        onSuccess?.();
      }, 300);
    } catch (error: any) {
      console.error('Failed to send email:', error);
      setIsLoading(false);
      const errorMessage = error?.message || 'Failed to send your message. Please try again.';
      // Close modal first, then trigger error callback
      onClose();
      setTimeout(() => {
        onError?.(errorMessage);
      }, 300);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <View style={[styles.container, {backgroundColor: colors.backgroundSecondary}]}>
          {/* Header */}
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <TouchableOpacity
              style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
              onPress={onClose}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              activeOpacity={0.7}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
              Contact Support
            </Text>
            <View style={styles.headerRight} />
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* Intro */}
            <View style={styles.introContainer}>
              <View style={[styles.introIcon, {backgroundColor: colors.primary + '20'}]}>
                <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.introTitle, {color: colors.textPrimary}]}>
                How can we help?
              </Text>
              <Text style={[styles.introSubtitle, {color: colors.textSecondary}]}>
                We typically respond within 24 hours
              </Text>
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
                Your Email
              </Text>
              <View style={[styles.inputContainer, {backgroundColor: colors.cardBackground, borderColor: colors.border}]}>
                <Ionicons name="mail-outline" size={20} color={colors.textTertiary} />
                <TextInput
                  style={[styles.textInput, {color: colors.textPrimary}]}
                  value={userEmail}
                  onChangeText={setUserEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
                Your Name (Optional)
              </Text>
              <View style={[styles.inputContainer, {backgroundColor: colors.cardBackground, borderColor: colors.border}]}>
                <Ionicons name="person-outline" size={20} color={colors.textTertiary} />
                <TextInput
                  style={[styles.textInput, {color: colors.textPrimary}]}
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Subject Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
                What's this about?
              </Text>
              <View style={styles.subjectGrid}>
                {subjectOptions.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.subjectOption,
                      {backgroundColor: colors.cardBackground, borderColor: colors.border},
                      selectedSubject === option.id && {
                        backgroundColor: colors.primary + '20',
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => setSelectedSubject(option.id)}
                    activeOpacity={0.7}>
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={selectedSubject === option.id ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.subjectLabel,
                        {color: selectedSubject === option.id ? colors.primary : colors.textPrimary},
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Message Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>
                Your Message
              </Text>
              <View style={[styles.messageContainer, {backgroundColor: colors.cardBackground, borderColor: colors.border}]}>
                <TextInput
                  style={[styles.messageInput, {color: colors.textPrimary}]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Describe your issue or question in detail..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>
              <Text style={[styles.charCount, {color: colors.textTertiary}]}>
                {message.length}/1000
              </Text>
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                {backgroundColor: colors.primary},
                isLoading && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={isLoading}
              activeOpacity={0.8}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.sendButtonText}>Send Message</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.bottomPadding} />
          </ScrollView>
        </View>

        {/* Validation Error Overlay */}
        {validationError && (
          <TouchableWithoutFeedback onPress={() => setValidationError(null)}>
            <View style={styles.errorOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.errorDialog, {backgroundColor: colors.backgroundSecondary}]}>
                  {/* Icon */}
                  <View style={[styles.errorIconOuter, {backgroundColor: '#FF475720'}]}>
                    <View style={[styles.errorIconInner, {backgroundColor: '#FF4757'}]}>
                      <Ionicons name="alert-circle" size={28} color="#fff" />
                    </View>
                  </View>

                  {/* Title */}
                  <Text style={[styles.errorTitle, {color: colors.textPrimary}]}>
                    Oops!
                  </Text>

                  {/* Message */}
                  <Text style={[styles.errorMessage, {color: colors.textSecondary}]}>
                    {validationError}
                  </Text>

                  {/* Button */}
                  <TouchableOpacity
                    style={[styles.errorButton, {backgroundColor: colors.primary}]}
                    onPress={() => setValidationError(null)}
                    activeOpacity={0.8}>
                    <Text style={styles.errorButtonText}>Got it</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        )}
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
    height: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
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
  introContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  introIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
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
  textInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subjectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  subjectLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  messageContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  messageInput: {
    fontSize: 16,
    minHeight: 120,
    padding: 0,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    marginTop: 8,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  errorIconOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorIconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  errorButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ContactSupportModal;
