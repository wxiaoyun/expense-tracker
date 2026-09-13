import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';

const GlassView: React.FC<{ children?: React.ReactNode; style?: any; intensity?: number }> = ({ children, style, intensity = 60 }) => {
  const colorScheme = useColorScheme();
  return (
    <BlurView
      intensity={intensity}
      style={[styles.container, style]}
      tint={colorScheme === 'dark' ? 'dark' : colorScheme === 'light' ? 'light' : 'default'}
    >
      {children}
    </BlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
});

export default GlassView;
