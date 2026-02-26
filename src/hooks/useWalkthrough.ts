import {useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Walkthrough keys for different tabs
export const WALKTHROUGH_KEYS = {
  STUDIO: '@magishot_studio_walkthrough_completed',
  TRYON: '@magishot_tryon_walkthrough_completed',
  EDIT: '@magishot_edit_walkthrough_completed',
};

export const useWalkthrough = (walkthroughKey: string = WALKTHROUGH_KEYS.STUDIO) => {
  const [shouldShowWalkthrough, setShouldShowWalkthrough] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkWalkthroughStatus();
  }, [walkthroughKey]);

  const checkWalkthroughStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem(walkthroughKey);
      setShouldShowWalkthrough(completed !== 'true');
    } catch (error) {
      console.error('Error checking walkthrough status:', error);
      setShouldShowWalkthrough(false);
    } finally {
      setIsLoading(false);
    }
  };

  const completeWalkthrough = async () => {
    try {
      await AsyncStorage.setItem(walkthroughKey, 'true');
      setShouldShowWalkthrough(false);
    } catch (error) {
      console.error('Error saving walkthrough status:', error);
    }
  };

  const resetWalkthrough = async () => {
    try {
      await AsyncStorage.removeItem(walkthroughKey);
      setShouldShowWalkthrough(true);
    } catch (error) {
      console.error('Error resetting walkthrough:', error);
    }
  };

  return {
    shouldShowWalkthrough,
    isLoading,
    completeWalkthrough,
    resetWalkthrough,
  };
};
