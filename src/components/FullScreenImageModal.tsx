import React, {useState, useRef} from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Text,
  Animated,
  PanResponder,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

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

  // Zoom state
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const lastTap = useRef(0);

  // Reset zoom when modal closes or image changes
  React.useEffect(() => {
    if (!visible) {
      resetZoom();
    }
  }, [visible, imageUri]);

  const resetZoom = () => {
    Animated.parallel([
      Animated.spring(scale, {toValue: 1, useNativeDriver: true}),
      Animated.spring(translateX, {toValue: 0, useNativeDriver: true}),
      Animated.spring(translateY, {toValue: 0, useNativeDriver: true}),
    ]).start();
    lastScale.current = 1;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap detected
      if (lastScale.current > 1) {
        // Zoom out
        resetZoom();
      } else {
        // Zoom in to 2.5x
        Animated.parallel([
          Animated.spring(scale, {toValue: 2.5, useNativeDriver: true}),
        ]).start();
        lastScale.current = 2.5;
      }
    }
    lastTap.current = now;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Allow pan when zoomed in or when there are 2 fingers
        return lastScale.current > 1 || gestureState.numberActiveTouches === 2;
      },
      onPanResponderGrant: () => {
        handleDoubleTap();
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.numberActiveTouches === 2) {
          // Pinch to zoom
          const distance = Math.sqrt(
            Math.pow(gestureState.dx, 2) + Math.pow(gestureState.dy, 2)
          );
          const newScale = Math.max(1, Math.min(lastScale.current + distance / 300, 5));
          scale.setValue(newScale);
        } else if (lastScale.current > 1) {
          // Pan when zoomed
          const newX = lastTranslateX.current + gestureState.dx;
          const newY = lastTranslateY.current + gestureState.dy;
          translateX.setValue(newX);
          translateY.setValue(newY);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Save current values
        scale.addListener(({value}) => {
          lastScale.current = value;
        });
        translateX.addListener(({value}) => {
          lastTranslateX.current = value;
        });
        translateY.addListener(({value}) => {
          lastTranslateY.current = value;
        });

        // Snap back if scale is less than 1
        if (lastScale.current < 1) {
          resetZoom();
        }
      },
    })
  ).current;

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
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Zoom hint */}
        <View style={styles.zoomHint}>
          <Ionicons name="search-outline" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.zoomHintText}>Pinch or double-tap to zoom</Text>
        </View>

        {/* Reset zoom button */}
        {lastScale.current > 1 && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetZoom}
            activeOpacity={0.7}>
            <Ionicons name="contract-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Main image with zoom */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.imageContainer,
            {
              transform: [
                {scale: scale},
                {translateX: translateX},
                {translateY: translateY},
              ],
            },
          ]}>
          <Image
            source={{uri: imageUri}}
            style={styles.image}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Before image overlay */}
        {showBefore && beforeImageUri && (
          <View style={styles.beforeOverlay}>
            <Image
              source={{uri: beforeImageUri}}
              style={styles.image}
              resizeMode="contain"
            />
            <View style={styles.labelContainer}>
              <View style={styles.labelBadge}>
                <Text style={styles.labelText}>Before</Text>
              </View>
            </View>
          </View>
        )}

        {/* Compare button - press and hold to see before */}
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
      </View>
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
  resetButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
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
