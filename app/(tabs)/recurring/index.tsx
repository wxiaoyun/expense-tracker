import { useRouter } from "expo-router";
import Fuse from "fuse.js";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { RecurringTransactionList } from "@/components/recurring/list";
import { deleteRecurringTransaction, incurRecurringTransaction } from "@/db/recurring";
import { useCategoryFilter, useSearch } from "@/hooks/useFilter";
import {
  invalidateRecurringTransactionsQueries,
  useRecurringTransactionListQuery,
} from "@/hooks/useQuery";
import { useThemeColor } from "@/hooks/useThemeColor";
import { showConfirmDialog } from "@/libs/dialog";
import { toast } from "sonner-native";

export default function RecurringTransactionsScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor("background");
  const textColor = useThemeColor("text");

  const [categories] = useCategoryFilter();
  const [search] = useSearch();

  const {
    data: recurringTransactions = [],
    isLoading,
    error,
  } = useRecurringTransactionListQuery({
    categories,
  });

  const fuse = useMemo(() => {
    const fuseOptions = {
      keys: [
        {
          name: "description",
          weight: 0.7,
        },
        {
          name: "category",
          weight: 0.3,
        },
      ],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 1,
    };

    return new Fuse(recurringTransactions, fuseOptions);
  }, [recurringTransactions]);

  // Filter recurring transactions based on search query using fuzzy search
  const filteredRecurringTransactions = useMemo(() => {
    if (!search || search.trim() === "") {
      return recurringTransactions;
    }

    const searchResults = fuse.search(search.trim());
    console.log(
      `Fuzzy search for "${search}" returned ${searchResults.length} results`,
    );

    // Extract the recurring transaction objects from Fuse.js results
    return searchResults.map((result) => result.item);
  }, [recurringTransactions, fuse, search]);

  const handleEdit = useCallback(
    (id: number, onComplete?: () => void) => {
      console.log(`Edit recurring transaction ${id}`);
      router.push({
        pathname: "/(recurring)/edit",
        params: { id },
      });
      // Call the callback to reset the swipe position
      onComplete?.();
    },
    [router],
  );

  const handleDelete = useCallback(
    async (id: number, onComplete?: () => void) => {
      const confirmed = await showConfirmDialog(
        "Delete Recurring Transaction",
        "Are you sure you want to delete this recurring transaction? This will not affect transactions that have already been created from it.",
      );

      if (!confirmed) {
        onComplete?.();
        return;
      }

      try {
        console.log(`Confirmed delete recurring transaction ${id}`);
        await deleteRecurringTransaction(id);
        // Invalidate queries to refresh the data
        invalidateRecurringTransactionsQueries();
      } catch (error) {
        console.error("Failed to delete recurring transaction:", error);
        Alert.alert("Error", "Failed to delete recurring transaction");
      } finally {
        onComplete?.();
      }
    },
    [],
  );

  const handleIncur = useCallback(
    async (id: number, onComplete?: () => void) => {
      const confirmed = await showConfirmDialog(
        "Create Transactions",
        "This will create all pending transactions for this recurring entry. Continue?",
      );

      if (!confirmed) {
        onComplete?.();
        return;
      }

      try {
        console.log(`Incurring recurring transaction ${id}`);
        const incurredCount = await incurRecurringTransaction(id);
        
        if (incurredCount === null) {
          Alert.alert("Error", "Failed to create transactions");
        } else if (incurredCount === 0) {
          toast.info("No new transactions to create");
        } else {
          toast.success(`Created ${incurredCount} transaction${incurredCount === 1 ? '' : 's'}`);
        }
        
        // Invalidate queries to refresh the data
        invalidateRecurringTransactionsQueries();
      } catch (error) {
        console.error("Failed to incur recurring transaction:", error);
        Alert.alert("Error", "Failed to create transactions");
      } finally {
        onComplete?.();
      }
    },
    [],
  );

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={textColor} />
        <ThemedText style={{ marginTop: 16 }}>
          Loading recurring transactions...
        </ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <ThemedText style={{ fontSize: 18, marginBottom: 8 }}>
          Error loading recurring transactions
        </ThemedText>
        <ThemedText style={{ textAlign: "center", opacity: 0.7 }}>
          {error.message || "Something went wrong"}
        </ThemedText>
      </View>
    );
  }

  return (
    <RecurringTransactionList
      onEdit={handleEdit}
      onDelete={handleDelete}
      onIncur={handleIncur}
      recurringTransactions={filteredRecurringTransactions}
    />
  );
}
