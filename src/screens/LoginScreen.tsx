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
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Background image - stylish woman
const BACKGROUND_IMAGE = require('../../assets/login_bg.jpg');

import {GoogleSignin} from '@react-native-google-signin/google-signin';
import appleAuth, {
  AppleButton,
} from '@invertase/react-native-apple-authentication';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {loginUser, externalLogin, clearError} from '../store/slices/authSlice';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import Logo from '../components/Logo';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onBack?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({onNavigateToRegister, onBack}) => {
  const dispatch = useAppDispatch();
  const {isLoading, error} = useAppSelector(state => state.auth);
  const {width, height} = useWindowDimensions();

  // iPad detection and responsive sizing
  const isTablet = width >= 768;
  const formMaxWidth = isTablet ? 420 : width;
  const contentPadding = isTablet ? 40 : 24;

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
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
    GoogleSignin.configure({
      iosClientId: '162947759206-2mj47f5qfk79773kior2rmd0a7a572gk.apps.googleusercontent.com',
      webClientId: '162947759206-025i5kimrd2eekgu4d42nhm1dn92dv6k.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  // Clear error when component mounts
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleLogin = async () => {
    if (!usernameOrEmail.trim() || !password.trim()) {
      showError('Error', 'Please fill in all fields');
      return;
    }

    dispatch(
      loginUser({
        usernameOrEmail: usernameOrEmail.trim(),
        password: password,
      }),
    );
  };

  const handleGoogleSignIn = async () => {
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
          }),
        );
      }
    } catch (err: any) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        console.error('Google Sign-In Error:', err);
        showError('Google Sign-In Error', err.message || 'Failed to sign in with Google. Please try again.');
      }
    }
  };

  const handleAppleSignIn = async () => {
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
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue</Text>
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
                  {/* Email/Username Input */}
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
                        placeholder="Email or Username"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        value={usernameOrEmail}
                        onChangeText={setUsernameOrEmail}
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

                  {/* Forgot Password Link */}
                  <TouchableOpacity
                    style={styles.forgotPasswordButton}
                    onPress={() => setShowForgotPassword(true)}
                    activeOpacity={0.7}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  {/* Login Button */}
                  <LinearGradient
                    colors={['#FF1B6D', '#FF758C']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}
                    style={styles.loginButtonGradient}>
                    <TouchableOpacity
                      style={styles.loginButton}
                      onPress={handleLogin}
                      disabled={isLoading}
                      activeOpacity={0.9}>
                      {isLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.loginButtonText}>Login</Text>
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

                {/* Register Link */}
                <View style={styles.registerContainer}>
                  <Text style={styles.registerText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={onNavigateToRegister}>
                    <Text style={styles.registerLink}>Register</Text>
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
      <ForgotPasswordModal
        visible={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />

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
    marginBottom: 32,
  },
  logoTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    letterSpacing: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
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
    marginBottom: 20,
    gap: 8,
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF4757',
  },
  form: {
    gap: 16,
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#FF1B6D',
    fontWeight: '500',
  },
  loginButtonGradient: {
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  loginButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    paddingBottom: 20,
  },
  registerText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  registerLink: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF1B6D',
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

export default LoginScreen;
