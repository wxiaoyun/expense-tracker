import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Setting",
          headerTransparent: true,
          headerBlurEffect: "regular",
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
