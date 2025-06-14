import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { router, Stack } from "expo-router";
import { debounce } from "lodash";
import { useCallback, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemedText } from "@/components/ThemedText";
import { TransactionOperations } from "@/components/transactions/create-modal";
import { TransactionFilter } from "@/components/transactions/filter";
import { UrlFilter, useDateRange } from "@/hooks/useParams";
import { formatDate } from "@/libs/date";

const HeaderLeft = () => {
  const { dateRange } = useDateRange();

  return (
    <View
      style={{ flexDirection: "column", alignItems: "flex-start", gap: -4 }}
    >
      <ThemedText style={{ fontSize: 12, lineHeight: 16 }}>
        {`From ${formatDate(dateRange.start)}`}
      </ThemedText>
      <ThemedText style={{ fontSize: 12, lineHeight: 16 }}>
        {`To ${formatDate(dateRange.end)}`}
      </ThemedText>
    </View>
  );
};

export default function Layout() {
  const snapPoints = useMemo(() => ["25%", "50%"], []);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const handleOpenBottomSheet = useCallback(() => {
    bottomSheetRef.current?.expand();
  }, []);

  const debouncedSetSearch = useCallback(
    debounce((text: string) => {
      router.setParams({
        search: text,
      } satisfies UrlFilter);
    }, 200),
    [],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: "Transactions",
            headerTransparent: true,
            headerBlurEffect: "regular",
            headerLargeTitle: true,
            headerLeft: () => <HeaderLeft />,
            headerRight: () => (
              <TransactionOperations onOpenFilter={handleOpenBottomSheet} />
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

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <TransactionFilter />
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bottomSheetContent: {
    flex: 1,
    padding: 24,
  },
});
