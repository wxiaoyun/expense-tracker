import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, InteractionManager, Text, TextInput, View } from 'react-native';

import {
  DEFAULT_TEMPLATE_CRON,
  TemplateEditorForm,
  type TemplateEditorCategory,
} from '@/components/templates/template-editor-form';
import { db } from '@/db';
import { categories as categoriesTable, type TransactionTemplate } from '@/db/schema';
import {
  backfillTemplate,
  createTemplate,
  getNextAvailableTemplateName,
  getTemplate,
  previewTemplateBackfill,
  updateTemplate,
} from '@/db/template';
import {
  validateTemplateDraft,
  type TemplateDraft,
  type TemplateSuggestion,
  type TransactionType,
} from '@/db/template-core';
import { getTransaction } from '@/db/transaction';
import { useTemplateSuggestionsQuery } from '@/hooks/useTemplatesQuery';
import { getNextOccurrences } from '@/libs/date';

const DEFAULT_CRON = DEFAULT_TEMPLATE_CRON;

type CategoryRow = TemplateEditorCategory;
type ValidationField = 'name' | 'amount' | 'description' | 'recurrenceValue' | 'startDate';

const confirm = (title: string, message: string): Promise<boolean> => new Promise((resolve) => {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Continue', onPress: () => resolve(true) },
  ]);
});

const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function TemplateEditDrawer() {
  const params = useLocalSearchParams<{ id?: string | string[]; sourceTransactionId?: string | string[] }>();
  const id = firstParam(params.id);
  const requestedSourceTransactionId = firstParam(params.sourceTransactionId);
  const sourceTransactionId = id ? undefined : requestedSourceTransactionId;
  const isEdit = Boolean(id);
  const isBlankCreate = !id && !requestedSourceTransactionId;
  const queryClient = useQueryClient();
  const suggestionQuery = useTemplateSuggestionsQuery(undefined, isBlankCreate);

  const amountRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const recurrenceRef = useRef<TextInput>(null);
  const malformedRouteLogged = useRef(false);
  const submitInFlightRef = useRef(false);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [verified, setVerified] = useState(false);
  const [repeatAutomatically, setRepeatAutomatically] = useState(false);
  const [recurrenceValue, setRecurrenceValue] = useState<string>(DEFAULT_CRON);
  const [startDate, setStartDate] = useState(new Date());
  const [presentedAt] = useState(() => Date.now());
  const [scheduleActive, setScheduleActive] = useState(true);
  const [initiallyScheduled, setInitiallyScheduled] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(isEdit || Boolean(sourceTransactionId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [backfillCount, setBackfillCount] = useState(0);

  const metadata = (stage: string, errorValue?: unknown, templateId = id ?? null) => ({
    template_id: templateId,
    source_transaction_id: sourceTransactionId ?? null,
    stage,
    ...(errorValue === undefined ? {} : { error: String(errorValue) }),
  });

  const logInfo = (stage: string, templateId?: string | null) => {
    console.info(`[templates.editor][stage=${stage}]`, metadata(stage, undefined, templateId));
  };

  const logError = (stage: string, errorValue: unknown, templateId?: string | null) => {
    console.error(`[templates.editor][stage=${stage}] failed`, metadata(stage, errorValue, templateId));
  };

  useEffect(() => {
    if (id && requestedSourceTransactionId && !malformedRouteLogged.current) {
      malformedRouteLogged.current = true;
      console.error('[templates.editor][stage=resolve_source] failed', {
        template_id_present: true,
        source_transaction_id_present: true,
        stage: 'resolve_source',
        error: 'Conflicting route sources',
      });
    }
  }, [id, requestedSourceTransactionId]);

  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      logInfo('load_categories');
      try {
        const rows = await db.select().from(categoriesTable).all();
        if (active) setAvailableCategories(rows);
      } catch (loadError) {
        logError('load_categories', loadError);
        if (active) setError('Could not load categories');
      }
    };
    void loadCategories();
    return () => { active = false; };
    // Route sources intentionally define the logging metadata for this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sourceTransactionId]);

  useEffect(() => {
    if (!isBlankCreate) return;
    const task = InteractionManager.runAfterInteractions(() => amountRef.current?.focus());
    return () => task.cancel();
  }, [isBlankCreate]);

  const suggestions: TemplateSuggestion[] = isBlankCreate ? (suggestionQuery.data ?? []).slice(0, 5) : [];

  useEffect(() => {
    if (!isBlankCreate || !suggestionQuery.error) return;
    logError('load_suggestions', suggestionQuery.error);
    // Query errors are rendered non-blockingly; entered form state remains intact.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBlankCreate, suggestionQuery.error]);

  useEffect(() => {
    if (!id && !sourceTransactionId) return;
    let active = true;

    const applyTemplate = (template: TransactionTemplate) => {
      setName(template.name);
      setAmount(template.amount === null ? '' : String(Math.abs(template.amount)));
      setTransactionType(template.transactionType ?? 'expense');
      setDescription(template.description ?? '');
      setCategory(template.category ?? '');
      setNotes(template.notes ?? '');
      setVerified(template.verified === 1);
      const scheduled = Boolean(template.recurrenceValue);
      setRepeatAutomatically(scheduled);
      setInitiallyScheduled(scheduled);
      setRecurrenceValue(template.recurrenceValue ?? DEFAULT_CRON);
      setStartDate(new Date(template.startDate ?? Date.now()));
      setScheduleActive(template.scheduleActive === 1);
    };

    const loadSource = async () => {
      try {
        if (id) {
          logInfo('load_template');
          const template = await getTemplate(id);
          if (!template) throw new Error('Template not found');
          if (active) applyTemplate(template);
        } else if (sourceTransactionId) {
          logInfo('load_source_transaction');
          const transaction = await getTransaction(sourceTransactionId);
          if (!transaction) throw new Error('Transaction not found');
          if (active) {
            setName(transaction.description.trim());
            setAmount(String(Math.abs(transaction.amount)));
            setTransactionType(transaction.amount >= 0 ? 'income' : 'expense');
            setDescription(transaction.description);
            setCategory(transaction.category);
            setNotes(transaction.notes ?? '');
            setVerified(transaction.verified === 1);
          }
        }
      } catch (loadError) {
        logError(id ? 'load_template' : 'load_source_transaction', loadError);
        if (active) setError(String(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadSource();
    return () => { active = false; };
    // Route source changes replace all local editor state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sourceTransactionId]);

  const buildDraft = (): TemplateDraft => {
    const trimmedAmount = amount.trim();
    return {
      name,
      amount: trimmedAmount ? Number(trimmedAmount) : null,
      transactionType,
      description: description || null,
      category: category || null,
      notes: notes || null,
      verified,
      recurrenceValue: repeatAutomatically ? recurrenceValue : null,
      startDate: repeatAutomatically ? startDate.getTime() : null,
      scheduleCursorAt: null,
      scheduleActive: repeatAutomatically && scheduleActive,
    };
  };

  const nextOccurrences = useMemo(() => {
    if (!repeatAutomatically) return [];
    const anchor = new Date(Math.max(startDate.getTime(), presentedAt));
    return getNextOccurrences(recurrenceValue, 3, anchor);
  }, [presentedAt, recurrenceValue, repeatAutomatically, startDate]);

  const canPreviewBackfill = !isEdit
    && repeatAutomatically
    && startDate.getTime() < presentedAt
    && Boolean(name.trim())
    && Boolean(description.trim())
    && Boolean(amount.trim())
    && Number.isFinite(Number(amount))
    && Number(amount) > 0
    && getNextOccurrences(recurrenceValue, 1, startDate).length === 1;
  const visibleBackfillCount = canPreviewBackfill ? backfillCount : 0;

  useEffect(() => {
    if (!canPreviewBackfill) return;

    const currentDraft = buildDraft();
    let active = true;
    const preview = async () => {
      logInfo('preview_backfill');
      try {
        const count = await previewTemplateBackfill(currentDraft);
        if (active) setBackfillCount(count);
      } catch (previewError) {
        logError('preview_backfill', previewError);
        if (active) setBackfillCount(0);
      }
    };
    void preview();
    return () => { active = false; };
    // Primitive editor values are the complete preview input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, canPreviewBackfill, category, description, isEdit, name, notes, recurrenceValue, repeatAutomatically, scheduleActive, startDate, transactionType, verified]);

  const focusInvalidField = (field: ValidationField) => {
    if (field === 'name') nameRef.current?.focus();
    if (field === 'amount') amountRef.current?.focus();
    if (field === 'description') descriptionRef.current?.focus();
    if (field === 'recurrenceValue') recurrenceRef.current?.focus();
  };

  const applySuggestion = (suggestion: TemplateSuggestion) => {
    setName(suggestion.name);
    setAmount(suggestion.amount === null ? '' : String(suggestion.amount));
    setTransactionType(suggestion.transactionType ?? 'expense');
    setDescription(suggestion.description ?? '');
    setCategory(suggestion.category ?? '');
    setNotes(suggestion.notes ?? '');
    setVerified(suggestion.verified ?? false);
    setError(null);
    setSuggestedName(null);
  };

  const disableRepeat = () => {
    setRepeatAutomatically(false);
    setRecurrenceValue(DEFAULT_CRON);
    setStartDate(new Date());
    setScheduleActive(false);
    setBackfillCount(0);
  };

  const handleRepeatChange = (enabled: boolean) => {
    if (enabled) {
      setRepeatAutomatically(true);
      setScheduleActive(true);
      if (!repeatAutomatically) setStartDate(new Date());
      return;
    }

    if (isEdit && initiallyScheduled) {
      Alert.alert(
        'Stop repeating?',
        'This will clear the schedule. Past transactions will stay unchanged.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Stop Repeating', style: 'destructive', onPress: disableRepeat },
        ],
      );
      return;
    }
    disableRepeat();
  };

  const invalidateSavedQueries = async () => {
    logInfo('invalidate_queries');
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['templates'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
    } catch (invalidationError) {
      logError('invalidate_queries', invalidationError);
    }
  };

  const saveDraft = async (draft: TemplateDraft, exactBackfillCount: number, submissionCutoff: number) => {
    setSuggestedName(null);
    try {
      let saved: TransactionTemplate | null;
      if (id) {
        logInfo('update_template');
        saved = await updateTemplate(id, draft);
      } else {
        logInfo('create_template');
        saved = await createTemplate(draft);
      }
      if (!saved) throw new Error(isEdit ? 'Template not found' : 'Template was not created');

      if (exactBackfillCount > 0) {
        try {
          logInfo('backfill_template', saved.id);
          await backfillTemplate(saved.id, submissionCutoff);
        } catch (backfillError) {
          logError('backfill_template', backfillError, saved.id);
          await invalidateSavedQueries();
          router.dismiss();
          Alert.alert(
            'Template saved, backfill failed',
            saved.scheduleActive === 1
              ? 'The template was saved. Historical transactions were not added. Launch-time processing will retry automatically.'
              : 'The template was saved. Historical transactions were not added. Inactive schedules do not retry automatically.',
          );
          return;
        }
      }

      await invalidateSavedQueries();
      router.dismiss();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      logError(id ? 'update_template' : 'create_template', saveError);
      if (message === 'Template name already exists') {
        setError(message);
        try {
          logInfo('suggest_unique_name');
          setSuggestedName(await getNextAvailableTemplateName(name, id));
        } catch (suffixError) {
          logError('suggest_unique_name', suffixError);
        }
        nameRef.current?.focus();
      } else {
        setError(message);
      }
    }
  };

  const handleSave = async () => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setSuggestedName(null);

    try {
      const draft = buildDraft();
      const validation = validateTemplateDraft(draft);
      if (!validation.ok) {
        setError(validation.message);
        focusInvalidField(validation.field);
        return;
      }

      const submissionCutoff = Date.now();
      let exactBackfillCount = 0;
      if (!isEdit && repeatAutomatically && startDate.getTime() < submissionCutoff) {
        try {
          logInfo('confirm_backfill_preview');
          exactBackfillCount = await previewTemplateBackfill(draft, submissionCutoff);
          setBackfillCount(exactBackfillCount);
        } catch (previewError) {
          logError('confirm_backfill_preview', previewError);
          setError('Could not calculate past transactions');
          return;
        }
      }

      if (exactBackfillCount > 0) {
        const accepted = await confirm(
          `Create ${exactBackfillCount} past transactions?`,
          `Saving this template will create exactly ${exactBackfillCount} past transactions.`,
        );
        if (!accepted) return;
      }

      await saveDraft(draft, exactBackfillCount, submissionCutoff);
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  };

  const useSuggestedName = () => {
    if (!suggestedName) return;
    setName(suggestedName);
    setError(null);
    setSuggestedName(null);
    nameRef.current?.focus();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
        <Text>Loading</Text>
      </View>
    );
  }

  return (
    <TemplateEditorForm
      isEdit={isEdit}
      saving={saving}
      error={error}
      suggestedName={suggestedName}
      suggestions={suggestions}
      availableCategories={availableCategories}
      name={name}
      setName={setName}
      amount={amount}
      setAmount={setAmount}
      transactionType={transactionType}
      setTransactionType={setTransactionType}
      description={description}
      setDescription={setDescription}
      category={category}
      setCategory={setCategory}
      notes={notes}
      setNotes={setNotes}
      verified={verified}
      setVerified={setVerified}
      repeatAutomatically={repeatAutomatically}
      recurrenceValue={recurrenceValue}
      setRecurrenceValue={setRecurrenceValue}
      startDate={startDate}
      setStartDate={setStartDate}
      scheduleActive={scheduleActive}
      setScheduleActive={setScheduleActive}
      nextOccurrences={nextOccurrences}
      visibleBackfillCount={visibleBackfillCount}
      nameRef={nameRef}
      amountRef={amountRef}
      descriptionRef={descriptionRef}
      recurrenceRef={recurrenceRef}
      onCancel={() => router.dismiss()}
      onSave={() => void handleSave()}
      onUseSuggestedName={useSuggestedName}
      onApplySuggestion={applySuggestion}
      onRepeatChange={handleRepeatChange}
    />
  );
}
