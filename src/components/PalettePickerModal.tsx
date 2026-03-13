import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {useTheme, ColorPalette} from '../theme/ThemeContext';

interface PalettePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

const PalettePickerModal: React.FC<PalettePickerModalProps> = ({
  visible,
  onClose,
}) => {
  const {colors, isDark, currentPalette, setPalette, palettes} = useTheme();
  const {width} = useWindowDimensions();
  const isTablet = width >= 768;

  const handleSelectPalette = (palette: ColorPalette) => {
    setPalette(palette.id);
  };

  const renderPaletteItem = (palette: ColorPalette) => {
    const isSelected = currentPalette.id === palette.id;
    const paletteColors = isDark ? palette.dark : palette.light;

    return (
      <TouchableOpacity
        key={palette.id}
        style={[
          styles.paletteItem,
          {
            backgroundColor: isSelected
              ? paletteColors.primary + '20'
              : colors.backgroundTertiary,
            borderColor: isSelected ? paletteColors.primary : 'transparent',
          },
        ]}
        onPress={() => handleSelectPalette(palette)}
        activeOpacity={0.7}>
        {/* Color preview circles */}
        <View style={styles.colorPreview}>
          <View
            style={[
              styles.colorCircle,
              styles.colorCircleLarge,
              {backgroundColor: paletteColors.primary},
            ]}
          />
          <View
            style={[
              styles.colorCircle,
              styles.colorCircleMedium,
              {backgroundColor: paletteColors.secondary, marginLeft: -8},
            ]}
          />
          <View
            style={[
              styles.colorCircle,
              styles.colorCircleSmall,
              {backgroundColor: paletteColors.accent, marginLeft: -8},
            ]}
          />
        </View>

        {/* Palette info */}
        <View style={styles.paletteInfo}>
          <Text style={[styles.paletteIcon]}>{palette.icon}</Text>
          <Text
            style={[
              styles.paletteName,
              {color: isSelected ? paletteColors.primary : colors.textPrimary},
            ]}>
            {palette.name}
          </Text>
        </View>

        {/* Selected indicator */}
        {isSelected && (
          <View
            style={[
              styles.selectedBadge,
              {backgroundColor: paletteColors.primary},
            ]}>
            <Text style={styles.selectedBadgeText}>Active</Text>
          </View>
        )}

        {/* Background color preview bar */}
        <View style={styles.backgroundPreview}>
          <View
            style={[
              styles.bgPreviewItem,
              {backgroundColor: paletteColors.background},
            ]}
          />
          <View
            style={[
              styles.bgPreviewItem,
              {backgroundColor: paletteColors.backgroundSecondary},
            ]}
          />
          <View
            style={[
              styles.bgPreviewItem,
              {backgroundColor: paletteColors.backgroundTertiary},
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.cardBackground,
              maxWidth: isTablet ? 500 : '100%',
              height: '80%',
            },
          ]}>
          {/* Glass effect header */}
          <View style={styles.headerContainer}>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType={isDark ? 'materialDark' : 'materialLight'}
              blurAmount={10}
            />
            <View
              style={[styles.header, {borderBottomColor: colors.border}]}>
              <Text style={[styles.title, {color: colors.textPrimary}]}>
                Color Themes
              </Text>
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  {backgroundColor: colors.backgroundTertiary},
                ]}
                onPress={onClose}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={[styles.closeButtonText, {color: colors.textPrimary}]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Current theme indicator */}
          <View
            style={[
              styles.currentThemeBar,
              {backgroundColor: colors.backgroundTertiary},
            ]}>
            <Text style={[styles.currentThemeLabel, {color: colors.textSecondary}]}>
              Current: {currentPalette.icon} {currentPalette.name} ({isDark ? 'Dark' : 'Light'})
            </Text>
          </View>

          {/* Palettes list */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}>
            <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
              Choose a color theme
            </Text>
            {palettes && palettes.length > 0 ? (
              palettes.map(renderPaletteItem)
            ) : (
              <Text style={{color: colors.textPrimary, padding: 20}}>
                No palettes available
              </Text>
            )}

            <View style={styles.footer}>
              <Text style={[styles.footerText, {color: colors.textTertiary}]}>
                Theme colors adapt to your system's light/dark mode setting
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  headerContainer: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentThemeBar: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  currentThemeLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paletteItem: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  colorPreview: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  colorCircle: {
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  colorCircleLarge: {
    width: 40,
    height: 40,
  },
  colorCircleMedium: {
    width: 36,
    height: 36,
  },
  colorCircleSmall: {
    width: 32,
    height: 32,
  },
  paletteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paletteIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  paletteName: {
    fontSize: 18,
    fontWeight: '700',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  backgroundPreview: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bgPreviewItem: {
    flex: 1,
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default PalettePickerModal;
