import { useRouter } from "expo-router";
import Fuse from "fuse.js";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { TransactionList } from "@/components/transactions/list";
import { deleteTransaction, setVerification } from "@/db/transaction";
import { useCategoryFilter, useDateRange, useSearch } from "@/hooks/useParams";
import {
  invalidateTransactionQueries,
  useInfiniteTransactionListQuery,
} from "@/hooks/useQuery";
import { useThemeColor } from "@/hooks/useThemeColor";
import { showConfirmDialog } from "@/libs/dialog";

export default function HomeScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor("background");
  const textColor = useThemeColor("text");

  const { dateRange } = useDateRange();
  const [categories] = useCategoryFilter();
  const [search] = useSearch();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteTransactionListQuery({
    start: dateRange.start,
    end: dateRange.end,
    limit: 50, // Load 50 transactions per page
    orderBy: ["transactionDate", "DESC"],
    categories,
  });

  const allTransactions = useMemo(() => {
    if (!data?.pages) return [];
    const result = data.pages.flatMap((page) => page.items);
    console.log("Transactions loaded:", result.length);
    return result;
  }, [data]);

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

    return new Fuse(allTransactions, fuseOptions);
  }, [allTransactions]);

  // Filter transactions based on search query using fuzzy search
  const transactions = useMemo(() => {
    if (!search || search.trim() === "") {
      return allTransactions;
    }

    const searchResults = fuse.search(search.trim());
    console.log(
      `Fuzzy search for "${search}" returned ${searchResults.length} results`,
    );

    // Extract the transaction objects from Fuse.js results
    return searchResults.map((result) => result.item);
  }, [allTransactions, fuse, search]);

  const handleToggleVerified = useCallback(
    async (id: number, verified: boolean) => {
      try {
        console.log(`Toggle verification for transaction ${id}: ${verified}`);
        await setVerification(id, verified ? 1 : 0);
        // Invalidate queries to refresh the data
        invalidateTransactionQueries();
      } catch (error) {
        console.error("Failed to update verification:", error);
        Alert.alert("Error", "Failed to update transaction verification");
      }
    },
    [],
  );

  const handleEdit = useCallback(
    (id: number, onComplete?: () => void) => {
      console.log(`Edit transaction ${id}`);
      router.push({
        pathname: "/(transactions)/edit",
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
        "Delete Transaction",
        "Are you sure you want to delete this transaction?",
      );

      if (!confirmed) {
        onComplete?.();
        return;
      }

      try {
        console.log(`Confirmed delete transaction ${id}`);
        await deleteTransaction(id);
        // Invalidate queries to refresh the data
        invalidateTransactionQueries();
      } catch (error) {
        console.error("Failed to delete transaction:", error);
        Alert.alert("Error", "Failed to delete transaction");
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
          Loading transactions...
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
          Error loading transactions
        </ThemedText>
        <ThemedText style={{ textAlign: "center", opacity: 0.7 }}>
          {error.message || "Something went wrong"}
        </ThemedText>
      </View>
    );
  }

  return (
    <TransactionList
      onEdit={handleEdit}
      onDelete={handleDelete}
      onToggleVerified={handleToggleVerified}
      transactions={transactions}
      onLoadMore={hasNextPage ? fetchNextPage : undefined}
      isLoadingMore={isFetchingNextPage}
    />
  );
}
