import { useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import { GlassView } from '@/components/glass/GlassView';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

// Theme context (simple)
export const useTheme = () => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    background: isDark ? '#000' : '#fff',
    text: isDark ? '#fff' : '#000',
    primary: isDark ? '#0a84ff' : '#007aff',
    backgroundSecondary: isDark ? '#1c1c1ce6' : '#f2f2f7',
  };
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const theme = useTheme();

  useEffect(() => {
    // Optionally set StatusBar style based on theme
    StatusBar.setBarStyle(theme.text === '#000' ? 'dark-content' : 'light-content');
  }, [theme]);

  return (
    <Provider>
      <QueryClientProvider client={queryClient}>
        <GlassView style={{ backgroundColor: theme.backgroundSecondary }}>
          {/* Screens will be rendered here by expo-router */}
          <Slot />
        </GlassView>
      </QueryClientProvider>
    </Provider>
  );
}
