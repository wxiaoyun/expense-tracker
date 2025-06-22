import { useField, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { z } from "zod/v4";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { COMMON_RECURRENCES } from "@/constants";
import { createRecurringTransaction } from "@/db/recurring";
import { useCurrency } from "@/hooks/useKv";
import {
  RECURRING_TRANSACTIONS_QUERY_KEY,
  useCategoriesQuery,
} from "@/hooks/useQuery";
import { useThemeColor } from "@/hooks/useThemeColor";
import { validateOccurrence } from "@/libs/date";

// Schema for new recurring transaction form
export const NewRecurringTransactionFormSchema = z.object({
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

export type NewRecurringTransactionForm = z.infer<
  typeof NewRecurringTransactionFormSchema
>;

export default function Page() {
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
  const mutation = useMutation({
    mutationFn: async (data: NewRecurringTransactionForm) => {
      const valueWithSign = {
        ...data,
        amount: parseFloat(data.amount) * (isExpense ? -1 : 1),
      };
      return createRecurringTransaction(valueWithSign);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY],
      });
      toast.success("Recurring transaction created successfully");
      form.reset();
      router.back();
    },
    onError: (error: any) => {
      console.error("[UI] Error creating recurring transaction", error);
      const errorMessage =
        error?.message ||
        error?.toString() ||
        "Failed to create recurring transaction";
      toast.error(errorMessage);
    },
  });

  const form = useForm({
    defaultValues: {
      amount: "0",
      startDate: Date.now(),
      category: "",
      description: "",
      recurrenceValue: "",
    } as NewRecurringTransactionForm,
    validators: {
      onChange: NewRecurringTransactionFormSchema,
    },
    onSubmit: ({ value }) => {
      mutation.mutate(value);
    },
  });

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
                      backgroundColor: isExpense ? destructiveColor : "#22c55e",
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

        <form.Field name="description">
          {(field) => (
            <ThemedView>
              <TextInput
                autoFocus
                style={[
                  styles.descriptionInput,
                  { color: textColor, borderColor },
                ]}
                placeholder="Description"
                placeholderTextColor={textColor + "80"}
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
                ? "Creating..."
                : "Create Recurring Transaction"}
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
});
