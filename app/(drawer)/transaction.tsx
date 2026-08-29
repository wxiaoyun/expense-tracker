import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Switch, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getTransaction, createTransaction, updateTransaction } from '@/db/transaction';
import { getTemplate } from '@/db/template';
import { getTransactionInitialFocus } from '@/db/template-core';
import { db } from '@/db';
import { categories as categoriesTable } from '@/db/schema';
import { useInvalidateTransactionsAndTemplates } from '@/hooks/useQueryClient';
import DateTimePicker from '@react-native-community/datetimepicker';

const firstRouteParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

const logTransactionFormError = (stage: string, details: Record<string, unknown>) => {
  console.error(`[transaction.form][stage=${stage}] failed`, { stage, ...details });
};

export default function TransactionDrawer() {
  const params = useLocalSearchParams<{ id?: string | string[], templateId?: string | string[] }>();
  const id = firstRouteParam(params.id);
  const routeTemplateId = firstRouteParam(params.templateId);
  const isEdit = !!id;
  const sourceTemplateId = isEdit ? undefined : routeTemplateId;
  const invalidateTransactionsAndTemplates = useInvalidateTransactionsAndTemplates();

  const amountRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);

  const [amount, setAmount] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [verified, setVerified] = useState(false);
  const [transactionDate, setTransactionDate] = useState(new Date());
  const [availableCategories, setAvailableCategories] = useState<{ name: string; icon: string; color: string }[]>([]);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit || !!sourceTemplateId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !routeTemplateId) return;
    logTransactionFormError('resolve_source', {
      transaction_id_present: true,
      template_id_present: true,
      error: 'Conflicting route sources',
    });
  }, [id, routeTemplateId]);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await db.select().from(categoriesTable).all();
        setAvailableCategories(cats);
      } catch (err) {
        console.error('[transaction.form][stage=load_categories] category query failed', {
          stage: 'load_categories',
          error: String(err),
        });
      }
    };
    loadCategories();
  }, []);

  // Load existing transaction if editing
  useEffect(() => {
    if (!isEdit || !id) return;
    let active = true;
    
    const loadTransaction = async () => {
      setLoading(true);
      setLoadedTemplateId(null);
      console.info('[transaction.form][stage=load_transaction] loading transaction', {
        stage: 'load_transaction',
        transaction_id: id,
        template_id: null,
      });
      try {
        const tx = await getTransaction(id);
        if (!active) return;
        if (tx) {
          setAmount(String(Math.abs(tx.amount)));
          setIsIncome(tx.amount > 0);
          setDescription(tx.description);
          setCategory(tx.category);
          setNotes(tx.notes || '');
          setVerified(tx.verified === 1);
          setTransactionDate(new Date(tx.transactionDate));
        }
      } catch (err) {
        if (!active) return;
        logTransactionFormError('load_transaction', {
          transaction_id: id,
          template_id: null,
          error: String(err),
        });
        setError(String(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    loadTransaction();
    return () => {
      active = false;
    };
  }, [id, isEdit]);

  // Load active template for reviewed transaction creation.
  useEffect(() => {
    if (isEdit || !sourceTemplateId) return;

    let active = true;

    const loadTemplate = async () => {
      setLoading(true);
      setLoadedTemplateId(null);
      setError(null);
      console.info('[transaction.form][stage=load_template] loading template', {
        stage: 'load_template',
        transaction_id: null,
        template_id: sourceTemplateId,
      });
      try {
        const template = await getTemplate(sourceTemplateId);
        if (!active) return;
        if (!template) {
          console.info('[transaction.form][stage=load_template] skipped template population', {
            stage: 'load_template',
            template_id: sourceTemplateId,
            reason: 'not_found',
          });
          setError('Template not found');
          return;
        }

        setAmount(template.amount === null || !Number.isFinite(template.amount) ? '' : String(Math.abs(template.amount)));
        setIsIncome(template.transactionType === 'income');
        setDescription(template.description?.trim() ?? '');
        setCategory(template.category?.trim() ?? '');
        setNotes(template.notes?.trim() ?? '');
        setVerified(template.verified === 1);
        setTransactionDate(new Date());
        setLoadedTemplateId(template.id);
      } catch (err) {
        if (!active) return;
        logTransactionFormError('load_template', {
          transaction_id: null,
          template_id: sourceTemplateId,
          error: String(err),
        });
        setError(String(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTemplate();
    return () => {
      active = false;
    };
  }, [isEdit, sourceTemplateId]);

  useEffect(() => {
    if (loading || isEdit || !sourceTemplateId || !loadedTemplateId) return;

    const initialFocus = getTransactionInitialFocus({
      isEdit,
      fromTemplate: true,
      amount,
      description,
    });
    if (!initialFocus) return;

    const frame = requestAnimationFrame(() => {
      if (initialFocus === 'amount') {
        amountRef.current?.focus();
      } else {
        descriptionRef.current?.focus();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [amount, description, isEdit, loadedTemplateId, loading, sourceTemplateId]);

  const handleSave = async () => {
    let stage = 'validate';
    try {
      if (sourceTemplateId && !loadedTemplateId) {
        setError('Template not found');
        return;
      }

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError('Amount must be greater than zero');
        amountRef.current?.focus();
        return;
      }

      const signedAmount = isIncome ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);

      if (!description.trim()) {
        setError('Description is required');
        descriptionRef.current?.focus();
        return;
      }

      if (isEdit && id) {
        stage = 'lookup_transaction_for_update';
        console.info('[transaction.form][stage=lookup_transaction_for_update] loading transaction before update', {
          stage,
          transaction_id: id,
          template_id: null,
        });
        const existing = await getTransaction(id);
        if (!existing) {
          setError('Transaction not found');
          return;
        }

        stage = 'update_transaction';
        console.info('[transaction.form][stage=update_transaction] updating transaction', {
          stage,
          transaction_id: id,
          template_id: existing.templateId ?? null,
        });
        await updateTransaction({
          ...existing,
          amount: signedAmount,
          description: description.trim(),
          category: category.trim(),
          notes: notes.trim() || null,
          verified: verified ? 1 : 0,
          transactionDate: transactionDate.getTime(),
        });
      } else {
        const createTemplateId = loadedTemplateId ?? null;
        stage = 'create_transaction';
        console.info('[transaction.form][stage=create_transaction] creating transaction', {
          stage,
          transaction_id: null,
          template_id: createTemplateId,
        });
        await createTransaction({
          amount: signedAmount,
          description: description.trim(),
          category: category.trim() || 'Other',
          notes: notes.trim() || null,
          verified: verified ? 1 : 0,
          transactionDate: transactionDate.getTime(),
          templateId: createTemplateId,
          deletedAt: null,
        });
      }

      await invalidateTransactionsAndTemplates();
      router.dismiss();
      console.info('[transaction.form][stage=save] transaction saved', {
        stage: 'save',
        mode: isEdit ? 'edit' : 'create',
        transaction_id: id ?? null,
        template_id: isEdit ? null : loadedTemplateId,
      });
    } catch (err) {
      logTransactionFormError(stage, {
        transaction_id: id ?? null,
        template_id: isEdit ? null : loadedTemplateId,
        error: String(err),
      });
      setError(String(err));
    }
  };

  const handleCancel = () => {
    console.info('[transaction.form][stage=cancel] dismissing transaction form', { stage: 'cancel' });
    router.dismiss();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading</Text>
     </View>
    );
  }

  return (
    <View collapsable={false} style={styles.container}>
      <View collapsable={false} style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={12}
          onPress={handleCancel}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{isEdit ? 'Edit Transaction' : 'New Transaction'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save"
          hitSlop={12}
          onPress={handleSave}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.form}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
         </View>
        )}

        <Text style={styles.label}>Amount</Text>
        <TextInput
          ref={amountRef}
          accessibilityLabel="Amount"
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          placeholderTextColor="#999"
          autoFocus={!isEdit && !sourceTemplateId}
        />

        <View style={styles.typeRow}>
          {(['Expense', 'Income'] as const).map((type) => {
            const selected = isIncome === (type === 'Income');
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={`Transaction type: ${type}`}
                accessibilityState={{ selected }}
                onPress={() => setIsIncome(type === 'Income')}
                style={[styles.typeButton, selected && styles.typeButtonSelected]}
              >
                <Text style={[styles.typeButtonText, selected && styles.typeButtonTextSelected]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          ref={descriptionRef}
          accessibilityLabel="Description"
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="What was this for?"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipsContainer}>
          {availableCategories.map((cat) => (
            <Pressable
              key={cat.name}
              style={[
                styles.chip,
                { borderColor: cat.color },
                category === cat.name && { backgroundColor: cat.color + '20' },
              ]}
              onPress={() => setCategory(cat.name)}
            >
              <Text style={[styles.chipText, category === cat.name && { color: cat.color }]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
       </View>

        <TextInput
          accessibilityLabel="Custom category"
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="Or type custom category"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Date</Text>
        <DateTimePicker
          accessibilityLabel="Transaction date"
          value={transactionDate}
          mode="date"
          display="compact"
          onChange={(_, date) => date && setTransactionDate(date)}
        />

        <View style={styles.toggleRow}>
          <Text style={styles.label}>Verified</Text>
          <Switch
            accessibilityLabel="Verified"
            value={verified}
            onValueChange={setVerified}
            trackColor={{ false: '#767577', true: '#34C759' }}
          />
       </View>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          accessibilityLabel="Notes"
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any notes..."
          multiline
          placeholderTextColor="#999"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  cancelText: {
    fontSize: 17,
    color: '#007AFF',
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  form: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    color: '#6E6E73',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  typeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    color: '#3C3C43',
    fontWeight: '600',
  },
  typeButtonTextSelected: {
    color: '#fff',
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  errorBanner: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D70015',
  },
});
