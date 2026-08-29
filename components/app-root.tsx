import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toaster } from 'sonner-native';

export function AppRoot({ children }: { children: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {children}
      <Toaster position="top-center" />
    </GestureHandlerRootView>
  );
}
