import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '../theme/ThemeContext';

interface LogoProps {
  size?: number;
}

const Logo: React.FC<LogoProps> = ({size = 100}) => {
  const {isDark} = useTheme();
  const fontSize = size * 0.14;

  return (
    <View style={styles.container}>
      {/* MagiShot as single line */}
      <Text style={[styles.logoText, {fontSize}]}>
        <Text style={styles.magiText}>Magi</Text>
        <Text style={[styles.shotText, {color: isDark ? '#FFFFFF' : '#1A1A2E'}]}>Shot</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  magiText: {
    color: '#FF1B6D',
  },
  shotText: {},
});

export default Logo;
