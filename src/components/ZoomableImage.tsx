import React, {useRef} from 'react';
import {
  StyleSheet,
  ImageSourcePropType,
  ScrollView,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

interface ZoomableImageProps {
  source: ImageSourcePropType;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const ZoomableImage: React.FC<ZoomableImageProps> = ({
  source,
  style,
  resizeMode = 'contain',
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, style]}
      contentContainerStyle={styles.contentContainer}
      maximumZoomScale={4}
      minimumZoomScale={1}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      bouncesZoom={true}
      centerContent={true}
      scrollEnabled={true}
      pinchGestureEnabled={true}>
      <Image
        source={source}
        style={styles.image}
        resizeMode={resizeMode}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default ZoomableImage;
