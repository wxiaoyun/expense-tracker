import { Stack } from 'expo-router';

export default function SettingLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Setting',
          headerLargeTitle: true,
          headerShown: true,
          headerBlurEffect: 'regular',
          headerTransparent: true,
        }}
      />
    </Stack>
  );
} 