import {Platform, PermissionsAndroid, Linking, Alert} from 'react-native';
import {
  CameraRoll,
  iosReadGalleryPermission,
  iosRequestAddOnlyGalleryPermission,
} from '@react-native-camera-roll/camera-roll';

export type PhotoPermissionResult = 'granted' | 'denied' | 'cancelled';

/**
 * Request photo library write permission with explicit cancelled state.
 *
 * Returns:
 *   - 'granted'   → caller can save
 *   - 'denied'    → user has previously denied (or blocked) the permission
 *   - 'cancelled' → user dismissed the system prompt without choosing
 *
 * Callers should ONLY show an error when the result is 'denied'. A 'cancelled'
 * result means the user was just shown the prompt — no error UI should appear.
 */
export async function requestPhotoLibraryPermissionDetailed(): Promise<PhotoPermissionResult> {
  if (Platform.OS === 'ios') {
    // Check current status first — never trigger a system prompt unless we have to.
    const current = await iosReadGalleryPermission('addOnly');
    if (current === 'granted' || current === 'limited') return 'granted';
    if (current === 'denied' || current === 'blocked') return 'denied';

    // Status is 'not-determined' — show the system prompt and wait for the user.
    const result = await iosRequestAddOnlyGalleryPermission();
    if (result === 'granted' || result === 'limited') return 'granted';
    if (result === 'denied' || result === 'blocked') return 'denied';
    // Anything else (e.g. 'not-determined' coming back) means the prompt was
    // dismissed without a definitive answer — do not surface an error to the user.
    return 'cancelled';
  }

  // Android 13+ (API 33) doesn't need WRITE_EXTERNAL_STORAGE for media
  const version = Platform.Version as number;
  if (version >= 33) return 'granted';

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Storage Permission',
      message: 'MagiShot needs access to save media to your device.',
      buttonPositive: 'Allow',
    },
  );
  if (granted === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'denied';
  return 'cancelled';
}

/**
 * Backwards-compatible wrapper: returns true when the user is allowed to save.
 * Note: returns `false` for both 'denied' and 'cancelled', so call sites that
 * differentiate between them should use `requestPhotoLibraryPermissionDetailed`.
 */
export async function requestPhotoLibraryPermission(): Promise<boolean> {
  const result = await requestPhotoLibraryPermissionDetailed();
  return result === 'granted';
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

/**
 * Save a file to the camera roll with a workaround for a known iOS camera-roll
 * library bug.
 *
 * Background: in `react-native-camera-roll`, `saveToCameraRoll` performs the
 * save via PHPhotoLibrary.performChanges. When that completion handler fires
 * with success=YES, the library then tries to fetch the just-created PHAsset
 * back to return its metadata to JS. On iOS 14+ — especially right after a
 * fresh permission grant — that fetch can return zero assets because Photos
 * hasn't indexed the new asset yet, so the library rejects with
 * `E_UNABLE_TO_SAVE` even though the photo is already in the library.
 *
 * This wrapper swallows that specific false-positive so the UI can show a real
 * "Saved!" success. Genuine save failures (different errors, or no underlying
 * NSError attached) still propagate.
 */
export async function saveToCameraRoll(
  uri: string,
  options: {type?: 'photo' | 'video' | 'auto'; album?: string} = {},
): Promise<void> {
  try {
    await CameraRoll.saveAsset(uri, options);
  } catch (error: any) {
    const code = error?.code || error?.userInfo?.code;
    if (code === 'E_UNABLE_TO_SAVE') {
      // Library couldn't fetch the just-saved asset back — the save itself
      // succeeded at the PHPhotoLibrary level. Treat as success.
      console.warn('[saveToCameraRoll] Suppressing E_UNABLE_TO_SAVE — the asset is in the library but the post-save fetch returned empty.');
      return;
    }
    throw error;
  }
}
