import Share from 'react-native-share';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {Linking, Alert} from 'react-native';
import {requestPhotoLibraryPermission} from './permissions';

export type SharePlatform = 'instagram' | 'tiktok' | 'generic';

interface ShareToSocialOptions {
  fileUri: string;
  type?: string;
  title?: string;
  message?: string;
}

/**
 * Save to camera roll, then open the app via deep link.
 * Shows a "saved" alert if the app isn't installed.
 */
async function saveAndOpenApp(
  appScheme: string,
  appName: string,
  options: ShareToSocialOptions,
): Promise<void> {
  const {fileUri, type = 'image/jpeg'} = options;

  const hasPermission = await requestPhotoLibraryPermission();
  if (!hasPermission) {
    throw new Error('Photo library permission denied');
  }

  await CameraRoll.saveAsset(fileUri, {
    type: type.startsWith('video') ? 'video' : 'photo',
  });

  // Image is saved — from here on, don't throw (save already succeeded)
  try {
    const canOpen = await Linking.canOpenURL(appScheme);
    if (canOpen) {
      await Linking.openURL(appScheme);
    } else {
      Alert.alert(
        'Saved to Gallery',
        `Photo saved! Open ${appName} manually to share it.`,
      );
    }
  } catch {
    Alert.alert(
      'Saved to Gallery',
      `Photo saved! Open ${appName} manually to share it.`,
    );
  }
}

export async function shareToSocial(
  platform: SharePlatform,
  options: ShareToSocialOptions,
): Promise<void> {
  const {fileUri, type = 'image/jpeg', title = '', message = ''} = options;

  switch (platform) {
    case 'instagram': {
      await saveAndOpenApp('instagram://app', 'Instagram', options);
      break;
    }

    case 'tiktok': {
      await saveAndOpenApp('tiktok://', 'TikTok', options);
      break;
    }

    case 'generic': {
      await Share.open({url: fileUri, type, title, message});
      break;
    }
  }
}
