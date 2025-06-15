import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { Toaster } from "sonner-native";

import { ThemedText } from "@/components/ThemedText";
import { db } from "@/db";
import migrations from "@/drizzle/migrations";
import { queryClient } from "@/hooks/useQuery";

const formSheetOptions = {
  presentation: "modal",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetExpandsWhenScrolledToEdge: false,
  sheetCornerRadius: 10,
} as const;

export default function RootLayout() {
  const colorScheme = useColorScheme() === "dark" ? DarkTheme : DefaultTheme;

  return (
    <MigrateDatabase>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
              <Toaster />
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="(transactions)/new"
                  options={{
                    ...formSheetOptions,
                    title: "New Transaction",
                  }}
                />
                <Stack.Screen
                  name="(transactions)/edit"
                  options={{
                    ...formSheetOptions,
                    title: "Edit Transaction",
                  }}
                />
                <Stack.Screen
                  name="(transactions)/filter"
                  options={{
                    ...formSheetOptions,
                    title: "Filter Transactions",
                  }}
                />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" animated />
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </ThemeProvider>
      </QueryClientProvider>
    </MigrateDatabase>
  );
}

const MigrateDatabase: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { success, error } = useMigrations(db, migrations);
  if (error) {
    throw error;
  }
  if (!success) {
    return <ThemedText>Loading...</ThemedText>;
  }
  return <>{children}</>;
};
