import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, TouchableOpacity} from 'react-native';
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

      <View style={styles.content}>
        {/* Animated wave icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            {transform: [{scale: Animated.multiply(iconScale, heartAnim)}]},
          ]}>
          <LinearGradient
            colors={['#FF1B6D', '#FF758C']}
            style={styles.iconGradient}>
            <Ionicons name="hand-left-outline" size={48} color="#fff" />
          </LinearGradient>
        </Animated.View>

        {/* Message content */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
            alignItems: 'center',
          }}>
          <Text style={styles.title}>We're sad to see you go</Text>
          <Text style={styles.message}>
            Your account and all associated data have been permanently deleted.
          </Text>
          <Text style={styles.submessage}>
            Thank you for being part of the MagiShot community.
            {'\n'}We hope to see you again someday.
          </Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* CTA */}
          <TouchableOpacity
            style={styles.button}
            onPress={onContinue}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#FF1B6D', '#FF758C']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.buttonGradient}>
              <Text style={styles.buttonText}>Got it</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Logo at bottom */}
        <Animated.View style={[styles.logoContainer, {opacity: fadeAnim}]}>
          <Logo size={80} showBorder={false} />
        </Animated.View>
      </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  submessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 21,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 27, 109, 0.3)',
    borderRadius: 1,
    marginVertical: 32,
  },
  button: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  logoContainer: {
    position: 'absolute',
    bottom: 50,
  },
});

export default AccountDeletedScreen;
