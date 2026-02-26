import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  cardBackground: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  // Accent colors
  primary: string;
  primaryLight: string;
  secondary: string;
  accent: string;

  // Status
  success: string;
  warning: string;
  error: string;

  // UI Elements
  border: string;
  borderLight: string;
  shadow: string;
  overlay: string;

  // Gradients
  gradientStart: string;
  gradientEnd: string;
}

export interface ColorPalette {
  id: string;
  name: string;
  icon: string;
  light: ThemeColors;
  dark: ThemeColors;
}

// Default Indigo palette
const indigoPalette: ColorPalette = {
  id: 'indigo',
  name: 'Indigo',
  icon: '💜',
  light: {
    background: '#FAFBFC',
    backgroundSecondary: '#FFFFFF',
    backgroundTertiary: '#F0F2F5',
    cardBackground: '#F0F0F0',
    textPrimary: '#1A1D26',
    textSecondary: '#5E6478',
    textTertiary: '#9CA3B4',
    primary: '#6366F1',
    primaryLight: '#818CF8',
    secondary: '#EC4899',
    accent: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    shadow: 'rgba(0, 0, 0, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    gradientStart: '#6366F1',
    gradientEnd: '#8B5CF6',
  },
  dark: {
    background: '#0F1119',
    backgroundSecondary: '#1A1D2E',
    backgroundTertiary: '#252A3C',
    cardBackground: '#1E2235',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A6B8',
    textTertiary: '#6B7280',
    primary: '#818CF8',
    primaryLight: '#A5B4FC',
    secondary: '#F472B6',
    accent: '#A78BFA',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    border: '#2D3348',
    borderLight: '#3D4459',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    gradientStart: '#6366F1',
    gradientEnd: '#A855F7',
  },
};

// Ocean Blue palette
const oceanPalette: ColorPalette = {
  id: 'ocean',
  name: 'Ocean',
  icon: '🌊',
  light: {
    background: '#F0F9FF',
    backgroundSecondary: '#FFFFFF',
    backgroundTertiary: '#E0F2FE',
    cardBackground: '#F0F0F0',
    textPrimary: '#0C4A6E',
    textSecondary: '#0369A1',
    textTertiary: '#7DD3FC',
    primary: '#0EA5E9',
    primaryLight: '#38BDF8',
    secondary: '#06B6D4',
    accent: '#14B8A6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#BAE6FD',
    borderLight: '#E0F2FE',
    shadow: 'rgba(14, 165, 233, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    gradientStart: '#0EA5E9',
    gradientEnd: '#06B6D4',
  },
  dark: {
    background: '#082F49',
    backgroundSecondary: '#0C4A6E',
    backgroundTertiary: '#075985',
    cardBackground: '#0C4A6E',
    textPrimary: '#FFFFFF',
    textSecondary: '#BAE6FD',
    textTertiary: '#7DD3FC',
    primary: '#38BDF8',
    primaryLight: '#7DD3FC',
    secondary: '#22D3EE',
    accent: '#2DD4BF',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    border: '#0369A1',
    borderLight: '#0284C7',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    gradientStart: '#0EA5E9',
    gradientEnd: '#14B8A6',
  },
};

// Sunset palette
const sunsetPalette: ColorPalette = {
  id: 'sunset',
  name: 'Sunset',
  icon: '🌅',
  light: {
    background: '#FFF7ED',
    backgroundSecondary: '#FFFFFF',
    backgroundTertiary: '#FFEDD5',
    cardBackground: '#F0F0F0',
    textPrimary: '#7C2D12',
    textSecondary: '#C2410C',
    textTertiary: '#FB923C',
    primary: '#F97316',
    primaryLight: '#FB923C',
    secondary: '#EF4444',
    accent: '#F59E0B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#FED7AA',
    borderLight: '#FFEDD5',
    shadow: 'rgba(249, 115, 22, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    gradientStart: '#F97316',
    gradientEnd: '#EF4444',
  },
  dark: {
    background: '#431407',
    backgroundSecondary: '#7C2D12',
    backgroundTertiary: '#9A3412',
    cardBackground: '#7C2D12',
    textPrimary: '#FFFFFF',
    textSecondary: '#FED7AA',
    textTertiary: '#FDBA74',
    primary: '#FB923C',
    primaryLight: '#FDBA74',
    secondary: '#F87171',
    accent: '#FBBF24',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    border: '#C2410C',
    borderLight: '#EA580C',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    gradientStart: '#F97316',
    gradientEnd: '#DC2626',
  },
};

// Forest Green palette
const forestPalette: ColorPalette = {
  id: 'forest',
  name: 'Forest',
  icon: '🌲',
  light: {
    background: '#F0FDF4',
    backgroundSecondary: '#FFFFFF',
    backgroundTertiary: '#DCFCE7',
    cardBackground: '#F0F0F0',
    textPrimary: '#14532D',
    textSecondary: '#166534',
    textTertiary: '#86EFAC',
    primary: '#22C55E',
    primaryLight: '#4ADE80',
    secondary: '#10B981',
    accent: '#84CC16',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#BBF7D0',
    borderLight: '#DCFCE7',
    shadow: 'rgba(34, 197, 94, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    gradientStart: '#22C55E',
    gradientEnd: '#10B981',
  },
  dark: {
    background: '#052E16',
    backgroundSecondary: '#14532D',
    backgroundTertiary: '#166534',
    cardBackground: '#14532D',
    textPrimary: '#FFFFFF',
    textSecondary: '#BBF7D0',
    textTertiary: '#86EFAC',
    primary: '#4ADE80',
    primaryLight: '#86EFAC',
    secondary: '#34D399',
    accent: '#A3E635',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    border: '#166534',
    borderLight: '#15803D',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    gradientStart: '#22C55E',
    gradientEnd: '#059669',
  },
};

// Rose Pink palette
const rosePalette: ColorPalette = {
  id: 'rose',
  name: 'Rose',
  icon: '🌸',
  light: {
    background: '#FFF1F2',
    backgroundSecondary: '#FFFFFF',
    backgroundTertiary: '#FFE4E6',
    cardBackground: '#F0F0F0',
    textPrimary: '#881337',
    textSecondary: '#BE123C',
    textTertiary: '#FDA4AF',
    primary: '#F43F5E',
    primaryLight: '#FB7185',
    secondary: '#EC4899',
    accent: '#D946EF',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#FECDD3',
    borderLight: '#FFE4E6',
    shadow: 'rgba(244, 63, 94, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    gradientStart: '#F43F5E',
    gradientEnd: '#EC4899',
  },
  dark: {
    background: '#4C0519',
    backgroundSecondary: '#881337',
    backgroundTertiary: '#9F1239',
    cardBackground: '#881337',
    textPrimary: '#FFFFFF',
    textSecondary: '#FECDD3',
    textTertiary: '#FDA4AF',
    primary: '#FB7185',
    primaryLight: '#FDA4AF',
    secondary: '#F472B6',
    accent: '#E879F9',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    border: '#BE123C',
    borderLight: '#E11D48',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    gradientStart: '#F43F5E',
    gradientEnd: '#DB2777',
  },
};

// Midnight Purple palette
const midnightPalette: ColorPalette = {
  id: 'midnight',
  name: 'Midnight',
  icon: '🌙',
  light: {
    background: '#FAF5FF',
    backgroundSecondary: '#FFFFFF',
    backgroundTertiary: '#F3E8FF',
    cardBackground: '#F0F0F0',
    textPrimary: '#581C87',
    textSecondary: '#7E22CE',
    textTertiary: '#C084FC',
    primary: '#A855F7',
    primaryLight: '#C084FC',
    secondary: '#8B5CF6',
    accent: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#E9D5FF',
    borderLight: '#F3E8FF',
    shadow: 'rgba(168, 85, 247, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    gradientStart: '#A855F7',
    gradientEnd: '#8B5CF6',
  },
  dark: {
    background: '#2E1065',
    backgroundSecondary: '#3B0764',
    backgroundTertiary: '#581C87',
    cardBackground: '#3B0764',
    textPrimary: '#FFFFFF',
    textSecondary: '#E9D5FF',
    textTertiary: '#D8B4FE',
    primary: '#C084FC',
    primaryLight: '#D8B4FE',
    secondary: '#A78BFA',
    accent: '#F472B6',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    border: '#7E22CE',
    borderLight: '#9333EA',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    gradientStart: '#A855F7',
    gradientEnd: '#7C3AED',
  },
};

// Neon Pink palette (like the reference design)
const neonPalette: ColorPalette = {
  id: 'neon',
  name: 'Neon',
  icon: '💖',
  light: {
    background: '#FFFBFC',           // Very subtle rose tint
    backgroundSecondary: '#FFF5F8',  // Light rose
    backgroundTertiary: '#FFECF2',   // Soft rose
    cardBackground: '#F0F0F0',       // White cards for contrast
    textPrimary: '#2D1F24',          // Dark rose-tinted gray for better harmony
    textSecondary: '#6B5660',        // Muted rose-gray
    textTertiary: '#A8929D',         // Light rose-gray
    primary: '#FF1B6D',
    primaryLight: '#FF4D8D',
    secondary: '#A855F7',
    accent: '#FF1B6D',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#F5DFE6',               // Soft rose border
    borderLight: '#FFECF2',          // Light rose border
    shadow: 'rgba(255, 27, 109, 0.08)', // Pink-tinted shadow
    overlay: 'rgba(45, 31, 36, 0.5)',   // Rose-tinted overlay
    gradientStart: '#FF1B6D',
    gradientEnd: '#A855F7',
  },
  dark: {
    background: '#000000',
    backgroundSecondary: '#0A0A0A',
    backgroundTertiary: '#1A1A1A',
    cardBackground: '#141414',
    textPrimary: '#FFFFFF',
    textSecondary: '#AAAAAA',
    textTertiary: '#666666',
    primary: '#FF1B6D',
    primaryLight: '#FF4D8D',
    secondary: '#A855F7',
    accent: '#FF1B6D',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    border: '#2A2A2A',
    borderLight: '#333333',
    shadow: 'rgba(0, 0, 0, 0.5)',
    overlay: 'rgba(0, 0, 0, 0.8)',
    gradientStart: '#FF1B6D',
    gradientEnd: '#A855F7',
  },
};

// Slate Minimal palette
const slatePalette: ColorPalette = {
  id: 'slate',
  name: 'Slate',
  icon: '🪨',
  light: {
    background: '#F8FAFC',
    backgroundSecondary: '#FFFFFF',
    backgroundTertiary: '#F1F5F9',
    cardBackground: '#F0F0F0',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    primary: '#475569',
    primaryLight: '#64748B',
    secondary: '#64748B',
    accent: '#0EA5E9',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    shadow: 'rgba(0, 0, 0, 0.05)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    gradientStart: '#475569',
    gradientEnd: '#64748B',
  },
  dark: {
    background: '#020617',
    backgroundSecondary: '#0F172A',
    backgroundTertiary: '#1E293B',
    cardBackground: '#0F172A',
    textPrimary: '#FFFFFF',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    primary: '#94A3B8',
    primaryLight: '#CBD5E1',
    secondary: '#64748B',
    accent: '#38BDF8',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    border: '#334155',
    borderLight: '#475569',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    gradientStart: '#475569',
    gradientEnd: '#334155',
  },
};

// Export all palettes
export const colorPalettes: ColorPalette[] = [
  neonPalette,
  indigoPalette,
  oceanPalette,
  sunsetPalette,
  forestPalette,
  rosePalette,
  midnightPalette,
  slatePalette,
];

// Legacy exports for backwards compatibility
export const lightTheme = indigoPalette.light;
export const darkTheme = indigoPalette.dark;

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
  currentPalette: ColorPalette;
  setPalette: (paletteId: string) => void;
  palettes: ColorPalette[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const PALETTE_STORAGE_KEY = '@app_color_palette';
const THEME_MODE_STORAGE_KEY = '@app_theme_mode';

export const ThemeProvider: React.FC<ThemeProviderProps> = ({children}) => {
  // Default to dark mode
  const [isDark, setIsDark] = useState(true);
  const [currentPalette, setCurrentPalette] = useState<ColorPalette>(neonPalette);

  // Load saved palette and theme mode on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Load palette
        const savedPaletteId = await AsyncStorage.getItem(PALETTE_STORAGE_KEY);
        if (savedPaletteId) {
          const palette = colorPalettes.find(p => p.id === savedPaletteId);
          if (palette) {
            setCurrentPalette(palette);
          }
        }
        // Load theme mode (default to dark if not set)
        const savedThemeMode = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
        if (savedThemeMode !== null) {
          setIsDark(savedThemeMode === 'dark');
        }
      } catch (error) {
        console.log('Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  const toggleTheme = async () => {
    const newValue = !isDark;
    setIsDark(newValue);
    try {
      await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, newValue ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme mode:', error);
    }
  };

  const setTheme = async (dark: boolean) => {
    setIsDark(dark);
    try {
      await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, dark ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme mode:', error);
    }
  };

  const setPalette = async (paletteId: string) => {
    const palette = colorPalettes.find(p => p.id === paletteId);
    if (palette) {
      setCurrentPalette(palette);
      try {
        await AsyncStorage.setItem(PALETTE_STORAGE_KEY, paletteId);
      } catch (error) {
        console.log('Error saving palette:', error);
      }
    }
  };

  const colors = isDark ? currentPalette.dark : currentPalette.light;

  return (
    <ThemeContext.Provider
      value={{
        colors,
        isDark,
        toggleTheme,
        setTheme,
        currentPalette,
        setPalette,
        palettes: colorPalettes,
      }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
