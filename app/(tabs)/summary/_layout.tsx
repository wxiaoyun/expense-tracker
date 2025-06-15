import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { TouchableOpacity } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import * as Haptics from "expo-haptics";

export default function SummaryLayout() {
  const router = useRouter();
  const textColor = useThemeColor("text");

  const onPressFilter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/summary/filter");
  };

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Summary",
          headerLargeTitle: true,
          headerTransparent: true,
          headerBlurEffect: "regular",
          headerRight: () => (
            <TouchableOpacity onPress={onPressFilter}>
              <Feather name="filter" size={24} color={textColor} />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="filter"
        options={{
          title: "Filter",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
