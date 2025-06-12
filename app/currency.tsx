import { FlashList } from "@shopify/flash-list";
import { codes } from "currency-codes";
import { Stack } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useCurrency } from "@/hooks/useKv";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";

export default function Page() {
  const [currency, setCurrency] = useCurrency();
  const [search, setSearch] = useState("");

  const currencyOptions = useMemo(() => {
    const allCodes = codes();
    if (search.length === 0) {
      return allCodes;
    }

    return allCodes.filter((code) =>
      code.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search]);

  return (
    <View style={styles.viewContainer}>
      <Stack.Screen
        options={{
          title: "Currency Settings",
          headerBackTitle: "Back",
          headerSearchBarOptions: {
            placeholder: "Search currency",
            onChangeText: (e) => {
              setSearch(e.nativeEvent.text);
            },
          },
          headerBlurEffect: "regular",
          headerTransparent: true,
        }}
      />
      <FlashList
        data={currencyOptions}
        estimatedItemSize={44}
        contentInsetAdjustmentBehavior="automatic"
        extraData={currency}
        renderItem={({ item }) => (
          <Item item={item} currency={currency} onPress={setCurrency} />
        )}
      />
    </View>
  );
}

type ItemProps = {
  item: string;
  currency: string;
  onPress: (item: string) => void;
};

const Item = ({ item, currency, onPress }: ItemProps) => {
  const iconColor = useThemeColor("icon");

  return (
    <TouchableOpacity onPress={() => onPress(item)}>
      <ThemedView style={styles.item}>
        <ThemedText>{item}</ThemedText>
        {currency === item ? (
          <Ionicons name="checkmark" size={24} color={iconColor} />
        ) : null}
      </ThemedView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  viewContainer: {
    flex: 1,
    height: "100%",
  },
  item: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "space-between",
    alignItems: "center",
    height: 44,
  },
});
