import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList } from "@shopify/flash-list";
import { codes } from "currency-codes";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useCurrency } from "@/hooks/useKv";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function Page() {
  const [currency, setCurrency] = useCurrency();
  const [search, setSearch] = useState("");

  const currencyOptions = useMemo(() => {
    const allCodes = codes();
    let filteredCodes = search.length === 0
      ? allCodes
      : allCodes.filter((code) =>
          code.toLowerCase().includes(search.toLowerCase())
        );

    filteredCodes = [
      ...filteredCodes.filter(code => code === currency),
      ...filteredCodes.filter(code => code !== currency)
    ];

    return filteredCodes;
  }, [search, currency]);

    return (
    <View style={styles.viewContainer}>
      <Stack.Screen
        options={{
          title: "Currency",
          headerBackTitle: "Back",
          headerSearchBarOptions: {
            placeholder: "Search currency",
            onChangeText: (e) => {
              setSearch(e.nativeEvent.text);
            },
          },
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
