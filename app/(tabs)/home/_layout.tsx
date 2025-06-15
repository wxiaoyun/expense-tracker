import { format } from "date-fns";
import { router, Stack } from "expo-router";
import { debounce } from "lodash";
import { useCallback } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { TransactionDropdown } from "@/components/transactions/header-drop-down";
import { UrlFilter, useDateRange } from "@/hooks/useParams";

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce((text: string) => {
      router.setParams({
        search: text,
      } satisfies UrlFilter);
    }, 200),
    [],
  );

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
            headerRight: () => (
              <TransactionDropdown />
            ),
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
