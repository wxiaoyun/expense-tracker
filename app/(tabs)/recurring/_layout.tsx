import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useCallback } from "react";
import { TouchableOpacity } from "react-native";

import { debouncedSetSearch } from "@/hooks/useFilter";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function Layout() {
  const router = useRouter();
  const textColor = useThemeColor("text");

  const onClickAdd = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(recurring)/new");
  }, [router]);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Recurring",
          headerShown: true,
          headerTransparent: true,
          headerBlurEffect: "regular",
          headerRight: () => (
            <TouchableOpacity onPress={onClickAdd}>
              <Feather name="plus" size={24} color={textColor} />
            </TouchableOpacity>
          ),
          headerSearchBarOptions: {
            placeholder: "Search recurring transactions",
            hideWhenScrolling: true,
            onChangeText: (e) => {
              debouncedSetSearch(e.nativeEvent.text);
            },
          },
        }}
      />
    </Stack>
  );
}
