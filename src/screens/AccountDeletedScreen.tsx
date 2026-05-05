import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Logo from '../components/Logo';

interface AccountDeletedScreenProps {
  onContinue: () => void;
}

const AccountDeletedScreen: React.FC<AccountDeletedScreenProps> = ({onContinue}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const heartAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Icon pop-in
    Animated.spring(iconScale, {
      toValue: 1,
      tension: 50,
      friction: 6,
      useNativeDriver: true,
      delay: 300,
    }).start();

    // Content fade + slide
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        delay: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Gentle heartbeat on the wave icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(heartAnim, {
          toValue: 1.1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fadeAnim, slideAnim, iconScale, heartAnim]);

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f0f23']}
      style={styles.container}>
      {/* Decorative circles */}
      <View style={[styles.decorCircle, styles.decorCircle1]} />
      <View style={[styles.decorCircle, styles.decorCircle2]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.centerGroup}>
            {/* Animated wave icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                {transform: [{scale: Animated.multiply(iconScale, heartAnim)}]},
              ]}>
              <LinearGradient
                colors={['#FF1B6D', '#FF758C']}
                style={styles.iconGradient}>
                <Ionicons name="sad-outline" size={56} color="#fff" />
              </LinearGradient>
            </Animated.View>

            {/* Message content */}
            <Animated.View
              style={[
                styles.messageBlock,
                {
                  opacity: fadeAnim,
                  transform: [{translateY: slideAnim}],
                },
              ]}>
              <Text style={styles.title}>We're sad to see you go</Text>
              <Text style={styles.message}>
                Your account and all associated data have been permanently
                deleted.
              </Text>
              <Text style={styles.submessage}>
                Thank you for being part of the MagiShot community.
                {'\n'}We hope to see you again someday.
              </Text>

              <View style={styles.divider} />
            </Animated.View>
          </View>

          {/* Bottom: button + logo */}
          <Animated.View style={[styles.bottom, {opacity: fadeAnim}]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onContinue}
              style={styles.button}>
              <Text style={styles.buttonText}>Return to sign-in</Text>
            </TouchableOpacity>

            <View style={styles.logoContainer}>
              <Logo size={120} showBorder={false} />
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 27, 109, 0.06)',
  },
  decorCircle1: {
    width: 300,
    height: 300,
    top: -80,
    right: -100,
  },
  decorCircle2: {
    width: 200,
    height: 200,
    bottom: 60,
    left: -60,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  centerGroup: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 28,
    alignItems: 'center',
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 14,
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  submessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 27, 109, 0.4)',
    borderRadius: 1,
  },
  bottom: {
    paddingTop: 16,
  },
  button: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 27, 109, 0.7)',
    backgroundColor: 'rgba(255, 27, 109, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FF4A8A',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 24,
  },
});

export default AccountDeletedScreen;
