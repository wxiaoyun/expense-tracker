import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

const GlassView: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => {
  if (Platform.OS === 'ios') {
    return (
      <BlurView style={[styles.container, style]} blurType="systemUltraThinMaterial" intensity={100}>
        {children}
      </BlurView>
    );
  }
  // Fallback for non-iOS (should not happen in our iOS-only app, but keep for safety)
  return <View style={[styles.container, style, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default GlassView;
