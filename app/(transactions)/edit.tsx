import { useField, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import Fuse from "fuse.js";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity } from "react-native";
import DatePicker from "react-native-date-picker";
import { ScrollView } from "react-native-gesture-handler";
import { toast } from "sonner-native";
import { z } from "zod/v4";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { updateTransaction } from "@/db/transaction";
import { useCurrency } from "@/hooks/useKv";
import {
  TRANSACTIONS_QUERY_KEY,
  useCategoriesQuery,
  useTransactionQuery,
} from "@/hooks/useQuery";
import { useThemeColor } from "@/hooks/useThemeColor";

// Schema for edit transaction form
export const EditTransactionFormSchema = z.object({
  amount: z.number(),
  transactionDate: z.number().int().positive(),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  verified: z.number().int().min(0).max(1),
});

export type EditTransactionForm = z.infer<typeof EditTransactionFormSchema>;

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const backgroundColor = useThemeColor("background");
  const textColor = useThemeColor("text");
  const borderColor = useThemeColor("text") + "20";
  const destructiveColor = useThemeColor("destructive");
  const [currency] = useCurrency();

  // UI state (not form data)
  const [isExpense, setIsExpense] = useState(true);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const openDatePicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsDatePickerOpen(true);
  }, [setIsDatePickerOpen]);

  const queryClient = useQueryClient();
  const router = useRouter();

  // Fetch the transaction to edit
  const { data: transaction, isLoading } = useTransactionQuery(Number(id));

  const mutation = useMutation({
    mutationFn: async (data: EditTransactionForm) => {
      if (!transaction) throw new Error("Transaction not found");
      const valueWithSign = {
        ...data,
        amount: data.amount * (isExpense ? -1 : 1),
      };
      return updateTransaction({
        ...transaction,
        ...valueWithSign,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
      toast.success("Transaction updated successfully");
      router.back();
    },
    onError: (error: any) => {
      console.error("[UI] Error updating transaction", error);
      const errorMessage =
        error?.message || error?.toString() || "Failed to update transaction";
      toast.error(errorMessage);
    },
  });

  const form = useForm({
    defaultValues: {
      amount: Math.abs(transaction?.amount || 0),
      transactionDate: transaction?.transactionDate || Date.now(),
      category: transaction?.category || "",
      description: transaction?.description || "",
      verified: transaction?.verified || 0,
    } as EditTransactionForm,
    validators: {
      onChange: EditTransactionFormSchema,
    },
    onSubmit: ({ value }) => {
      mutation.mutate(value);
    },
  });

  // Set initial expense/income state based on transaction amount
  React.useEffect(() => {
    if (transaction) {
      setIsExpense(transaction.amount < 0);
      form.setFieldValue("amount", Math.abs(transaction.amount));
      form.setFieldValue("transactionDate", transaction.transactionDate);
      form.setFieldValue("category", transaction.category);
      form.setFieldValue("description", transaction.description);
      form.setFieldValue("verified", transaction.verified);
    }
  }, [transaction, form]);

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
        <ThemedText>Loading transaction...</ThemedText>
      </ThemedView>
    );
  }

  if (!transaction) {
    return (
      <ThemedView style={styles.centeredView}>
        <ThemedText>Transaction not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor }]}
      keyboardShouldPersistTaps="always"
    >
      <form.Field name="transactionDate">
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
              onCancel={() => setIsDatePickerOpen(false)}
              date={new Date(field.state.value)}
              onDateChange={(date) => field.handleChange(date.getTime())}
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
                autoFocus
                style={[styles.amountInput, { color: textColor }]}
                placeholder="0.00"
                placeholderTextColor={textColor + "80"}
                value={
                  field.state.value === 0
                    ? ""
                    : Math.abs(field.state.value).toString()
                }
                onChangeText={(text) => {
                  const numValue = parseFloat(text) || 0;
                  field.handleChange(numValue);
                }}
                keyboardType="numeric"
              />
              <ThemedText style={styles.currencySymbol}>{currency}</ThemedText>
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
              style={[styles.categoryInput, { color: textColor, borderColor }]}
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
            {mutation.isPending ? "Updating..." : "Update Transaction"}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
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
  categoriesButtonsContainer: {
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
