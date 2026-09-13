import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColor";

export function AppRoot({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  const isDark = useColorScheme() === "dark";

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StatusBar style={isDark ? "light" : "dark"} animated />
      {children}
      <Toaster position="top-center" theme={isDark ? "dark" : "light"} />
    </GestureHandlerRootView>
  );
}
