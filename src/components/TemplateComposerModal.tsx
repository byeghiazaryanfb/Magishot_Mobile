import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {runOnJS} from 'react-native-reanimated';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ImageColors from 'react-native-image-colors';
import ColorPicker, {Panel1, HueSlider, Preview} from 'reanimated-color-picker';
import {useTheme} from '../theme/ThemeContext';
import GradientButton from './GradientButton';
import FullScreenImageModal from './FullScreenImageModal';
import {ImageAsset} from '../services/imageTransform';
import {useServicePrices} from '../hooks/useServicePrices';

interface MobileAppTemplate {
  id: string;
  name: string;
  description: string | null;
  jsonConfig: string;
  prompt: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  businessCategoryId: string | null;
  businessCategoryName: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface TemplateElement {
  key: string;
  label: string;
  sourceType: string;
  inputType: 'single-select';
  displayStyle: 'buttons' | 'dropdown';
  required: boolean;
  sortOrder: number;
  options: {id: string; title: string}[];
}

interface TemplateConfig {
  elements: TemplateElement[];
  backgroundColorRequired?: boolean;
  defaultBackgroundColor?: string;
  videoAnimationEnabled?: boolean;
}

interface TemplateComposerModalProps {
  visible: boolean;
  template: MobileAppTemplate | null;
  productPhoto: ImageAsset | null;
  onClose: () => void;
  onGenerate: (config: Record<string, any>) => void;
}

const ASPECT_RATIOS = [
  {value: '1:1', label: '1:1 Square'},
  {value: '9:16', label: '9:16 Story'},
  {value: '16:9', label: '16:9 Landscape'},
];

const VIDEO_ASPECT_RATIOS = [
  {value: '9:16', label: 'Reels', icon: 'phone-portrait-outline'},
  {value: '16:9', label: 'YouTube', icon: 'phone-landscape-outline'},
];

const SKIPPED_SOURCE_TYPES = ['Models', 'Resolutions'];

const TemplateComposerModal: React.FC<TemplateComposerModalProps> = ({
  visible,
  template,
  productPhoto,
  onClose,
  onGenerate,
}) => {
  const {colors} = useTheme();
  const {width} = useWindowDimensions();
  const isTablet = width >= 768;
  const {socialContentPrice, animationPrice} = useServicePrices();

  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [selectedBgColor, setSelectedBgColor] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [pendingColor, setPendingColor] = useState('#808080');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('9:16');
  const [aspectRatioOpen, setAspectRatioOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [creationAnimation, setCreationAnimation] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(VIDEO_ASPECT_RATIOS[0].value);
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thumbnailAspectRatio, setThumbnailAspectRatio] = useState<number>(16 / 9);

  const parsedConfig = useMemo<TemplateConfig | null>(() => {
    if (!template?.jsonConfig) return null;
    try {
      return JSON.parse(template.jsonConfig) as TemplateConfig;
    } catch {
      return null;
    }
  }, [template?.jsonConfig]);

  const visibleElements = useMemo(() => {
    if (!parsedConfig?.elements) return [];
    return parsedConfig.elements
      .filter(el => !SKIPPED_SOURCE_TYPES.includes(el.sourceType))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [parsedConfig]);

  // Extract colors from product photo
  useEffect(() => {
    if (!visible || !productPhoto?.uri) {
      setExtractedColors([]);
      return;
    }
    ImageColors.getColors(productPhoto.uri, {cache: true, key: productPhoto.uri})
      .then(result => {
        console.log('[ImageColors] result:', JSON.stringify(result));
        const colorValues: string[] = [];
        if (result.platform === 'android') {
          const r = result as any;
          [r.dominant, r.vibrant, r.darkVibrant, r.lightVibrant, r.muted, r.darkMuted]
            .forEach((c: string | undefined) => {
              if (c && !colorValues.includes(c)) colorValues.push(c);
            });
        } else if (result.platform === 'ios') {
          const r = result as any;
          [r.primary, r.secondary, r.background, r.detail]
            .forEach((c: string | undefined) => {
              if (c && !colorValues.includes(c)) colorValues.push(c);
            });
        }
        setExtractedColors(colorValues);
      })
      .catch(err => {
        console.log('[ImageColors] error:', err);
        setExtractedColors([]);
      });
  }, [visible, productPhoto?.uri]);

  // Detect thumbnail aspect ratio
  useEffect(() => {
    if (template?.thumbnailUrl) {
      Image.getSize(
        template.thumbnailUrl,
        (w, h) => setThumbnailAspectRatio(w / h),
        () => setThumbnailAspectRatio(16 / 9),
      );
    } else {
      setThumbnailAspectRatio(16 / 9);
    }
  }, [template?.thumbnailUrl]);

  // Reset state when template changes
  useEffect(() => {
    if (visible) {
      setSelectedBgColor(parsedConfig?.defaultBackgroundColor || null);
      setColorPickerOpen(false);
      setSelectedAspectRatio('9:16');
      setAspectRatioOpen(false);
      setCount(1);
      const initial: Record<string, string> = {};
      for (const el of visibleElements) {
        if (el.options.length > 0) {
          initial[el.key] = el.options[0].id;
        }
      }
      setSelections(initial);
      setOpenDropdowns({});
      setCreationAnimation(false);
      setVideoAspectRatio(VIDEO_ASPECT_RATIOS[0].value);
      setIsSubmitting(false);
    }
  }, [visible, template?.id]);

  const allRequiredFilled = useMemo(() => {
    if (!selectedAspectRatio) return false;
    for (const el of visibleElements) {
      if (el.required && !selections[el.key]) return false;
    }
    return true;
  }, [selectedAspectRatio, visibleElements, selections]);

  const handleGenerate = () => {
    setIsSubmitting(true);
    // Build replacements: element.key → selected option title
    const replacements: Record<string, string> = {};
    for (const el of visibleElements) {
      const selectedId = selections[el.key];
      if (selectedId) {
        const option = el.options.find(o => o.id === selectedId);
        if (option) {
          replacements[el.key] = option.title;
        }
      }
    }
    if (selectedBgColor) {
      replacements.color = selectedBgColor;
    }

    onGenerate({
      templateId: template!.id,
      replacements,
      aspectRatio: selectedAspectRatio,
      count,
      ...(parsedConfig?.videoAnimationEnabled && creationAnimation && {creationAnimation, videoAspectRatio}),
    });
  };

  if (!template) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTap} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, {backgroundColor: colors.background}]}>
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, {backgroundColor: colors.textTertiary}]} />
          </View>

          {/* Header */}
          <View
            style={[
              styles.header,
              {
                borderBottomColor: colors.border,
                paddingHorizontal: isTablet ? 32 : 16,
              },
            ]}>
            <Text
              style={[styles.headerTitle, {color: colors.textPrimary}]}
              numberOfLines={1}>
              {template.name}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, {backgroundColor: colors.backgroundTertiary}]}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              activeOpacity={0.7}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {paddingHorizontal: isTablet ? 32 : 16},
            ]}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled">
          {/* Template thumbnail */}
          {template.thumbnailUrl && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setFullScreenImageUri(template.thumbnailUrl!)}>
              <Image
                source={{uri: template.thumbnailUrl}}
                style={[styles.thumbnail, {aspectRatio: thumbnailAspectRatio}]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}

          {/* Background Color */}
          {parsedConfig?.backgroundColorRequired && (
            <>
              <Text style={[styles.sectionLabel, {color: colors.textPrimary}]}>
                Background Color
              </Text>
              <TouchableOpacity
                style={[
                  styles.paletteSwatch,
                  {backgroundColor: selectedBgColor || colors.backgroundTertiary},
                ]}
                onPress={() => {
                  setPendingColor(selectedBgColor || '#808080');
                  setColorPickerOpen(true);
                }}
                activeOpacity={0.7}
              />
            </>
          )}

          {/* Aspect Ratio */}
          <Text style={[styles.sectionLabel, {color: colors.textPrimary}]}>
            Aspect Ratio
          </Text>
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              {
                backgroundColor: colors.cardBackground,
                borderColor: aspectRatioOpen ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setAspectRatioOpen(prev => !prev)}
            activeOpacity={0.7}>
            <Text style={[styles.dropdownValue, {color: colors.textPrimary}]}>
              {ASPECT_RATIOS.find(a => a.value === selectedAspectRatio)?.label}
            </Text>
            <Ionicons
              name={aspectRatioOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          {aspectRatioOpen && (
            <View
              style={[
                styles.dropdownList,
                {backgroundColor: colors.cardBackground, borderColor: colors.border},
              ]}>
              {ASPECT_RATIOS.map(ar => {
                const isActive = selectedAspectRatio === ar.value;
                return (
                  <TouchableOpacity
                    key={ar.value}
                    style={[
                      styles.dropdownItem,
                      isActive && {backgroundColor: colors.primary + '20'},
                    ]}
                    onPress={() => {
                      setSelectedAspectRatio(ar.value);
                      setAspectRatioOpen(false);
                    }}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.dropdownItemText,
                        {color: isActive ? colors.primary : colors.textPrimary},
                      ]}>
                      {ar.label}
                    </Text>
                    {isActive && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Dynamic elements from jsonConfig */}
          {visibleElements.map(element => {
            const selectedOption = element.options.find(o => o.id === selections[element.key]);
            const isDropdownOpen = !!openDropdowns[element.key];

            return (
              <View key={element.key}>
                <Text style={[styles.sectionLabel, {color: colors.textPrimary}]}>
                  {element.label}
                </Text>

                {element.displayStyle === 'dropdown' ? (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.dropdownTrigger,
                        {
                          backgroundColor: colors.cardBackground,
                          borderColor: isDropdownOpen ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() =>
                        setOpenDropdowns(prev => ({...prev, [element.key]: !prev[element.key]}))
                      }
                      activeOpacity={0.7}>
                      <Text style={[styles.dropdownValue, {color: selectedOption ? colors.textPrimary : colors.textTertiary}]}>
                        {selectedOption?.title ?? 'Select...'}
                      </Text>
                      <Ionicons
                        name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    {isDropdownOpen && (
                      <View
                        style={[
                          styles.dropdownList,
                          {backgroundColor: colors.cardBackground, borderColor: colors.border},
                        ]}>
                        {element.options.map(option => {
                          const isActive = selections[element.key] === option.id;
                          return (
                            <TouchableOpacity
                              key={option.id}
                              style={[
                                styles.dropdownItem,
                                isActive && {backgroundColor: colors.primary + '20'},
                              ]}
                              onPress={() => {
                                setSelections(prev => ({...prev, [element.key]: option.id}));
                                setOpenDropdowns(prev => ({...prev, [element.key]: false}));
                              }}
                              activeOpacity={0.7}>
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  {color: isActive ? colors.primary : colors.textPrimary},
                                ]}>
                                {option.title}
                              </Text>
                              {isActive && (
                                <Ionicons name="checkmark" size={18} color={colors.primary} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.buttonRow}>
                    {element.options.map(option => {
                      const isActive = selections[element.key] === option.id;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.optionButton,
                            {
                              backgroundColor: isActive
                                ? colors.primary
                                : colors.backgroundTertiary,
                            },
                          ]}
                          onPress={() =>
                            setSelections(prev => ({...prev, [element.key]: option.id}))
                          }
                          activeOpacity={0.7}>
                          <Text
                            style={[
                              styles.optionButtonText,
                              {color: isActive ? '#fff' : colors.textSecondary},
                            ]}>
                            {option.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            );
          })}

          {/* Count selector */}
          <Text style={[styles.sectionLabel, {color: colors.textPrimary}]}>
            Number of Images
          </Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                {backgroundColor: colors.backgroundTertiary},
                count <= 1 && styles.stepperDisabled,
              ]}
              onPress={() => setCount(prev => Math.max(1, prev - 1))}
              disabled={count <= 1}
              activeOpacity={0.7}>
              <Ionicons
                name="remove"
                size={22}
                color={count <= 1 ? colors.textTertiary : colors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={[styles.stepperValue, {color: colors.textPrimary}]}>
              {count}
            </Text>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                {backgroundColor: colors.backgroundTertiary},
                count >= 4 && styles.stepperDisabled,
              ]}
              onPress={() => setCount(prev => Math.min(4, prev + 1))}
              disabled={count >= 4}
              activeOpacity={0.7}>
              <Ionicons
                name="add"
                size={22}
                color={count >= 4 ? colors.textTertiary : colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          {/* Creation Animation Checkbox */}
          {parsedConfig?.videoAnimationEnabled && (
            <>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setCreationAnimation(prev => !prev)}
                activeOpacity={0.7}>
                <Ionicons
                  name={creationAnimation ? 'checkbox' : 'square-outline'}
                  size={40}
                  color={creationAnimation ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.checkboxLabel, {color: colors.textPrimary}]}>
                  Creation Animation
                </Text>
              </TouchableOpacity>

              {/* Video Aspect Ratio - shown when animation is checked */}
              {creationAnimation && (
                <View style={styles.videoAspectRatioSection}>
                  <Text style={[styles.sectionLabel, {color: colors.textPrimary}]}>
                    Video Aspect Ratio
                  </Text>
                  <View style={styles.videoAspectRatioOptions}>
                    {VIDEO_ASPECT_RATIOS.map(option => {
                      const isSelected = videoAspectRatio === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.videoAspectRatioOption,
                            {
                              backgroundColor: isSelected
                                ? colors.primary + '18'
                                : colors.backgroundTertiary,
                              borderColor: isSelected
                                ? colors.primary
                                : colors.border,
                            },
                          ]}
                          onPress={() => setVideoAspectRatio(option.value)}
                          activeOpacity={0.7}>
                          <Ionicons
                            name={option.icon as any}
                            size={16}
                            color={isSelected ? colors.primary : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.videoAspectRatioText,
                              {color: isSelected ? colors.primary : colors.textSecondary},
                            ]}>
                            {option.label}
                          </Text>
                          <Text
                            style={[
                              styles.videoAspectRatioValue,
                              {color: isSelected ? colors.primary : colors.textTertiary},
                            ]}>
                            {option.value}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Spacer for bottom button */}
          <View style={{height: 80}} />
        </ScrollView>

        {/* Fixed generate button */}
        <SafeAreaView edges={['bottom']} style={[styles.footer, {backgroundColor: colors.background, borderTopColor: colors.border}]}>
          <View style={{paddingHorizontal: isTablet ? 32 : 16, paddingVertical: 12}}>
            <GradientButton
              title={(() => {
                if (isSubmitting) return 'Submitting...';
                const baseCoins = (socialContentPrice?.estimatedCoins || 0) * count;
                const animCoins = creationAnimation && animationPrice && !animationPrice.isFree
                  ? (animationPrice.estimatedCoins || 0)
                  : 0;
                const total = baseCoins + animCoins;
                const allFree = socialContentPrice?.isFree && (!creationAnimation || animationPrice?.isFree);
                if (allFree) return 'Generate (Free)';
                if (total > 0) return `Generate (${total} ★)`;
                return 'Generate';
              })()}
              onPress={handleGenerate}
              disabled={!allRequiredFilled || isSubmitting}
              loading={isSubmitting}
            />
          </View>
        </SafeAreaView>

        {/* Full Screen Image Modal */}
        <FullScreenImageModal
          visible={!!fullScreenImageUri}
          imageUri={fullScreenImageUri}
          onClose={() => setFullScreenImageUri(null)}
        />

        {/* Color Picker Popup */}
        {colorPickerOpen && (
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setColorPickerOpen(false)}>
            <View
              style={[styles.pickerSheet, {backgroundColor: colors.background}]}
              onStartShouldSetResponder={() => true}>
              <Text style={[styles.pickerTitle, {color: colors.textPrimary}]}>
                Pick a Background Color
              </Text>

              <ColorPicker
                value={selectedBgColor || '#808080'}
                onChange={({hex}) => {
                  'worklet';
                  runOnJS(setPendingColor)(hex);
                }}>
                <Preview hideInitialColor />
                <Panel1 style={styles.colorPanel} />
                <HueSlider style={styles.hueSlider} />
              </ColorPicker>

              <View style={styles.pickerActions}>
                <TouchableOpacity
                  style={[styles.pickerActionButton, {backgroundColor: colors.backgroundTertiary}]}
                  onPress={() => {
                    setSelectedBgColor(null);
                    setColorPickerOpen(false);
                  }}
                  activeOpacity={0.7}>
                  <Text style={[styles.pickerActionText, {color: colors.textSecondary}]}>
                    Clear
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerActionButton, {backgroundColor: colors.primary}]}
                  onPress={() => {
                    setSelectedBgColor(pendingColor);
                    setColorPickerOpen(false);
                  }}
                  activeOpacity={0.7}>
                  <Text style={[styles.pickerActionText, {color: '#fff'}]}>
                    Select
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  thumbnail: {
    width: '100%',
    borderRadius: 12,
    marginBottom: 20,
  },
  paletteSwatch: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 16,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownList: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 15,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  buttonRow: {
    gap: 8,
    paddingBottom: 4,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  videoAspectRatioSection: {
    marginTop: 12,
  },
  videoAspectRatioOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  videoAspectRatioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  videoAspectRatioText: {
    fontSize: 13,
    fontWeight: '600',
  },
  videoAspectRatioValue: {
    fontSize: 11,
    fontWeight: '500',
  },
  footer: {
    borderTopWidth: 1,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  pickerSheet: {
    width: '85%',
    borderRadius: 20,
    padding: 20,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  colorPanel: {
    borderRadius: 12,
    marginBottom: 12,
  },
  hueSlider: {
    borderRadius: 12,
    marginBottom: 16,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickerActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default TemplateComposerModal;
