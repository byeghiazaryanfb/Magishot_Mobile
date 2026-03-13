import React, {useState, useCallback} from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Text,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ImageZoom} from '@likashefqet/react-native-image-zoom';

interface FullScreenImageModalProps {
  visible: boolean;
  imageUri: string | null;
  beforeImageUri?: string | null;
  onClose: () => void;
}

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({
  visible,
  imageUri,
  beforeImageUri,
  onClose,
}) => {
  const [showBefore, setShowBefore] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleZoomChange = useCallback((zoomType: string) => {
    setIsZoomed(zoomType !== 'zoomOut');
  }, []);

  if (!imageUri) {
    return null;
  }

  const hasComparison = beforeImageUri && beforeImageUri !== imageUri;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
      <GestureHandlerRootView style={styles.container}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          activeOpacity={0.7}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Zoom hint */}
        {!isZoomed && (
          <View style={styles.zoomHint}>
            <Ionicons name="search-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.zoomHintText}>Pinch or double-tap to zoom</Text>
          </View>
        )}

        {/* Main image with zoom */}
        <ImageZoom
          uri={imageUri}
          minScale={1}
          maxScale={5}
          doubleTapScale={2.5}
          minPanPointers={1}
          maxPanPointers={2}
          isPanEnabled={true}
          isPinchEnabled={true}
          isDoubleTapEnabled={true}
          onInteractionStart={() => setIsZoomed(true)}
          onPinchEnd={(event) => {
            if (event.scale <= 1.05) {
              setIsZoomed(false);
            }
          }}
          onDoubleTap={(event) => {
            handleZoomChange(event.type);
          }}
          style={styles.imageZoom}
          resizeMode="contain"
        />

        {/* Before image overlay */}
        {showBefore && beforeImageUri && (
          <View style={styles.beforeOverlay}>
            <FastImage
              source={{uri: beforeImageUri, priority: FastImage.priority.high, cache: FastImage.cacheControl.immutable}}
              style={styles.beforeImage}
              resizeMode={FastImage.resizeMode.contain}
            />
            <View style={styles.labelContainer}>
              <View style={styles.labelBadge}>
                <Text style={styles.labelText}>Before</Text>
              </View>
            </View>
          </View>
        )}

        {/* Compare button */}
        {hasComparison && (
          <TouchableOpacity
            style={styles.compareButton}
            onPressIn={() => setShowBefore(true)}
            onPressOut={() => setShowBefore(false)}
            activeOpacity={0.8}>
            <Ionicons name="swap-horizontal-outline" size={20} color="#fff" />
            <Text style={styles.compareText}>Hold to compare</Text>
          </TouchableOpacity>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  zoomHint: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  zoomHintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  imageZoom: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  beforeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  beforeImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  labelContainer: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.15,
    left: 20,
  },
  labelBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  labelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  compareButton: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,27,109,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    zIndex: 10,
  },
  compareText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default FullScreenImageModal;
