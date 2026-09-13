import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import {
  MenuView,
  type MenuAction,
  type NativeActionEvent,
} from "@expo/ui/community/menu";
import { format } from "date-fns";

import type { TransactionTemplate } from "@/db/schema";
import { getNextOccurrences, occurrenceToText } from "@/libs/date";
import { formatCurrency } from "@/libs/intl";
import { useThemeColors } from "@/hooks/useThemeColor";

type TemplateRowProps = {
  template: TransactionTemplate;
  onUse: (id: string) => void;
  onQuickAdd: (id: string) => void;
  onEdit: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  quickAddPending?: boolean;
};

const isQuickAddComplete = (template: TransactionTemplate) =>
  template.amount !== null &&
  Number.isFinite(template.amount) &&
  template.amount > 0 &&
  Boolean(template.description?.trim());

const signedAmount = (template: TransactionTemplate) => {
  if (template.amount === null) return null;
  return template.transactionType === "income"
    ? Math.abs(template.amount)
    : -Math.abs(template.amount);
};

export function TemplateRow({
  template,
  onUse,
  onQuickAdd,
  onEdit,
  onPause,
  onResume,
  onDelete,
  quickAddPending = false,
}: TemplateRowProps) {
  const colors = useThemeColors();
  const scheduled = template.recurrenceValue !== null;
  const paused = scheduled && template.scheduleActive !== 1;
  const amount = signedAmount(template);
  const summary =
    [
      template.description?.trim() || null,
      template.category?.trim() || null,
      amount === null ? null : formatCurrency(amount),
    ]
      .filter(Boolean)
      .join(" • ") || "Partial template";
  const nextOccurrence =
    scheduled && !paused
      ? getNextOccurrences(
          template.recurrenceValue!,
          1,
          new Date(
            template.scheduleCursorAt ??
              template.startDate ??
              template.updatedAt,
          ),
        )[0]
      : undefined;

  const actions: MenuAction[] = [
    { id: "edit", title: "Edit", image: "pencil" },
  ];
  if (scheduled) {
    actions.push({
      id: paused ? "resume" : "pause",
      title: paused ? "Resume" : "Pause",
      image: paused ? "play.fill" : "pause.fill",
    });
  }
  actions.push({
    id: "delete",
    title: "Delete",
    image: "trash",
    attributes: { destructive: true },
  });

  const handleMenuAction = ({ nativeEvent }: NativeActionEvent) => {
    switch (nativeEvent.event) {
      case "edit":
        onEdit(template.id);
        break;
      case "pause":
        onPause(template.id);
        break;
      case "resume":
        onResume(template.id);
        break;
      case "delete":
        onDelete(template.id);
        break;
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use ${template.name}`}
          onPress={() => onUse(template.id)}
          style={({ pressed }) => [styles.useArea, pressed && styles.pressed]}
        >
          <View
            accessible
            accessibilityLabel={
              scheduled ? "Scheduled template" : "Manual template"
            }
            style={[
              styles.iconWrap,
              { backgroundColor: colors.primaryBackground },
            ]}
          >
            <Feather
              name={scheduled ? "calendar" : "file-text"}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.body}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: colors.text }]}
            >
              {template.name}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.summary, { color: colors.secondaryText }]}
            >
              {summary}
            </Text>
            <View style={styles.statusRow}>
              <Text
                style={[
                  styles.status,
                  { color: paused ? colors.warning : colors.primary },
                ]}
              >
                {scheduled
                  ? paused
                    ? "Paused"
                    : occurrenceToText(template.recurrenceValue!)
                  : "Manual"}
              </Text>
              {nextOccurrence ? (
                <Text
                  style={[
                    styles.nextOccurrence,
                    { color: colors.secondaryText },
                  ]}
                >
                  Next {format(nextOccurrence, "MMM d, yyyy")}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
        <MenuView actions={actions} onPressAction={handleMenuAction}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${template.name}`}
            hitSlop={8}
            style={({ pressed }) => [
              styles.moreButton,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name="more-horizontal"
              size={22}
              color={colors.secondaryText}
            />
          </Pressable>
        </MenuView>
      </View>
      {isQuickAddComplete(template) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Quick add ${template.name}`}
          accessibilityState={{ disabled: quickAddPending }}
          disabled={quickAddPending}
          onPress={() => onQuickAdd(template.id)}
          style={({ pressed }) => [
            styles.quickAdd,
            { backgroundColor: colors.fill },
            (pressed || quickAddPending) && styles.quickAddDisabled,
          ]}
        >
          <Feather name="plus" size={15} color={colors.primary} />
          <Text style={[styles.quickAddText, { color: colors.primary }]}>
            {quickAddPending ? "Adding…" : "Quick Add"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 5,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  useArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    paddingLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  summary: {
    fontSize: 13,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 5,
  },
  status: {
    fontSize: 12,
    fontWeight: "600",
  },
  nextOccurrence: {
    fontSize: 12,
  },
  moreButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAdd: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginTop: 12,
  },
  quickAddText: {
    fontSize: 14,
    fontWeight: "500",
  },
  quickAddDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
