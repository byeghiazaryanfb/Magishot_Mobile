import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  useWindowDimensions,
  TouchableWithoutFeedback,
  Modal,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Background image - creative woman with camera
const BACKGROUND_IMAGE = require('../../assets/register_bg.jpg');

import {GoogleSignin} from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {registerUser, externalLogin, clearError} from '../store/slices/authSlice';
import Logo from '../components/Logo';
import {config} from '../utils/config';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onBack?: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({onNavigateToLogin, onBack}) => {
  const dispatch = useAppDispatch();
  const {isLoading, error} = useAppSelector(state => state.auth);
  const {width} = useWindowDimensions();

  // iPad detection and responsive sizing
  const isTablet = width >= 768;
  const formMaxWidth = isTablet ? 420 : width;
  const contentPadding = isTablet ? 40 : 24;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalModal, setLegalModal] = useState<{visible: boolean; title: string; content: string; isLoading: boolean}>({
    visible: false, title: '', content: '', isLoading: false,
  });
  const [errorDialog, setErrorDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({visible: false, title: '', message: ''});

  const showError = (title: string, message: string) => {
    setErrorDialog({visible: true, title, message});
  };

  const hideErrorDialog = () => {
    setErrorDialog(prev => ({...prev, visible: false}));
  };

  // Configure Google Sign-In
  useEffect(() => {
    // Only configure if you have a valid client ID
    // GoogleSignin.configure({
    //   iosClientId: 'YOUR_IOS_CLIENT_ID', // TODO: Replace with actual client ID
    // });
  }, []);

  // Clear error when component mounts
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const openLegalContent = async (type: 'terms' | 'privacy') => {
    const title = type === 'terms' ? 'Terms & Conditions' : 'Privacy Policy';
    const endpoint = type === 'terms' ? 'terms_and_conditions' : 'privacy_policy';
    setLegalModal({visible: true, title, content: '', isLoading: true});
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/SystemSettings/${endpoint}`);
      const json = await response.json();
      const markdown = json.value || json.content || '';
      setLegalModal(prev => ({...prev, content: markdown, isLoading: false}));
    } catch {
      setLegalModal(prev => ({...prev, content: 'Failed to load content. Please try again.', isLoading: false}));
    }
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <View key={index} style={{height: 10}} />;

      // Headings
      if (trimmed.startsWith('### ')) {
        return (
          <Text key={index} style={styles.mdH3}>
            {trimmed.replace(/^### /, '').replace(/\*\*/g, '')}
          </Text>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <Text key={index} style={styles.mdH2}>
            {trimmed.replace(/^## /, '').replace(/\*\*/g, '')}
          </Text>
        );
      }
      if (trimmed.startsWith('# ')) {
        return (
          <Text key={index} style={styles.mdH1}>
            {trimmed.replace(/^# /, '').replace(/\*\*/g, '')}
          </Text>
        );
      }

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(trimmed)) {
        return <View key={index} style={styles.mdHr} />;
      }

      // Bullet list
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <View key={index} style={styles.mdBulletRow}>
            <Text style={styles.mdBulletDot}>{'\u2022'}</Text>
            <Text style={styles.mdBody}>{renderInlineStyles(trimmed.slice(2))}</Text>
          </View>
        );
      }

      // Regular paragraph
      return (
        <Text key={index} style={styles.mdBody}>
          {renderInlineStyles(trimmed)}
        </Text>
      );
    });
  };

  const renderInlineStyles = (text: string) => {
    // Split by bold markers **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={i} style={styles.mdBold}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return part;
    });
  };

  const validateEmail = (emailStr: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const handleRegister = async () => {
    // Validation
    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      showError('Error', 'Please fill in all fields');
      return;
    }

    if (username.trim().length < 3) {
      showError('Error', 'Username must be at least 3 characters');
      return;
    }

    if (!validateEmail(email.trim())) {
      showError('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      showError('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      showError('Error', 'Passwords do not match');
      return;
    }

    if (!acceptedTerms) {
      showError('Terms & Conditions Required', 'Please read and accept our Terms & Conditions and Privacy Policy before creating your account. This helps protect both you and us.');
      return;
    }

    dispatch(
      registerUser({
        username: username.trim(),
        email: email.trim(),
        password: password,
        termsAccepted: true,
        privacyPolicyAccepted: true,
      }),
    );
  };

  const handleGoogleSignIn = async () => {
    if (!acceptedTerms) {
      showError('Terms & Conditions Required', 'Please read and accept our Terms & Conditions and Privacy Policy before continuing with Google.');
      return;
    }
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (response.data?.idToken) {
        const fullName = response.data.user.name || response.data.user.email || '';
        dispatch(
          externalLogin({
            provider: 'google',
            idToken: response.data.idToken,
            fullName: fullName,
            termsAccepted: true,
            privacyPolicyAccepted: true,
          }),
        );
      }
    } catch (err: any) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        console.error('Google Sign-In Error:', err);
        showError('Error', 'Google Sign-In failed. Please try again.');
      }
    }
  };

  const handleAppleSignIn = async () => {
    if (!acceptedTerms) {
      showError('Terms & Conditions Required', 'Please read and accept our Terms & Conditions and Privacy Policy before continuing with Apple.');
      return;
    }
    try {
      const appleAuthResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      const credentialState = await appleAuth.getCredentialStateForUser(
        appleAuthResponse.user,
      );

      if (credentialState === appleAuth.State.AUTHORIZED) {
        const fullName = appleAuthResponse.fullName
          ? `${appleAuthResponse.fullName.givenName || ''} ${
              appleAuthResponse.fullName.familyName || ''
            }`.trim()
          : '';

        dispatch(
          externalLogin({
            provider: 'apple',
            idToken: appleAuthResponse.identityToken || '',
            fullName: fullName || appleAuthResponse.email || '',
            termsAccepted: true,
            privacyPolicyAccepted: true,
          }),
        );
      }
    } catch (err: any) {
      if (err.code !== appleAuth.Error.CANCELED) {
        console.error('Apple Sign-In Error:', err);
        showError('Error', 'Apple Sign-In failed. Please try again.');
      }
    }
  };

  const renderContent = () => (
    <LinearGradient
      colors={
        BACKGROUND_IMAGE
          ? ['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)', '#0a0a0a']
          : ['#1a1a2e', '#16213e', '#0f0f23', '#0a0a0a']
      }
      locations={BACKGROUND_IMAGE ? [0, 0.15, 0.35, 0.5] : [0, 0.3, 0.6, 1]}
      style={styles.gradientOverlay}>
      <SafeAreaView style={styles.safeArea}>
        {/* Back Button */}
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              isTablet && styles.scrollContentTablet,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Form Container - centered with max width on iPad */}
            <View style={[
              styles.formContainer,
              isTablet && {maxWidth: formMaxWidth, paddingHorizontal: contentPadding},
            ]}>
              {/* Spacer to push content down */}
              <View style={BACKGROUND_IMAGE ? styles.topSpacer : styles.topSpacerNoImage} />

            {/* Logo */}
            <View style={styles.logoContainer}>
              <Logo size={180} />
              <Text style={styles.logoTagline}>AI-Powered Photo Magic</Text>
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Sign up to get started</Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#FF4757" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Form */}
            <View style={styles.form}>
              {/* Username Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color="rgba(255,255,255,0.5)"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

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
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>
              </View>

              {/* Password Input */}
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
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={password}
                    onChangeText={setPassword}
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
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(255,255,255,0.5)"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terms & Conditions */}
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAcceptedTerms(prev => !prev)}
                activeOpacity={0.7}>
                <Ionicons
                  name={acceptedTerms ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={acceptedTerms ? '#FF1B6D' : 'rgba(255,255,255,0.5)'}
                />
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => openLegalContent('terms')}>
                    Terms & Conditions
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => openLegalContent('privacy')}>
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>

              {/* Register Button */}
              <LinearGradient
                colors={['#FF1B6D', '#FF758C']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.registerButtonGradient}>
                <TouchableOpacity
                  style={styles.registerButton}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.9}>
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.registerButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            {/* Social Login Buttons */}
            <View style={styles.socialButtons}>
              {/* Google Sign-In */}
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                activeOpacity={0.8}>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Apple Sign-In (iOS only) */}
              {Platform.OS === 'ios' && appleAuth.isSupported && (
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                  activeOpacity={0.8}>
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={styles.socialButtonText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={onNavigateToLogin}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      {BACKGROUND_IMAGE ? (
        <ImageBackground
          source={BACKGROUND_IMAGE}
          style={styles.backgroundImage}
          resizeMode="cover">
          {renderContent()}
        </ImageBackground>
      ) : (
        renderContent()
      )}

      {/* Legal Content Modal */}
      <Modal
        visible={legalModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setLegalModal(prev => ({...prev, visible: false}))}>
        <View style={styles.legalModalOverlay}>
          <View style={styles.legalModalContainer}>
            <View style={styles.legalModalHeader}>
              <Text style={styles.legalModalTitle}>{legalModal.title}</Text>
              <TouchableOpacity
                onPress={() => setLegalModal(prev => ({...prev, visible: false}))}
                style={styles.legalModalClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {legalModal.isLoading ? (
              <View style={styles.legalModalLoading}>
                <ActivityIndicator size="large" color="#FF1B6D" />
              </View>
            ) : (
              <ScrollView
                style={styles.legalModalScroll}
                showsVerticalScrollIndicator={true}>
                {renderMarkdown(legalModal.content)}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.legalModalButton}
              onPress={() => setLegalModal(prev => ({...prev, visible: false}))}
              activeOpacity={0.8}>
              <Text style={styles.legalModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Dialog Overlay */}
      {errorDialog.visible && (
        <TouchableWithoutFeedback onPress={hideErrorDialog}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dialogContainer}>
                <View style={styles.dialogIconOuter}>
                  <View style={styles.dialogIconInner}>
                    <Ionicons name="alert-circle" size={28} color="#fff" />
                  </View>
                </View>
                <Text style={styles.dialogTitle}>{errorDialog.title}</Text>
                <Text style={styles.dialogMessage}>{errorDialog.message}</Text>
                <TouchableOpacity
                  style={styles.dialogButton}
                  onPress={hideErrorDialog}
                  activeOpacity={0.8}>
                  <Text style={styles.dialogButtonText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  scrollContentTablet: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  formContainer: {
    width: '100%',
  },
  topSpacer: {
    height: 20,
  },
  topSpacerNoImage: {
    height: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  logoTextContainer: {
    flexDirection: 'row',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  logoTextAccent: {
    color: '#FF1B6D',
  },
  logoTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
    letterSpacing: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF4757',
  },
  form: {
    gap: 12,
  },
  inputContainer: {
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.6)',
  },
  termsLink: {
    color: '#FF1B6D',
    fontWeight: '600',
  },
  registerButtonGradient: {
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  registerButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 20,
  },
  loginText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF1B6D',
  },
  legalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  legalModalContainer: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  legalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  legalModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  legalModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalModalLoading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  legalModalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  mdH1: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  mdH2: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  mdH3: {
    fontSize: 15,
    fontWeight: '700',
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
    fontWeight: '700',
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
  legalModalButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#FF1B6D',
  },
  legalModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#1a1a2e',
  },
  dialogIconOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF475720',
    marginBottom: 20,
  },
  dialogIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF4757',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#fff',
  },
  dialogMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    color: 'rgba(255,255,255,0.7)',
  },
  dialogButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#FF1B6D',
  },
  dialogButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RegisterScreen;
