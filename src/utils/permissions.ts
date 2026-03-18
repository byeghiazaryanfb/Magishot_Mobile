import {Platform, PermissionsAndroid, Linking, Alert} from 'react-native';
import {iosRequestAddOnlyGalleryPermission} from '@react-native-camera-roll/camera-roll';

/**
 * Request photo library write permission.
 * Returns true if granted, false if denied.
 * On iOS, requests "Add Photos Only" permission via CameraRoll API.
 * On Android < 13, explicitly requests WRITE_EXTERNAL_STORAGE.
 */
export async function requestPhotoLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const result = await iosRequestAddOnlyGalleryPermission();
    return result === 'granted' || result === 'limited';
  }

  // Android 13+ (API 33) doesn't need WRITE_EXTERNAL_STORAGE for media
  const version = Platform.Version as number;
  if (version >= 33) return true;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Storage Permission',
      message: 'MagiShot needs access to save media to your device.',
      buttonPositive: 'Allow',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Show an alert directing the user to Settings when permission was denied.
 */
export function showPermissionDeniedAlert(mediaType: 'photo' | 'video' = 'photo') {
  Alert.alert(
    'Permission Required',
    `Please allow photo library access in Settings to save ${mediaType}s.`,
    [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Open Settings', onPress: () => Linking.openSettings()},
    ],
  );
}

/**
 * Check if an error is a permission-related error.
 */
export function isPermissionError(error: any): boolean {
  const msg = error?.message || error?.toString() || '';
  return (
    msg.includes('denied') ||
    msg.includes('permission') ||
    msg.includes('Permission') ||
    msg.includes('PHPhotosErrorDomain')
  );
}
