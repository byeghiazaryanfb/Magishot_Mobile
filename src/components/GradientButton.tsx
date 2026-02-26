import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../theme/ThemeContext';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  colors?: string[];
}

const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  disabled = false,
  style,
  textStyle,
  colors,
}) => {
  const {colors: themeColors} = useTheme();

  const gradientColors = colors || [
    themeColors.gradientStart,
    themeColors.gradientEnd,
  ];

  return (
    <LinearGradient
      colors={disabled ? ['#666', '#444'] : gradientColors}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 0}}
      style={[styles.container, style, disabled && styles.disabled]}>
      <TouchableOpacity
        style={styles.touchable}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.9}>
        <Text style={[styles.text, textStyle]}>{title}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    shadowColor: '#FF1B6D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  touchable: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
});

export default GradientButton;
