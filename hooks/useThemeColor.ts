import { useColorScheme } from 'react-native';

export const useThemeColor = (key: 'text' | 'background' | 'backgroundSecondary' | 'primary') => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = {
    text: isDark ? '#fff' : '#000',
    background: isDark ? '#000' : '#fff',
    backgroundSecondary: isDark ? '#1c1c1e' : '#f2f2f7',
    primary: isDark ? '#0a84ff' : '#007aff',
  };
  return colors[key];
};
