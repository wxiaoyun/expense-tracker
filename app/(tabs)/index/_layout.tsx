import { format } from "date-fns";
import { Stack } from "expo-router";
import { View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { TransactionDropdown } from "@/components/transactions/header-drop-down";
import { debouncedSetSearch, useDateRange } from "@/hooks/useFilter";

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

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Transactions",
          headerShown: true,
          headerTransparent: true,
          headerBlurEffect: "regular",
          headerLeft: () => <HeaderLeft />,
          headerRight: () => <TransactionDropdown />,
          headerSearchBarOptions: {
            placeholder: "Search",
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
