import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';

import {
  createTemplate,
  getTemplate,
  listHistoricalTemplateSuggestions,
  listTemplates,
  pauseTemplate,
  quickAddTemplate,
  resumeTemplate,
  softDeleteTemplate,
  updateTemplate,
  type TemplateListFilter,
} from '@/db/template';
import type { SuggestionLookback, TemplateDraft } from '@/db/template-core';
import { softDeleteTransaction } from '@/db/transaction';
import { suggestionLookbackAtom } from '@/libs/preferences';
import { queryKeys } from './useTransactionsQuery';

export { queryKeys } from './useTransactionsQuery';

const logMutation = (stage: string, templateId: string | null) => {
  console.info(`[templates.ui][stage=${stage}]`, { template_id: templateId });
};

const useInvalidateTemplateQueries = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.templates.all() });
};

const useInvalidateTransactionAndTemplateQueries = () => {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.templates.all() }),
  ]);
};

export const useTemplateListQuery = (filter: TemplateListFilter = {}) => useQuery({
  queryKey: queryKeys.templates.list(filter),
  queryFn: () => listTemplates(filter),
});

export const useTemplateQuery = (id: string | undefined) => useQuery({
  queryKey: queryKeys.templates.detail(id ?? ''),
  queryFn: () => getTemplate(id!),
  enabled: Boolean(id),
});

export const useTemplateSuggestionsQuery = (lookback?: SuggestionLookback) => {
  const preferredLookback = useAtomValue(suggestionLookbackAtom);
  const resolvedLookback = lookback ?? preferredLookback;
  return useQuery({
    queryKey: queryKeys.templates.suggestions(resolvedLookback),
    queryFn: () => listHistoricalTemplateSuggestions(resolvedLookback),
  });
};

export const useCreateTemplateMutation = () => {
  const invalidateTemplates = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: (draft: TemplateDraft) => {
      logMutation('create_template', null);
      return createTemplate(draft);
    },
    onSuccess: invalidateTemplates,
  });
};

export const useUpdateTemplateMutation = () => {
  const invalidateTemplates = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: TemplateDraft }) => {
      logMutation('update_template', id);
      return updateTemplate(id, draft);
    },
    onSuccess: invalidateTemplates,
  });
};

export const useDeleteTemplateMutation = () => {
  const invalidateTemplates = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: (id: string) => {
      logMutation('delete_template', id);
      return softDeleteTemplate(id);
    },
    onSuccess: invalidateTemplates,
  });
};

export const usePauseTemplateMutation = () => {
  const invalidateTemplates = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: (id: string) => {
      logMutation('pause_template', id);
      return pauseTemplate(id);
    },
    onSuccess: invalidateTemplates,
  });
};

export const useResumeTemplateMutation = () => {
  const invalidateTemplates = useInvalidateTemplateQueries();
  return useMutation({
    mutationFn: (id: string) => {
      logMutation('resume_template', id);
      return resumeTemplate(id);
    },
    onSuccess: invalidateTemplates,
  });
};

export const useQuickAddTemplateMutation = () => {
  const invalidateTransactionsAndTemplates = useInvalidateTransactionAndTemplateQueries();
  return useMutation({
    mutationFn: (id: string) => {
      logMutation('quick_add', id);
      return quickAddTemplate(id);
    },
    onSuccess: invalidateTransactionsAndTemplates,
  });
};

export const useUndoQuickAddMutation = () => {
  const invalidateTransactionsAndTemplates = useInvalidateTransactionAndTemplateQueries();
  return useMutation({
    mutationFn: ({ transactionId, templateId }: { transactionId: string; templateId: string }) => {
      logMutation('undo_quick_add', templateId);
      return softDeleteTransaction(transactionId);
    },
    onSuccess: invalidateTransactionsAndTemplates,
  });
};
