import { StyleSheet } from "react-native";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";


export const TransactionFilter = () => {
  return (
    <ThemedView>
      <ThemedText style={styles.bottomSheetTitle}>
        Filter Transactions
      </ThemedText>
      <ThemedText>Filter options will go here...</ThemedText>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
});
