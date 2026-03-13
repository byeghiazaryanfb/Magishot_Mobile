import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '../theme/ThemeContext';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  colors?: string[];
}

const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  colors,
}) => {
  const {colors: themeColors} = useTheme();

  const isDisabled = disabled || loading;

  const gradientColors = colors || [
    themeColors.gradientStart,
    themeColors.gradientEnd,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[style]}>
      <LinearGradient
        colors={disabled && !loading ? ['#666', '#444'] : gradientColors}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={[styles.container, disabled && !loading && styles.disabled, loading && styles.loading]}>
        <View style={styles.touchable}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={[styles.text, textStyle]}>{title}</Text>
            </View>
          ) : (
            <Text style={[styles.text, textStyle]}>{title}</Text>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
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
  loading: {
    shadowOpacity: 0,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default GradientButton;
