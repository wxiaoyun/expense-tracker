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
import {
  usePeriodicBackup,
  useRecurringTransactionIncur,
} from "@/hooks/useRecurring";

const formSheetOptions = {
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetExpandsWhenScrolledToEdge: false,
  sheetCornerRadius: 10,
} as const;

export default function App() {
  const colorScheme = useColorScheme() === "dark" ? DarkTheme : DefaultTheme;
  const { success, error } = useMigrations(db, migrations);

  useRecurringTransactionIncur(success);
  usePeriodicBackup();

  if (error) {
    return <ThemedText>Error: {error.message}</ThemedText>;
  }

  if (!success) {
    return <ThemedText>Loading...</ThemedText>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <Toaster />
            <AppLayout />
            <StatusBar style="auto" animated />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const AppLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="(transactions)/new"
        options={{
          presentation: "modal",
          title: "New Transaction",
        }}
      />
      <Stack.Screen
        name="(transactions)/edit"
        options={{
          presentation: "modal",
          title: "Edit Transaction",
        }}
      />
      <Stack.Screen
        name="(transactions)/filter"
        options={{
          ...formSheetOptions,
          title: "Filter Options",
        }}
      />
      <Stack.Screen
        name="(recurring)/new"
        options={{
          presentation: "modal",
          title: "New Recurring Transaction",
        }}
      />
      <Stack.Screen
        name="(recurring)/edit"
        options={{
          presentation: "modal",
          title: "Edit Recurring Transaction",
        }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
};
