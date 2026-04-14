/**
 * AsyncStorage utilities for app persistence
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AuthResponse} from '../types';

const STORAGE_KEYS = {
  HAS_SEEN_WELCOME: '@picgen:hasSeenWelcome',
  HAS_SEEN_ONBOARDING: '@picgen:hasSeenOnboarding',
  TRANSFORMATION_HISTORY: '@picgen:transformationHistory',
  AUTH_DATA: '@picgen:authData',
  VIEWED_VIDEO_IDS: '@picgen:viewedVideoIds',
  CACHED_PHOTOS: '@picgen:cachedPhotos',
  CACHED_VIDEOS: '@picgen:cachedVideos',
  SCENARIO_PANEL_EXPANDED: '@picgen:scenarioPanelExpanded',
  AI_PROCESSING_CONSENT: '@picgen:aiProcessingConsent',
};

export interface HistoryItem {
  id: string;
  sourceImage: string;
  transformedImage: string;
  sightName: string | null;
  sightId: string | null;
  accessories: string[];
  prompt: string;
  createdAt: string;
}

export const HistoryStorage = {
  /**
   * Get all transformation history
   */
  async getHistory(): Promise<HistoryItem[]> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.TRANSFORMATION_HISTORY);
      if (value) {
        return JSON.parse(value);
      }
      return [];
    } catch (error) {
      console.error('Failed to get history:', error);
      return [];
    }
  },

  /**
   * Add a transformation to history
   */
  async addToHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>): Promise<HistoryItem> {
    try {
      const history = await this.getHistory();
      const newItem: HistoryItem = {
        ...item,
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      };

      // Add to beginning of array (most recent first)
      const updatedHistory = [newItem, ...history];

      // Keep only last 50 items to prevent storage overflow
      const limitedHistory = updatedHistory.slice(0, 50);

      await AsyncStorage.setItem(
        STORAGE_KEYS.TRANSFORMATION_HISTORY,
        JSON.stringify(limitedHistory)
      );

      return newItem;
    } catch (error) {
      console.error('Failed to add to history:', error);
      throw error;
    }
  },

  /**
   * Delete a specific history item
   */
  async deleteFromHistory(id: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const updatedHistory = history.filter(item => item.id !== id);
      await AsyncStorage.setItem(
        STORAGE_KEYS.TRANSFORMATION_HISTORY,
        JSON.stringify(updatedHistory)
      );
    } catch (error) {
      console.error('Failed to delete from history:', error);
      throw error;
    }
  },

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TRANSFORMATION_HISTORY);
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  },
};

export const WelcomeStorage = {
  async hasSeenWelcome(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.HAS_SEEN_WELCOME);
      return value === 'true';
    } catch {
      return false;
    }
  },

  async setWelcomeSeen(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HAS_SEEN_WELCOME, 'true');
    } catch (error) {
      console.error('Failed to save welcome status:', error);
    }
  },
};

export const OnboardingStorage = {
  /**
   * Get the storage key for a specific email (or the legacy global key)
   */
  _key(email?: string): string {
    return email
      ? `${STORAGE_KEYS.HAS_SEEN_ONBOARDING}:${email.toLowerCase()}`
      : STORAGE_KEYS.HAS_SEEN_ONBOARDING;
  },

  /**
   * Check if user has completed onboarding
   * Falls back to global key if email-specific key isn't set
   */
  async hasSeenOnboarding(email?: string): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(this._key(email));
      if (value === 'true') return true;
      // If checking with email, also check the global key as fallback
      if (email) {
        const globalValue = await AsyncStorage.getItem(this._key());
        if (globalValue === 'true') {
          // Migrate: save to email-specific key so this fallback isn't needed again
          await AsyncStorage.setItem(this._key(email), 'true');
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Mark onboarding as complete for a specific user
   */
  async setOnboardingComplete(email?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this._key(email), 'true');
    } catch (error) {
      console.error('Failed to save onboarding status:', error);
    }
  },

  /**
   * Reset onboarding for a specific user (used on account deletion)
   */
  async resetOnboarding(email?: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this._key(email));
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
    }
  },
};

export const AiConsentStorage = {
  _key(email?: string): string {
    return email
      ? `${STORAGE_KEYS.AI_PROCESSING_CONSENT}:${email.toLowerCase()}`
      : STORAGE_KEYS.AI_PROCESSING_CONSENT;
  },

  async hasConsented(email?: string): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(this._key(email));
      return value === 'true';
    } catch {
      return false;
    }
  },

  async setConsented(email?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this._key(email), 'true');
    } catch (error) {
      console.error('Failed to save AI consent:', error);
    }
  },

  async resetConsent(email?: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this._key(email));
    } catch (error) {
      console.error('Failed to reset AI consent:', error);
    }
  },
};

export const AuthStorage = {
  /**
   * Save authentication data
   */
  async saveAuthData(authData: AuthResponse): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_DATA, JSON.stringify(authData));
    } catch (error) {
      console.error('Failed to save auth data:', error);
      throw error;
    }
  },

  /**
   * Get stored authentication data
   */
  async getAuthData(): Promise<AuthResponse | null> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_DATA);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      console.error('Failed to get auth data:', error);
      return null;
    }
  },

  /**
   * Clear authentication data (logout)
   */
  async clearAuthData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_DATA);
    } catch (error) {
      console.error('Failed to clear auth data:', error);
      throw error;
    }
  },

  /**
   * Check if user is authenticated (has stored tokens)
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const authData = await this.getAuthData();
      return authData !== null && !!authData.accessToken;
    } catch {
      return false;
    }
  },
};

export const ViewedVideoStorage = {
  async getViewedIds(): Promise<Record<string, boolean>> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.VIEWED_VIDEO_IDS);
      return value ? JSON.parse(value) : {};
    } catch {
      return {};
    }
  },

  async addViewedId(videoId: string): Promise<void> {
    try {
      const viewed = await this.getViewedIds();
      viewed[videoId] = true;
      await AsyncStorage.setItem(STORAGE_KEYS.VIEWED_VIDEO_IDS, JSON.stringify(viewed));
    } catch (error) {
      console.warn('Failed to save viewed video ID:', error);
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.VIEWED_VIDEO_IDS);
    } catch (error) {
      console.warn('Failed to clear viewed video IDs:', error);
    }
  },
};

export interface CachedPhotosData {
  photos: any[];
  hasMore: boolean;
  nextCursor: string | null;
  totalCount: number;
}

export interface CachedVideosData {
  videos: any[];
  hasMore: boolean;
  nextCursor: string | null;
}

export const GalleryCache = {
  async savePhotos(data: CachedPhotosData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_PHOTOS, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to cache photos:', error);
    }
  },

  async getPhotos(): Promise<CachedPhotosData | null> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_PHOTOS);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  async clearPhotos(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_PHOTOS);
    } catch (error) {
      console.warn('Failed to clear cached photos:', error);
    }
  },

  async saveVideos(data: CachedVideosData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_VIDEOS, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to cache videos:', error);
    }
  },

  async getVideos(): Promise<CachedVideosData | null> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_VIDEOS);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  async clearVideos(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_VIDEOS);
    } catch (error) {
      console.warn('Failed to clear cached videos:', error);
    }
  },
};

export const ScenarioPanelStorage = {
  async getExpanded(): Promise<boolean | null> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.SCENARIO_PANEL_EXPANDED);
      if (value === null) return null; // never set — first install
      return value === 'true';
    } catch {
      return null;
    }
  },

  async setExpanded(expanded: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SCENARIO_PANEL_EXPANDED, String(expanded));
    } catch (error) {
      console.warn('Failed to save scenario panel state:', error);
    }
  },
};

export default OnboardingStorage;
