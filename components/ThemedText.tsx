import React from 'react';
import { Text, TextProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

export const ThemedText: React.FC<TextProps & { type?: 'default' | 'title' | 'subtitle' }> = ({
  children,
  style,
  type = 'default',
  ...props
}) => {
  const color = useThemeColor('text');
  const typeStyle =
    type === 'title'
      ? { fontSize: 24, fontWeight: '600' as const }
      : type === 'subtitle'
      ? { fontSize: 18, fontWeight: '500' as const, opacity: 0.8 }
      : {};
  return (
    <Text style={[{ color }, typeStyle, style]} {...props}>
      {children}
   </Text>
  );
};
