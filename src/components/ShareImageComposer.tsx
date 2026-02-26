import React, {forwardRef, useImperativeHandle, useRef, useState, useCallback} from 'react';
import {View, Image, Text, StyleSheet} from 'react-native';
import ViewShot from 'react-native-view-shot';

const appIconSmall = require('../assets/app-icon-small.png');

// Off-screen dimensions (rendered at 360x640, captured at 1080x1920)
const COMPOSER_WIDTH = 360;
const COMPOSER_HEIGHT = 640;
const SQUARE_SIZE = COMPOSER_WIDTH;

const COMPOSE_TIMEOUT_MS = 8000;

export interface ShareImageComposerHandle {
  compose: (localImageUri: string) => Promise<string>;
}

const ShareImageComposer = forwardRef<ShareImageComposerHandle>((_, ref) => {
  const viewShotRef = useRef<ViewShot>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const resolveRef = useRef<((uri: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);
  const capturedRef = useRef(false);

  const cleanup = useCallback(() => {
    resolveRef.current = null;
    rejectRef.current = null;
    capturedRef.current = false;
    setImageUri(null);
  }, []);

  const doCapture = useCallback(async () => {
    // Guard against double-capture
    if (capturedRef.current || !viewShotRef.current) return;
    capturedRef.current = true;

    try {
      // Wait for layout + render to settle
      await new Promise<void>(r => setTimeout(r, 500));

      if (!viewShotRef.current) {
        rejectRef.current?.(new Error('ViewShot ref lost'));
        cleanup();
        return;
      }

      const uri = await (viewShotRef.current as any).capture();
      if (uri) {
        resolveRef.current?.(uri.startsWith('file://') ? uri : `file://${uri}`);
      } else {
        rejectRef.current?.(new Error('ViewShot capture returned empty'));
      }
    } catch (err) {
      rejectRef.current?.(err as Error);
    } finally {
      cleanup();
    }
  }, [cleanup]);

  useImperativeHandle(ref, () => ({
    compose: (localImageUri: string) => {
      return new Promise<string>((resolve, reject) => {
        capturedRef.current = false;
        resolveRef.current = resolve;
        rejectRef.current = reject;
        setImageUri(localImageUri);

        // Safety timeout — if capture never fires, reject
        setTimeout(() => {
          if (resolveRef.current) {
            rejectRef.current?.(new Error('Compose timed out'));
            cleanup();
          }
        }, COMPOSE_TIMEOUT_MS);
      });
    },
  }), [cleanup]);

  const handleImageLoad = useCallback(() => {
    // Slight delay so the ViewShot ref is guaranteed to be set
    setTimeout(() => doCapture(), 100);
  }, [doCapture]);

  if (!imageUri) return null;

  return (
    <View style={styles.offScreen} pointerEvents="none">
      <ViewShot
        ref={viewShotRef}
        options={{
          format: 'jpg',
          quality: 0.9,
          width: 1080,
          height: 1920,
        }}
        style={styles.composer}>
        <View style={styles.background}>
          {/* Blurred background image filling the frame */}
          <Image
            source={{uri: imageUri}}
            style={styles.blurredBg}
            blurRadius={25}
            resizeMode="cover"
          />

          {/* Semi-transparent dark overlay */}
          <View style={styles.darkOverlay} />

          {/* Centered original square image */}
          <View style={styles.centerImageContainer}>
            <Image
              source={{uri: imageUri}}
              style={styles.centerImage}
              resizeMode="contain"
              onLoad={handleImageLoad}
            />
          </View>

          {/* Watermark bottom-right */}
          <View style={styles.watermark}>
            <Image
              source={appIconSmall}
              style={styles.watermarkIcon}
              resizeMode="contain"
            />
            <Text style={styles.watermarkMagi}>Magi</Text>
            <Text style={styles.watermarkShot}>Shot</Text>
          </View>
        </View>
      </ViewShot>
    </View>
  );
});

const styles = StyleSheet.create({
  offScreen: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    // No opacity: 0 — ViewShot cannot capture invisible content on iOS
  },
  composer: {
    width: COMPOSER_WIDTH,
    height: COMPOSER_HEIGHT,
  },
  background: {
    width: COMPOSER_WIDTH,
    height: COMPOSER_HEIGHT,
    backgroundColor: '#000',
  },
  blurredBg: {
    ...StyleSheet.absoluteFillObject,
    width: COMPOSER_WIDTH,
    height: COMPOSER_HEIGHT,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  centerImageContainer: {
    position: 'absolute',
    top: (COMPOSER_HEIGHT - SQUARE_SIZE) / 2,
    left: 0,
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerImage: {
    width: '100%',
    height: '100%',
  },
  watermark: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.7,
  },
  watermarkIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 6,
  },
  watermarkMagi: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF1B6D',
  },
  watermarkShot: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ShareImageComposer;
