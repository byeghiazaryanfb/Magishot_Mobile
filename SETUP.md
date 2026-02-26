# EverHome Mobile App - Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v20 or higher)
- npm or yarn
- React Native development environment
  - For iOS: Xcode (macOS only), CocoaPods
  - For Android: Android Studio, JDK

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. iOS Setup (macOS only)

```bash
cd ios
pod install
cd ..
```

### 3. Environment Configuration

Copy the `.env.example` file to `.env` and update the values:

```bash
cp .env.example .env
```

Update the API URL in `.env` to point to your backend server.

## Running the App

### iOS

```bash
npm run ios
```

Or open the Xcode workspace:

```bash
open ios/EverHomeMobileApp.xcworkspace
```

### Android

```bash
npm run android
```

## Project Structure

```
EverHomeMobile/
├── src/
│   ├── screens/       # Screen components
│   ├── components/    # Reusable UI components
│   ├── navigation/    # Navigation configuration
│   ├── services/      # API services (auth, api)
│   ├── utils/         # Utility functions and config
│   ├── types/         # TypeScript type definitions
│   └── assets/        # Images, fonts, etc.
├── android/           # Android native code
├── ios/              # iOS native code
├── App.tsx           # Root component
└── package.json      # Dependencies and scripts
```

## Available Scripts

- `npm start` - Start Metro bundler
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## Backend Integration

The app is configured to connect to the EverHome backend API. Update the API base URL in:

- **Development**: `src/utils/config.ts` (uses `http://localhost:5000` by default)
- **Production**: Update the production URL in the same file

The authentication service is ready to use with endpoints matching the backend:

- POST `/api/auth/login`
- POST `/api/auth/register`
- POST `/api/auth/refresh-token`
- POST `/api/auth/logout`
- POST `/api/auth/forgot-password`
- POST `/api/auth/reset-password`

## Troubleshooting

### iOS Build Errors

If you encounter CocoaPods issues:

```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Android Build Errors

Clean the build:

```bash
cd android
./gradlew clean
cd ..
```

### Metro Bundler Issues

Reset Metro cache:

```bash
npm start -- --reset-cache
```

## Next Steps

1. Implement authentication screens (Login, Register, Forgot Password)
2. Add navigation using React Navigation
3. Implement home screen and main features
4. Add state management (Context API or Redux)
5. Implement secure token storage
6. Add error handling and loading states
7. Implement push notifications
8. Add offline support
