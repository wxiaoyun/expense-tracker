import { APP_NAME } from "@/constants";
import { queryClient } from "@/hooks/useQuery";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import "react-native-reanimated";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

export default function RootLayout() {
  const colorScheme = useColorScheme() === "dark" ? DarkTheme : DefaultTheme;

  return (
    <SQLiteProvider databaseName={`${APP_NAME}.db`}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="backup" options={{ headerShown: false }} />
              <Stack.Screen name="dev" options={{ headerShown: false }} />
              <Stack.Screen name="theme" options={{ headerShown: false }} />
              <Stack.Screen name="week_start" options={{ headerShown: false }} />
              <Stack.Screen name="currency" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" animated />
          </SafeAreaProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SQLiteProvider>
  );
}
