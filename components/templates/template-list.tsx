import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";

import type { TransactionTemplate } from "@/db/schema";
import { useThemeColors } from "@/hooks/useThemeColor";
import { TemplateRow } from "./template-row";

type TemplateListProps = {
  templates: TransactionTemplate[];
  isLoading?: boolean;
  quickAddPendingIds?: readonly string[];
  onQuickAdd: (id: string) => void;
  onEdit: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
};

export function TemplateList({
  templates,
  isLoading = false,
  quickAddPendingIds = [],
  onQuickAdd,
  onEdit,
  onPause,
  onResume,
  onDelete,
}: TemplateListProps) {
  const colors = useThemeColors();
  const renderItem = React.useCallback(
    ({ item }: { item: TransactionTemplate }) => (
      <TemplateRow
        template={item}
        quickAddPending={quickAddPendingIds.includes(item.id)}
        onQuickAdd={onQuickAdd}
        onEdit={onEdit}
        onPause={onPause}
        onResume={onResume}
        onDelete={onDelete}
      />
    ),
    [
      quickAddPendingIds,
      onQuickAdd,
      onEdit,
      onPause,
      onResume,
      onDelete,
    ],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
          Loading templates…
        </Text>
      </View>
    );
  }

  if (templates.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No Templates Yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
          Tap the + button to add your first template
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={templates}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.contentContainer}
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 110,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
  },
});
