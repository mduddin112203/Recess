import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAuth } from './AuthContext';
import { COLORS, DARK_COLORS } from '../utils/constants';

export type ThemeColors = typeof COLORS;

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: COLORS,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const systemScheme = useColorScheme();

  const { colors, isDark } = useMemo(() => {
    const preference = profile?.theme_preference || 'system';
    let dark = false;

    if (preference === 'dark') {
      dark = true;
    } else if (preference === 'light') {
      dark = false;
    } else {
      // system default
      dark = systemScheme === 'dark';
    }

    return {
      colors: dark ? DARK_COLORS : COLORS,
      isDark: dark,
    };
  }, [profile?.theme_preference, systemScheme]);

  return (
    <ThemeContext.Provider value={{ colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
