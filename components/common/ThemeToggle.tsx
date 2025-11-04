import React from 'react';
import { SunIcon, MoonIcon } from '../icons/index.tsx';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-button"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? 
        <MoonIcon style={{height: '24px', width: '24px'}} /> : 
        <SunIcon style={{height: '24px', width: '24px'}} />
      }
    </button>
  );
};