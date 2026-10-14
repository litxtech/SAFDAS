import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Appearance, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { themes, type ThemeColors, type ThemeName, type ThemePreference } from './tokens';
import { useThemeStore } from '@/stores/themeStore';

type ThemeContextValue = {
  preference: ThemePreference;
  name: ThemeName;
  colors: ThemeColors;
  reduceMotion: boolean;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const system = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => subscription.remove();
  }, []);

  const name: ThemeName = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const colors = themes[name];

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? null : preference);
  }, [preference]);

  const value = useMemo(
    () => ({ preference, name, colors, reduceMotion, setPreference }),
    [preference, name, colors, reduceMotion, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={colors.statusBar === 'light' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return value;
}
