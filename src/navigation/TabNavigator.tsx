import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../theme/ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import TryOnScreen from '../screens/TryOnScreen';
import VideoScreen from '../screens/VideoScreen';
import EditScreen from '../screens/EditScreen';

const Tab = createBottomTabNavigator();

const TabNavigator: React.FC = () => {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();

  // Add safe area bottom inset for devices with home indicator
  const bottomPadding = Math.max(insets.bottom, 4);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? colors.backgroundSecondary : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 50 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 4,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}>
      <Tab.Screen
        name="Studio"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Studio',
          tabBarIcon: ({focused, color}) => (
            <Ionicons
              name={focused ? 'sparkles' : 'sparkles-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="TryOn"
        component={TryOnScreen}
        options={{
          tabBarLabel: 'Try On',
          tabBarIcon: ({focused, color}) => (
            <Ionicons
              name={focused ? 'shirt' : 'shirt-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Templates"
        component={VideoScreen}
        options={{
          tabBarLabel: 'Templates',
          tabBarIcon: ({focused, color}) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Edit"
        component={EditScreen}
        options={{
          tabBarLabel: 'Edit',
          tabBarIcon: ({focused, color}) => (
            <Ionicons
              name={focused ? 'brush' : 'brush-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
