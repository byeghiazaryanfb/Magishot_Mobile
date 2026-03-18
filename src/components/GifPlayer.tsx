import React, {useState} from 'react';
import {View, StyleSheet, ActivityIndicator} from 'react-native';
import {WebView} from 'react-native-webview';
import {useTheme} from '../theme/ThemeContext';

interface GifPlayerProps {
  uri: string;
  style?: any;
  resizeMode?: 'contain' | 'cover' | 'stretch';
}

const GifPlayer: React.FC<GifPlayerProps> = ({
  uri,
  style,
  resizeMode = 'cover',
}) => {
  const {colors} = useTheme();
  const [loaded, setLoaded] = useState(false);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            background: transparent;
            overflow: hidden;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: ${resizeMode};
          }
        </style>
      </head>
      <body>
        <img src="${uri}" />
      </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      {!loaded && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="small" color={colors.primary} style={{opacity: 0.4}} />
        </View>
      )}
      <WebView
        source={{html}}
        style={[styles.webview, !loaded && {opacity: 0}]}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        scalesPageToFit={true}
        javaScriptEnabled={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        onLoadEnd={() => setLoaded(true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});

export default GifPlayer;
