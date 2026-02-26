import React, {useState, useRef} from 'react';
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
  TouchableWithoutFeedback,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api from '../services/api';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

type Step = 'email' | 'code' | 'password' | 'success' | 'error';

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  visible,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [previousStep, setPreviousStep] = useState<Step>('email');
  const [errorMessage, setErrorMessage] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState(15);

  // Refs for code inputs
  const codeInputRefs = useRef<(TextInput | null)[]>([]);

  const handleClose = () => {
    // Reset state when closing
    setEmail('');
    setCode(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setStep('email');
    setPreviousStep('email');
    setErrorMessage('');
    onClose();
  };

  const showError = (message: string, fromStep: Step) => {
    setErrorMessage(message);
    setPreviousStep(fromStep);
    setStep('error');
  };

  const handleSendCode = async () => {
    if (!email.trim()) {
      showError('Please enter your email address', 'email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError('Please enter a valid email address', 'email');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post<{expiresInMinutes: number; message: string}>(
        '/api/Auth/forgot-password',
        {email: email.trim()},
      );
      setExpiresInMinutes(response.expiresInMinutes || 15);
      setIsLoading(false);
      setStep('code');
    } catch (error: any) {
      setIsLoading(false);
      showError(error?.message || 'Failed to send reset code. Please try again.', 'email');
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (index: number, key: string) => {
    // Handle backspace
    if (key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      showError('Please enter the complete 6-digit code', 'code');
      return;
    }
    setStep('password');
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      showError('Please enter a new password', 'password');
      return;
    }

    if (newPassword.length < 6) {
      showError('Password must be at least 6 characters', 'password');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Passwords do not match', 'password');
      return;
    }

    setIsLoading(true);

    try {
      const fullCode = code.join('');
      await api.post('/api/Auth/reset-password', {
        token: fullCode,
        newPassword: newPassword,
      });
      setIsLoading(false);
      setStep('success');
    } catch (error: any) {
      setIsLoading(false);
      showError(error?.message || 'Failed to reset password. Please try again.', 'password');
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const response = await api.post<{expiresInMinutes: number; message: string}>(
        '/api/Auth/forgot-password',
        {email: email.trim()},
      );
      setExpiresInMinutes(response.expiresInMinutes || 15);
      setIsLoading(false);
      setCode(['', '', '', '', '', '']);
      // Focus first input
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      setIsLoading(false);
      showError(error?.message || 'Failed to resend code. Please try again.', 'code');
    }
  };

  const renderEmailStep = () => (
    <>
      {/* Header */}
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={['#FF1B6D', '#FF758C']}
          style={styles.iconGradient}>
          <Ionicons name="key-outline" size={32} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={styles.title}>Forgot Password?</Text>
      <Text style={styles.subtitle}>
        Enter your email address and we'll send you a 6-digit code to reset your password.
      </Text>

      {/* Email Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="mail-outline"
            size={20}
            color="rgba(255,255,255,0.5)"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoFocus
          />
        </View>
      </View>

      {/* Send Button */}
      <LinearGradient
        colors={['#FF1B6D', '#FF758C']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.sendButtonGradient}>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendCode}
          disabled={isLoading}
          activeOpacity={0.9}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.sendButtonText}>Send Code</Text>
            </>
          )}
        </TouchableOpacity>
      </LinearGradient>

      {/* Back to Login */}
      <TouchableOpacity style={styles.backButton} onPress={handleClose}>
        <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
        <Text style={styles.backButtonText}>Back to Login</Text>
      </TouchableOpacity>
    </>
  );

  const renderCodeStep = () => (
    <>
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={['#FF1B6D', '#FF758C']}
          style={styles.iconGradient}>
          <Ionicons name="keypad-outline" size={32} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={styles.title}>Enter Code</Text>
      <Text style={styles.subtitle}>
        We've sent a 6-digit code to{'\n'}
        <Text style={styles.emailHighlight}>{email}</Text>
      </Text>

      {/* Code Input */}
      <View style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={ref => (codeInputRefs.current[index] = ref)}
            style={[
              styles.codeInput,
              digit && styles.codeInputFilled,
            ]}
            value={digit}
            onChangeText={value => handleCodeChange(index, value)}
            onKeyPress={({nativeEvent}) => handleCodeKeyPress(index, nativeEvent.key)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>

      <Text style={styles.expiresText}>
        Code expires in {expiresInMinutes} minutes
      </Text>

      {/* Verify Button */}
      <LinearGradient
        colors={['#FF1B6D', '#FF758C']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.sendButtonGradient}>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleVerifyCode}
          disabled={isLoading}
          activeOpacity={0.9}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Verify Code</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>

      {/* Resend Code */}
      <TouchableOpacity
        style={styles.resendButton}
        onPress={handleResendCode}
        disabled={isLoading}
        activeOpacity={0.7}>
        <Text style={styles.resendButtonText}>
          Didn't receive the code? <Text style={styles.resendLink}>Resend</Text>
        </Text>
      </TouchableOpacity>

      {/* Back */}
      <TouchableOpacity style={styles.backButton} onPress={() => setStep('email')}>
        <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
        <Text style={styles.backButtonText}>Change Email</Text>
      </TouchableOpacity>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={['#FF1B6D', '#FF758C']}
          style={styles.iconGradient}>
          <Ionicons name="lock-closed-outline" size={32} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={styles.title}>New Password</Text>
      <Text style={styles.subtitle}>
        Create a strong password for your account
      </Text>

      {/* New Password Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="rgba(255,255,255,0.5)"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="rgba(255,255,255,0.5)"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Confirm Password Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="rgba(255,255,255,0.5)"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Reset Button */}
      <LinearGradient
        colors={['#FF1B6D', '#FF758C']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.sendButtonGradient}>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleResetPassword}
          disabled={isLoading}
          activeOpacity={0.9}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.sendButtonText}>Reset Password</Text>
            </>
          )}
        </TouchableOpacity>
      </LinearGradient>

      {/* Back */}
      <TouchableOpacity style={styles.backButton} onPress={() => setStep('code')}>
        <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <View style={styles.iconContainer}>
        <View style={[styles.iconGradient, {backgroundColor: '#10B981'}]}>
          <Ionicons name="checkmark" size={40} color="#fff" />
        </View>
      </View>

      <Text style={styles.title}>Password Reset!</Text>
      <Text style={styles.subtitle}>
        Your password has been successfully reset. You can now log in with your new password.
      </Text>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={handleClose}
        activeOpacity={0.8}>
        <Text style={styles.doneButtonText}>Back to Login</Text>
      </TouchableOpacity>
    </>
  );

  const renderErrorStep = () => (
    <>
      <View style={styles.iconContainer}>
        <View style={[styles.iconGradient, {backgroundColor: '#FF4757'}]}>
          <Ionicons name="alert-circle" size={40} color="#fff" />
        </View>
      </View>

      <Text style={styles.title}>Oops!</Text>
      <Text style={styles.subtitle}>{errorMessage}</Text>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => setStep(previousStep)}
        activeOpacity={0.8}>
        <Text style={styles.doneButtonText}>Try Again</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlayBackground} />
        </TouchableWithoutFeedback>
        <View style={styles.container}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {step === 'email' && renderEmailStep()}
          {step === 'code' && renderCodeStep()}
          {step === 'password' && renderPasswordStep()}
          {step === 'success' && renderSuccessStep()}
          {step === 'error' && renderErrorStep()}
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
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  container: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iconContainer: {
    marginTop: 8,
    marginBottom: 20,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  emailHighlight: {
    color: '#FF1B6D',
    fontWeight: '600',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    color: '#fff',
  },
  eyeButton: {
    padding: 8,
    marginRight: -8,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
    width: '100%',
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: '#FF1B6D',
    backgroundColor: 'rgba(255,27,109,0.1)',
  },
  expiresText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
  },
  sendButtonGradient: {
    width: '100%',
    borderRadius: 14,
    marginBottom: 16,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  backButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
  },
  resendButton: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  resendButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  resendLink: {
    color: '#FF1B6D',
    fontWeight: '600',
  },
  doneButton: {
    width: '100%',
    backgroundColor: '#FF1B6D',
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

export default ForgotPasswordModal;
