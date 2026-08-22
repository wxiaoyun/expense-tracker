export const useThemeColor = (key: 'text' | 'background' | 'backgroundSecondary' | 'primary') => {
  const colors = {
    text: '#000',
    background: '#fff',
    backgroundSecondary: '#f2f2f7',
    primary: '#007aff',
  };
  return colors[key];
};
