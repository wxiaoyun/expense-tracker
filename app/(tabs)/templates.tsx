import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { AddTemplateButton } from '@/components/templates/add-template-button';
import { TemplateFilterBar } from '@/components/templates/template-filter-bar';
import { TemplateList } from '@/components/templates/template-list';
import { listTemplateCategories, type TemplateListFilter } from '@/db/template';
import {
  queryKeys,
  useDeleteTemplateMutation,
  usePauseTemplateMutation,
  useQuickAddTemplateMutation,
  useResumeTemplateMutation,
  useTemplateListQuery,
  useUndoQuickAddMutation,
} from '@/hooks/useTemplatesQuery';
import { showConfirmDialog } from '@/libs/dialog';
import { actionFeedback, errorFeedback, selectionFeedback } from '@/libs/haptics';

type TemplateType = NonNullable<TemplateListFilter['type']>;

const logFailure = (templateId: string | null, stage: string, error: unknown) => {
  console.error(`[templates.ui][stage=${stage}] failed`, {
    template_id: templateId,
    stage,
    error: String(error),
  });
};

export default function TemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TemplateType>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [pendingQuickAddIds, setPendingQuickAddIds] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);

  const filter = useMemo<TemplateListFilter>(() => ({
    search: search.trim() || undefined,
    type,
    categories,
  }), [search, type, categories]);

  const templateQuery = useTemplateListQuery(filter);
  const categoryQuery = useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: listTemplateCategories,
  });
  const deleteTemplate = useDeleteTemplateMutation();
  const pauseTemplate = usePauseTemplateMutation();
  const resumeTemplate = useResumeTemplateMutation();
  const quickAddTemplate = useQuickAddTemplateMutation();
  const undoQuickAdd = useUndoQuickAddMutation();

  useEffect(() => {
    if (templateQuery.error) {
      logFailure(null, 'load_templates', templateQuery.error);
    }
  }, [templateQuery.error]);

  useEffect(() => {
    if (categoryQuery.error) {
      logFailure(null, 'load_categories', categoryQuery.error);
    }
  }, [categoryQuery.error]);

  const handleUse = useCallback((id: string) => {
    setOperationError(null);
    console.info('[templates.ui][stage=navigate_use]', { template_id: id });
    try {
      router.push({ pathname: '/(drawer)/transaction', params: { templateId: id } });
    } catch (error) {
      logFailure(id, 'navigate_use', error);
      setOperationError('Could not open the transaction form');
      toast.error('Could not open transaction form');
    }
  }, [router]);

  const handleEdit = useCallback((id: string) => {
    setOperationError(null);
    console.info('[templates.ui][stage=navigate_edit]', { template_id: id });
    try {
      router.push({ pathname: '/(drawer)/template-edit', params: { id } });
    } catch (error) {
      logFailure(id, 'navigate_edit', error);
      setOperationError('Could not open the template editor');
      toast.error('Could not open template editor');
    }
  }, [router]);

  const handleQuickAdd = useCallback(async (id: string) => {
    setOperationError(null);
    setPendingQuickAddIds((current) => current.includes(id) ? current : [...current, id]);
    try {
      const created = await quickAddTemplate.mutateAsync(id);
      actionFeedback();
      toast.success('Transaction added', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await undoQuickAdd.mutateAsync({ transactionId: created.id, templateId: id });
              selectionFeedback();
            } catch (error) {
              logFailure(id, 'undo_quick_add', error);
              errorFeedback();
              setOperationError('Could not undo the added transaction');
              toast.error('Could not undo transaction');
            }
          },
        },
      });
    } catch (error) {
      logFailure(id, 'quick_add', error);
      errorFeedback();
      setOperationError('Could not add the transaction');
      toast.error('Could not add transaction');
    } finally {
      setPendingQuickAddIds((current) => current.filter((templateId) => templateId !== id));
    }
  }, [quickAddTemplate, undoQuickAdd]);

  const handlePause = useCallback(async (id: string) => {
    setOperationError(null);
    try {
      await pauseTemplate.mutateAsync(id);
      selectionFeedback();
    } catch (error) {
      logFailure(id, 'pause_template', error);
      errorFeedback();
      setOperationError('Could not pause the template');
      toast.error('Could not pause template');
    }
  }, [pauseTemplate]);

  const handleResume = useCallback(async (id: string) => {
    setOperationError(null);
    try {
      await resumeTemplate.mutateAsync(id);
      selectionFeedback();
    } catch (error) {
      logFailure(id, 'resume_template', error);
      errorFeedback();
      setOperationError('Could not resume the template');
      toast.error('Could not resume template');
    }
  }, [resumeTemplate]);

  const handleDelete = useCallback(async (id: string) => {
    setOperationError(null);
    console.info('[templates.ui][stage=confirm_delete]', { template_id: id });
    try {
      const confirmed = await showConfirmDialog(
        'Delete Template',
        'This will delete the template. Existing transactions will remain.',
      );
      if (!confirmed) return;
      await deleteTemplate.mutateAsync(id);
      actionFeedback();
    } catch (error) {
      logFailure(id, 'delete_template', error);
      errorFeedback();
      setOperationError('Could not delete the template');
      toast.error('Could not delete template');
    }
  }, [deleteTemplate]);

  const shouldRenderTemplateList = !templateQuery.error || templateQuery.data !== undefined;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top + 8 }}>
      <TemplateFilterBar
        search={search}
        type={type}
        onSearchChange={setSearch}
        onTypeChange={setType}
        categories={categoryQuery.data ?? []}
        selectedCategories={categories}
        onCategoriesChange={setCategories}
      />
      {templateQuery.error ? (
        <View
          accessibilityRole="alert"
          style={{ gap: 2, paddingHorizontal: 16, paddingBottom: 6 }}
        >
          <Text selectable style={{ color: '#FF3B30', fontWeight: '600' }}>
            Could not load templates
          </Text>
          <Text selectable style={{ color: '#FF3B30' }}>
            {templateQuery.error.message || String(templateQuery.error)}
          </Text>
        </View>
      ) : null}
      {categoryQuery.error ? (
        <View
          accessibilityRole="alert"
          style={{ gap: 2, paddingHorizontal: 16, paddingBottom: 6 }}
        >
          <Text selectable style={{ color: '#FF3B30', fontWeight: '600' }}>
            Could not load template categories
          </Text>
          <Text selectable style={{ color: '#FF3B30' }}>
            {categoryQuery.error.message || String(categoryQuery.error)}
          </Text>
        </View>
      ) : null}
      {operationError ? (
        <Text
          selectable
          accessibilityRole="alert"
          style={{ color: '#FF3B30', paddingHorizontal: 16, paddingBottom: 6 }}
        >
          {operationError}
        </Text>
      ) : null}
      {shouldRenderTemplateList ? (
        <TemplateList
          templates={templateQuery.data ?? []}
          isLoading={templateQuery.isLoading}
          quickAddPendingIds={pendingQuickAddIds}
          onUse={handleUse}
          onQuickAdd={handleQuickAdd}
          onEdit={handleEdit}
          onPause={handlePause}
          onResume={handleResume}
          onDelete={handleDelete}
        />
      ) : null}
      <AddTemplateButton />
    </View>
  );
}
