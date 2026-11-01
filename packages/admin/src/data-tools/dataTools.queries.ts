import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type BackupSchedule,
  createBackup,
  deleteBackup,
  listBackups,
  previewRestore,
  restoreBackup,
  saveBackupSchedule,
} from "./dataTools.api.js";
import {
  deleteWordPressImport,
  dryRunWordPressImport,
  getMappingChoices,
  getWordPressImport,
  listWordPressImports,
  saveMapping,
  startWordPressImport,
  type WordPressImportMapping,
} from "./wordpressImport.api.js";

export const dataToolsKeys = {
  backups: () => ["backups"] as const,
  restorePreview: (backupId: string) => ["backups", backupId, "restore-preview"] as const,
  wordpressImports: () => ["wordpress-imports"] as const,
  wordpressImport: (importId: string) => ["wordpress-imports", importId] as const,
  mapping: (importId: string) => ["wordpress-imports", importId, "mapping"] as const,
};

/** The list refreshes every few seconds while a backup is still being made. */
export function useBackups() {
  return useQuery({
    queryKey: dataToolsKeys.backups(),
    queryFn: listBackups,
    refetchInterval: (query) =>
      query.state.data?.backups.some((backup) => backup.status === "running") ? 2000 : false,
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBackup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dataToolsKeys.backups() }),
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dataToolsKeys.backups() }),
  });
}

export function useSaveBackupSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: BackupSchedule) => saveBackupSchedule(schedule),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dataToolsKeys.backups() }),
  });
}

export function useRestorePreview(backupId: string) {
  return useQuery({
    queryKey: dataToolsKeys.restorePreview(backupId),
    queryFn: () => previewRestore(backupId),
  });
}

export function useRestoreBackup(backupId: string) {
  return useMutation({ mutationFn: () => restoreBackup(backupId) });
}

export function useWordPressImports() {
  return useQuery({ queryKey: dataToolsKeys.wordpressImports(), queryFn: listWordPressImports });
}

/** Refreshes every second or two while the import runs, for the progress bar. */
export function useWordPressImport(importId: string) {
  return useQuery({
    queryKey: dataToolsKeys.wordpressImport(importId),
    queryFn: () => getWordPressImport(importId),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1500 : false),
  });
}

export function useMappingChoices(importId: string) {
  return useQuery({
    queryKey: dataToolsKeys.mapping(importId),
    queryFn: () => getMappingChoices(importId),
  });
}

export function useSaveMapping(importId: string) {
  return useMutation({
    mutationFn: (mapping: WordPressImportMapping) => saveMapping(importId, mapping),
  });
}

export function useDryRun(importId: string) {
  return useMutation({ mutationFn: () => dryRunWordPressImport(importId) });
}

export function useStartWordPressImport(importId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startWordPressImport(importId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dataToolsKeys.wordpressImport(importId) }),
  });
}

export function useDeleteWordPressImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWordPressImport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dataToolsKeys.wordpressImports() }),
  });
}
