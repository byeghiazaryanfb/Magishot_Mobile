import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import DrawerNavigator from './DrawerNavigator';
import TemplateDetailScreen from '../screens/TemplateDetailScreen';
import VideoResultScreen from '../screens/VideoResultScreen';
import ImageTemplateScreen from '../screens/ImageTemplateScreen';
import ImageResultScreen from '../screens/ImageResultScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HelpCenterScreen from '../screens/HelpCenterScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import MyCreationsScreen from '../screens/MyCreationsScreen';
import PhotoDetailScreen from '../screens/PhotoDetailScreen';
import SubtitleScreen from '../screens/SubtitleScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import type {UserPhoto} from '../services/userPhotosApi';

interface VideoResult {
  videoUrl: string;
  fileName: string;
  mimeType: string;
  prompt: string;
  durationSeconds: number;
}

interface ImageResult {
  imageUrl: string;
  imageBase64: string;
  fileName: string;
  mimeType: string;
  templateId: string;
  templateName: string;
}

interface VideoTemplateType {
  id: string;
  displayName: string;
  gifUrl: string;
  description: string;
  minImages: number;
  maxImages: number;
  requiredPhotoCount?: number;
  templateType: number;
  categoryId?: string | null;
  categoryName?: string | null;
  videoAnimationEnabled?: boolean;
}

export type RootStackParamList = {
  Main: undefined;
  Profile: undefined;
  HelpCenter: undefined;
  Subscription: undefined;
  MyCreations: {initialTab?: 'photos' | 'videos'} | undefined;
  PhotoDetail: {
    photos: UserPhoto[];
    currentIndex: number;
  };
  TemplateDetail: {
    template: VideoTemplateType;
  };
  ImageTemplateDetail: {
    template: VideoTemplateType;
    templates: VideoTemplateType[];
    currentIndex: number;
  };
  VideoResult: {
    videoResult: VideoResult;
  };
  ImageResult: {
    imageResult: ImageResult;
  };
  Subtitle: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Main" component={DrawerNavigator} />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="HelpCenter"
        component={HelpCenterScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="TemplateDetail"
        component={TemplateDetailScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="VideoResult"
        component={VideoResultScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="ImageTemplateDetail"
        component={ImageTemplateScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="ImageResult"
        component={ImageResultScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="MyCreations"
        component={MyCreationsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="PhotoDetail"
        component={PhotoDetailScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="Subtitle"
        component={SubtitleScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;
