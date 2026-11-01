import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addSubmissionNote,
  createForm,
  deleteForm,
  deleteSubmission,
  deleteSubmissionNote,
  getForm,
  getFormsSettings,
  getSubmission,
  listForms,
  listSubmissions,
  updateForm,
  updateFormsSettings,
  updateSubmission,
} from "./forms.api.js";
import type { FormChanges, SubmissionDetail, SubmissionQuery } from "./forms.types.js";

export const formKeys = {
  all: () => ["forms"] as const,
  list: () => ["forms", "list"] as const,
  form: (formId: string) => ["forms", formId] as const,
  submissions: (formId: string) => ["forms", formId, "submissions"] as const,
  submissionList: (formId: string, query: SubmissionQuery) =>
    ["forms", formId, "submissions", "list", query] as const,
  submission: (formId: string, submissionId: string) =>
    ["forms", formId, "submissions", submissionId] as const,
  settings: () => ["forms-settings"] as const,
};

export function useForms(enabled = true) {
  return useQuery({ queryKey: formKeys.list(), queryFn: listForms, enabled });
}

export function useForm(formId: string) {
  return useQuery({ queryKey: formKeys.form(formId), queryFn: () => getForm(formId) });
}

export function useCreateForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createForm,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formKeys.list() }),
  });
}

export function useUpdateForm(formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: FormChanges) => updateForm(formId, changes),
    onSuccess: (form) => {
      queryClient.setQueryData(formKeys.form(formId), form);
      return queryClient.invalidateQueries({ queryKey: formKeys.list() });
    },
  });
}

export function useDeleteForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteForm,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formKeys.all() }),
  });
}

export function useSubmissions(formId: string, query: SubmissionQuery) {
  return useQuery({
    queryKey: formKeys.submissionList(formId, query),
    queryFn: () => listSubmissions(formId, query),
    // Keep the old page on screen while the next one loads, so the list doesn't jump.
    placeholderData: keepPreviousData,
  });
}

export function useSubmission(formId: string, submissionId: string | undefined) {
  return useQuery({
    queryKey: formKeys.submission(formId, submissionId ?? ""),
    queryFn: () => getSubmission(formId, submissionId ?? ""),
    enabled: submissionId !== undefined,
  });
}

/** After any change to one submission: show it straight away, then refresh lists and counts. */
function useSubmissionChange<Variables>(
  formId: string,
  submissionId: string,
  change: (variables: Variables) => Promise<SubmissionDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: (submission) => {
      queryClient.setQueryData(formKeys.submission(formId, submissionId), submission);
      void queryClient.invalidateQueries({ queryKey: [...formKeys.submissions(formId), "list"] });
      void queryClient.invalidateQueries({ queryKey: formKeys.form(formId), exact: true });
      return queryClient.invalidateQueries({ queryKey: formKeys.list() });
    },
  });
}

export function useUpdateSubmission(formId: string, submissionId: string) {
  return useSubmissionChange(
    formId,
    submissionId,
    (changes: { isRead?: boolean; isStarred?: boolean }) =>
      updateSubmission(formId, submissionId, changes),
  );
}

export function useAddNote(formId: string, submissionId: string) {
  return useSubmissionChange(formId, submissionId, (body: string) =>
    addSubmissionNote(formId, submissionId, body),
  );
}

export function useDeleteNote(formId: string, submissionId: string) {
  return useSubmissionChange(formId, submissionId, (noteId: string) =>
    deleteSubmissionNote(formId, submissionId, noteId),
  );
}

export function useDeleteSubmission(formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) => deleteSubmission(formId, submissionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formKeys.all() }),
  });
}

export function useFormsSettings() {
  return useQuery({ queryKey: formKeys.settings(), queryFn: getFormsSettings });
}

export function useUpdateFormsSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateFormsSettings,
    onSuccess: (settings) => queryClient.setQueryData(formKeys.settings(), settings),
  });
}
