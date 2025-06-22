import { useField, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Fuse from "fuse.js";
import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import DatePicker from "react-native-date-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { z } from "zod/v4";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { COMMON_RECURRENCES } from "@/constants";
import { updateRecurringTransaction } from "@/db/recurring";
import { useCurrency } from "@/hooks/useKv";
import {
  RECURRING_TRANSACTIONS_QUERY_KEY,
  useCategoriesQuery,
  useRecurringTransactionQuery,
} from "@/hooks/useQuery";
import { useThemeColor } from "@/hooks/useThemeColor";
import { validateOccurrence } from "@/libs/date";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView } from "react-native-gesture-handler";

// Schema for edit recurring transaction form
export const EditRecurringTransactionFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, "Amount must be a valid positive number"),
  startDate: z.number().int().positive(),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  recurrenceValue: z
    .string()
    .min(1, "Recurrence is required")
    .refine((data) => {
      const res = validateOccurrence(data);
      return res.ok;
    }, "Invalid cron expression"),
});

export type EditRecurringTransactionForm = z.infer<
  typeof EditRecurringTransactionFormSchema
>;

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const backgroundColor = useThemeColor("background");
  const textColor = useThemeColor("text");
  const borderColor = useThemeColor("text") + "20";
  const destructiveColor = useThemeColor("destructive");
  const [currency] = useCurrency();
  const insets = useSafeAreaInsets();

  // UI state (not form data)
  const [isExpense, setIsExpense] = useState(true);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const openDatePicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsDatePickerOpen(true);
  }, [setIsDatePickerOpen]);

  const queryClient = useQueryClient();
  const router = useRouter();

  // Fetch the recurring transaction to edit
  const { data: recurringTransaction, isLoading } =
    useRecurringTransactionQuery(Number(id));

  const mutation = useMutation({
    mutationFn: async (data: EditRecurringTransactionForm) => {
      if (!recurringTransaction)
        throw new Error("Recurring transaction not found");
      const valueWithSign = {
        ...data,
        amount: parseFloat(data.amount) * (isExpense ? -1 : 1),
      };
      return updateRecurringTransaction({
        ...recurringTransaction,
        ...valueWithSign,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY],
      });
      toast.success("Recurring transaction updated successfully");
      router.back();
    },
    onError: (error: any) => {
      console.error("[UI] Error updating recurring transaction", error);
      const errorMessage =
        error?.message ||
        error?.toString() ||
        "Failed to update recurring transaction";
      toast.error(errorMessage);
    },
  });

  const form = useForm({
    defaultValues: {
      amount: Math.abs(recurringTransaction?.amount || 0).toString(),
      startDate: recurringTransaction?.startDate || Date.now(),
      category: recurringTransaction?.category || "",
      description: recurringTransaction?.description || "",
      recurrenceValue: recurringTransaction?.recurrenceValue || "",
    } as EditRecurringTransactionForm,
    validators: {
      onChange: EditRecurringTransactionFormSchema,
    },
    onSubmit: ({ value }) => {
      mutation.mutate(value);
    },
  });

  // Set initial expense/income state based on recurring transaction amount
  React.useEffect(() => {
    if (recurringTransaction) {
      setIsExpense(recurringTransaction.amount < 0);
      form.setFieldValue(
        "amount",
        Math.abs(recurringTransaction.amount).toString(),
      );
      form.setFieldValue("startDate", recurringTransaction.startDate);
      form.setFieldValue("category", recurringTransaction.category);
      form.setFieldValue("description", recurringTransaction.description);
      form.setFieldValue(
        "recurrenceValue",
        recurringTransaction.recurrenceValue,
      );
    }
  }, [recurringTransaction, form]);

  const { data: categories = [] } = useCategoriesQuery();
  const fuse = useMemo(() => {
    return new Fuse(categories, {
      includeScore: true,
      shouldSort: true,
    });
  }, [categories]);

  const categoryField = useField({
    form,
    name: "category",
  });

  const filteredCategories = useMemo(() => {
    if (!categoryField.state.value) return categories;
    return fuse.search(categoryField.state.value).map((result) => result.item);
  }, [categoryField.state.value, categories, fuse]);

  if (isLoading) {
    return (
      <ThemedView style={styles.centeredView}>
        <ThemedText>Loading recurring transaction...</ThemedText>
      </ThemedView>
    );
  }

  if (!recurringTransaction) {
    return (
      <ThemedView style={styles.centeredView}>
        <ThemedText>Recurring transaction not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor }]}
        keyboardShouldPersistTaps="always"
      >
        <form.Field name="startDate">
          {(field) => (
            <>
              <TouchableOpacity onPress={openDatePicker}>
                <ThemedText style={styles.dateInput}>
                  {format(new Date(field.state.value), "iiii, dd MMMM yyyy")}
                </ThemedText>
              </TouchableOpacity>
              <DatePicker
                modal
                mode="date"
                open={isDatePickerOpen}
                date={new Date(field.state.value)}
                onCancel={() => setIsDatePickerOpen(false)}
                onConfirm={(date) => {
                  setIsDatePickerOpen(false);
                  field.handleChange(date.getTime());
                }}
              />
            </>
          )}
        </form.Field>

        {/* Amount Input with Income/Expense Toggle */}
        <form.Field name="amount">
          {(field) => (
            <ThemedView style={styles.amountContainer}>
              <ThemedView style={styles.amountInputRow}>
                <TextInput
                  style={[styles.amountInput, { color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={textColor + "80"}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  keyboardType="decimal-pad"
                />
                <ThemedText style={styles.currencySymbol}>
                  {currency}
                </ThemedText>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor: isExpense ? "#ef4444" : "#22c55e",
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsExpense(!isExpense);
                  }}
                >
                  <ThemedText style={styles.toggleButtonText}>
                    {isExpense ? "Expense" : "Income"}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
              {field.state.meta.errors.length > 0 && (
                <ThemedView style={styles.errorContainer}>
                  <ThemedText style={styles.errorText}>
                    {field.state.meta.errors[0]?.message}
                  </ThemedText>
                </ThemedView>
              )}
            </ThemedView>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <ThemedView>
              <TextInput
                style={[
                  styles.descriptionInput,
                  { color: textColor, borderColor },
                ]}
                placeholder="Description"
                placeholderTextColor={textColor + "80"}
                value={field.state.value}
                onChangeText={(text) => field.handleChange(text)}
              />
              {field.state.meta.errors.length > 0 && (
                <ThemedView style={styles.errorContainer}>
                  <ThemedText
                    style={[styles.errorText, { color: destructiveColor }]}
                  >
                    {field.state.meta.errors[0]?.message}
                  </ThemedText>
                </ThemedView>
              )}
            </ThemedView>
          )}
        </form.Field>

        <form.Field name="category">
          {(field) => (
            <ThemedView>
              <TextInput
                style={[
                  styles.categoryInput,
                  { color: textColor, borderColor },
                ]}
                placeholder="Category"
                placeholderTextColor={textColor + "80"}
                value={field.state.value}
                onChangeText={(text) => field.handleChange(text)}
              />
              {field.state.meta.errors.length > 0 && (
                <ThemedView style={styles.errorContainer}>
                  <ThemedText
                    style={[styles.errorText, { color: destructiveColor }]}
                  >
                    {field.state.meta.errors[0]?.message}
                  </ThemedText>
                </ThemedView>
              )}
            </ThemedView>
          )}
        </form.Field>

        <form.Field name="category">
          {(field) => (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesButtonsContainer}
              keyboardShouldPersistTaps="always"
            >
              {filteredCategories.map((category) => {
                const isSelected = field.state.value === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.outlinedButton,
                      {
                        borderColor: borderColor,
                        backgroundColor: isSelected
                          ? textColor + "10"
                          : "transparent",
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      field.handleChange(category);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.outlinedButtonText,
                        {
                          color: isSelected ? textColor : textColor + "80",
                          fontWeight: isSelected ? "600" : "500",
                        },
                      ]}
                    >
                      {category}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </form.Field>

        {/* Recurrence Input */}
        <form.Field name="recurrenceValue">
          {(field) => (
            <ThemedView>
              <TextInput
                style={[
                  styles.recurrenceInput,
                  { color: textColor, borderColor },
                ]}
                placeholder="Recurrence (cron expression)"
                placeholderTextColor={textColor + "80"}
                value={field.state.value}
                onChangeText={(text) => field.handleChange(text)}
              />
              {field.state.meta.errors.length > 0 && (
                <ThemedView style={styles.errorContainer}>
                  <ThemedText
                    style={[styles.errorText, { color: destructiveColor }]}
                  >
                    {field.state.meta.errors[0]?.message}
                  </ThemedText>
                </ThemedView>
              )}
            </ThemedView>
          )}
        </form.Field>

        {/* Common Recurrence Options */}
        <form.Field name="recurrenceValue">
          {(field) => (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recurrenceButtonsContainer}
              keyboardShouldPersistTaps="always"
            >
              {COMMON_RECURRENCES.map((recurrence) => {
                const isSelected = field.state.value === recurrence.value;
                return (
                  <TouchableOpacity
                    key={recurrence.value}
                    style={[
                      styles.outlinedButton,
                      {
                        borderColor: borderColor,
                        backgroundColor: isSelected
                          ? textColor + "10"
                          : "transparent",
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      field.handleChange(recurrence.value);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.outlinedButtonText,
                        {
                          color: isSelected ? textColor : textColor + "80",
                          fontWeight: isSelected ? "600" : "500",
                        },
                      ]}
                    >
                      {recurrence.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </form.Field>

        {/* Submit Button */}
        <ThemedView style={styles.submitContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: textColor,
                opacity: mutation.isPending ? 0.7 : 1,
              },
            ]}
            onPress={form.handleSubmit}
            disabled={mutation.isPending}
          >
            <ThemedText
              style={[styles.submitButtonText, { color: backgroundColor }]}
            >
              {mutation.isPending
                ? "Updating..."
                : "Update Recurring Transaction"}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    gap: 12,
  },
  amountContainer: {
    gap: 8,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  currencySymbol: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  amountInput: {
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 32,
    textAlignVertical: "top",
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  toggleButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  dateInput: {
    fontSize: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  descriptionInput: {
    fontSize: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryInput: {
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recurrenceInput: {
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoriesButtonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  recurrenceButtonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  outlinedButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  outlinedButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  errorText: {
    fontSize: 12,
  },
  submitContainer: {
    padding: 16,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
