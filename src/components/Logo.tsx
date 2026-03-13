import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '../theme/ThemeContext';

interface LogoProps {
  size?: number;
  showBorder?: boolean;
}

const Logo: React.FC<LogoProps> = ({size = 100, showBorder = true}) => {
  const {isDark} = useTheme();
  const fontSize = size * 0.14;

  const content = (
    <Text style={[styles.logoText, {fontSize}]}>
      <Text style={styles.magiText}>Magi</Text>
      <Text style={[styles.shotText, {color: isDark ? '#FFFFFF' : '#1A1A2E'}]}>Shot</Text>
    </Text>
  );

  if (!showBorder) {
    return <View style={styles.container}>{content}</View>;
  }

  return (
    <View style={styles.container}>
      <View
        style={{
          borderWidth: 1,
          borderColor: 'rgba(255,100,150,0.45)',
          borderRadius: size,
          paddingHorizontal: size * 0.12,
          paddingVertical: size * 0.05,
        }}>
        {content}
      </View>
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
