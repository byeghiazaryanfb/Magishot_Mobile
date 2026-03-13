import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';

const ASPECT_RATIOS = [
  {value: '9:16', label: 'Story', icon: 'phone-portrait-outline'},
  {value: '16:9', label: 'Landscape', icon: 'phone-landscape-outline'},
  {value: '1:1', label: 'Square', icon: 'square-outline'},
];

interface AspectRatioPickerProps {
  selected: string;
  onSelect: (value: string) => void;
}

const AspectRatioPicker: React.FC<AspectRatioPickerProps> = ({selected, onSelect}) => {
  const {colors} = useTheme();

  return (
    <View style={styles.container}>
      {ASPECT_RATIOS.map(ratio => {
        const isActive = selected === ratio.value;
        return (
          <TouchableOpacity
            key={ratio.value}
            style={[
              styles.option,
              {
                backgroundColor: isActive ? colors.primary + '20' : colors.backgroundTertiary,
                borderColor: isActive ? colors.primary : 'transparent',
              },
            ]}
            onPress={() => onSelect(ratio.value)}
            activeOpacity={0.7}>
            <Ionicons
              name={ratio.icon as any}
              size={14}
              color={isActive ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.label,
                {color: isActive ? colors.primary : colors.textSecondary},
              ]}>
              {ratio.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default AspectRatioPicker;
