import {Platform} from 'react-native';

let HapticFeedback: typeof import('react-native-haptic-feedback').default | null = null;

try {
  HapticFeedback = require('react-native-haptic-feedback').default;
} catch {
  // Module not available (e.g. iPad without Taptic Engine)
}

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const triggerHaptic = () => {
  if (!HapticFeedback || Platform.OS === 'web') return;
  try {
    HapticFeedback.trigger('impactMedium', options);
  } catch {
    // silently fail
  }
};
