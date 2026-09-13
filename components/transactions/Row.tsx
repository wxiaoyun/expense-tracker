import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { format } from "date-fns";
import Feather from "@expo/vector-icons/Feather";

import { Transaction } from "@/db/schema";
import { useThemeColors } from "@/hooks/useThemeColor";
import { formatCurrency } from "@/libs/intl";
import { TransactionMenu } from "./transaction-menu";

type TransactionRowProps = {
  transaction: Transaction;
  hasActiveTemplate: boolean;
  onToggleVerified: (id: string, verified: boolean) => void;
  onEdit: (id: string) => void;
  onSaveAsTemplate: (id: string) => void;
  onViewTemplate: (templateId: string) => void;
  onDelete: (id: string) => void;
};

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  hasActiveTemplate,
  onToggleVerified,
  onEdit,
  onSaveAsTemplate,
  onViewTemplate,
  onDelete,
}) => {
  const { destructive, secondaryText, success, surface, text } =
    useThemeColors();
  const isExpense = transaction.amount < 0;
  const amountColor = isExpense ? destructive : success;

  return (
    <View style={[styles.card, { backgroundColor: surface }]}>
      <View style={styles.content}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Mark ${transaction.description} verified`}
          accessibilityState={{ checked: Boolean(transaction.verified) }}
          hitSlop={10}
          onPress={() =>
            onToggleVerified(transaction.id, !transaction.verified)
          }
        >
          <Feather
            name={transaction.verified ? "check-circle" : "circle"}
            size={24}
            color={transaction.verified ? success : amountColor}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${transaction.description}`}
          onPress={() => onEdit(transaction.id)}
          style={({ pressed }) => [
            styles.editTarget,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.body}>
            <Text
              numberOfLines={1}
              style={[styles.description, { color: text }]}
            >
              {transaction.description}
            </Text>
            <Text style={[styles.amount, { color: amountColor }]}>
              {formatCurrency(transaction.amount)}
            </Text>
            <View style={styles.meta}>
              <Text style={[styles.metaText, { color: secondaryText }]}>
                {format(transaction.transactionDate, "MMM d, yyyy")}
              </Text>
              <Text style={[styles.metaText, { color: secondaryText }]}>
                {transaction.category}
              </Text>
            </View>
          </View>
        </Pressable>
        <TransactionMenu
          transactionId={transaction.id}
          description={transaction.description}
          templateId={transaction.templateId}
          hasActiveTemplate={hasActiveTemplate}
          onEdit={onEdit}
          onSaveAsTemplate={onSaveAsTemplate}
          onViewTemplate={onViewTemplate}
          onDelete={onDelete}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 16,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  editTarget: {
    flex: 1,
    marginLeft: 12,
  },
  body: {
    flex: 1,
  },
  description: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
  },
  amount: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 4,
  },
  pressed: {
    opacity: 0.55,
  },
});
