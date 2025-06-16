import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useDateRange } from "@/hooks/useFilter";
import { useThemeColor } from "@/hooks/useThemeColor";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";

const HeaderLeft = () => {
  const { dateRange } = useDateRange();

  return (
    <View
      style={{ flexDirection: "column", alignItems: "flex-start", gap: -4 }}
    >
      <ThemedText style={{ fontSize: 12, lineHeight: 16 }}>
        {`From ${format(dateRange.start, "iii, MMM dd")}`}
      </ThemedText>
      <ThemedText style={{ fontSize: 12, lineHeight: 16 }}>
        {`To ${format(dateRange.end, "iii, MMM dd")}`}
      </ThemedText>
    </View>
  );
};

export default function SummaryLayout() {
  const router = useRouter();
  const textColor = useThemeColor("text");

  const onPressFilter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(transactions)/filter");
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
          headerLeft: () => <HeaderLeft />,
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
