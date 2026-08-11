import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export function AppRoot({ children }: { children: React.ReactNode }) {
  return <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>;
}
