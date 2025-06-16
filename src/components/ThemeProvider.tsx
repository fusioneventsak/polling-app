import React, { createContext, useContext, useEffect, useState } from 'react';
import type { RoomSettings } from '../types';

interface ThemeContextType {
  settings: RoomSettings | null;
  applyTheme: (settings: RoomSettings) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<RoomSettings | null>(null);

  const applyTheme = (newSettings: RoomSettings) => {
    setSettings(newSettings);
    
    // Apply CSS custom properties for theming
    const root = document.documentElement;
    
    if (newSettings.theme) {
      if (newSettings.theme.primary_color) {
        root.style.setProperty('--color-primary', newSettings.theme.primary_color);
      }
      if (newSettings.theme.secondary_color) {
        root.style.setProperty('--color-secondary', newSettings.theme.secondary_color);
      }
      if (newSettings.theme.accent_color) {
        root.style.setProperty('--color-accent', newSettings.theme.accent_color);
      }
      if (newSettings.theme.text_color) {
        root.style.setProperty('--color-text', newSettings.theme.text_color);
      }
    }
  };

  const resetTheme = () => {
    setSettings(null);
    
    // Reset CSS custom properties
    const root = document.documentElement;
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-secondary');
    root.style.removeProperty('--color-accent');
    root.style.removeProperty('--color-text');
  };

  const value = {
    settings,
    applyTheme,
    resetTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};