import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const triggerHaptic = () => {
  try {
    console.log('[Haptic] triggering impactMedium');
    ReactNativeHapticFeedback.trigger('impactMedium', options);
    console.log('[Haptic] trigger called successfully');
  } catch (error) {
    console.warn('[Haptic] failed:', error);
  }
};
