import { ThemedText } from "@/components/ThemedText";

import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TransactionFilter() {
  return (
    <SafeAreaView>
      <ThemedText style={styles.bottomSheetTitle}>
        Filter Transactions
      </ThemedText>
      <ThemedText>Filter options will go here...</ThemedText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
});
