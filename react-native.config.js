// React Native configuration
// Disable VisionCameraFaceDetector auto-linking for simulator builds
// because MLKit doesn't support arm64 simulator

const isSimulatorBuild = process.env.SIMULATOR_BUILD === '1';

module.exports = {
  dependencies: {
    ...(isSimulatorBuild && {
      'react-native-vision-camera-face-detector': {
        platforms: {
          ios: null, // Disable iOS auto-linking for simulator
        },
      },
    }),
  },
};
