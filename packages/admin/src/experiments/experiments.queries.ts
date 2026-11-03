import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addVersion,
  createExperiment,
  deleteExperiment,
  endExperiment,
  getExperiment,
  getExperimentForPage,
  getResults,
  listExperiments,
  removeVersion,
  startExperiment,
  stopExperiment,
  updateExperiment,
} from "./experiments.api.js";
import type { ChallengerKey, Experiment, ExperimentGoal, VersionKey } from "./experiments.types.js";

export const experimentKeys = {
  all: () => ["experiments"] as const,
  list: () => ["experiments", "list"] as const,
  experiment: (experimentId: string) => ["experiments", experimentId] as const,
  results: (experimentId: string) => ["experiments", experimentId, "results"] as const,
  forPage: (entryId: string) => ["experiments", "for-page", entryId] as const,
};

export function useExperiments() {
  return useQuery({ queryKey: experimentKeys.list(), queryFn: listExperiments });
}

export function useExperiment(experimentId: string) {
  return useQuery({
    queryKey: experimentKeys.experiment(experimentId),
    queryFn: () => getExperiment(experimentId),
  });
}

export function useExperimentResults(experimentId: string, isRunning: boolean) {
  return useQuery({
    queryKey: experimentKeys.results(experimentId),
    queryFn: () => getResults(experimentId),
    // While the test runs, the numbers move: look again every minute.
    refetchInterval: isRunning ? 60_000 : false,
  });
}

/** The page's open test, for the page designer. Off unless `enabled`. */
export function usePageExperiment(entryId: string, enabled: boolean) {
  return useQuery({
    queryKey: experimentKeys.forPage(entryId),
    queryFn: () => getExperimentForPage(entryId),
    enabled,
  });
}

/** Keeps every cached copy of a test in step with what the API just returned. */
function useRemember() {
  const queryClient = useQueryClient();
  return (experiment: Experiment | null, entryId: string, experimentId?: string) => {
    queryClient.setQueryData(experimentKeys.forPage(entryId), experiment);
    if (experiment) queryClient.setQueryData(experimentKeys.experiment(experiment.id), experiment);
    else if (experimentId)
      queryClient.removeQueries({ queryKey: experimentKeys.experiment(experimentId) });
    void queryClient.invalidateQueries({ queryKey: experimentKeys.list() });
  };
}

export function useCreateExperiment() {
  const remember = useRemember();
  return useMutation({
    mutationFn: createExperiment,
    onSuccess: (experiment) => remember(experiment, experiment.entryId),
  });
}

export function useAddVersion(experiment: Experiment) {
  const remember = useRemember();
  return useMutation({
    mutationFn: (from: VersionKey) => addVersion(experiment.id, from),
    onSuccess: (updated) => remember(updated, updated.entryId),
  });
}

export function useRemoveVersion(experiment: Experiment) {
  const remember = useRemember();
  return useMutation({
    mutationFn: (key: ChallengerKey) => removeVersion(experiment.id, key),
    onSuccess: (updated) => remember(updated, experiment.entryId, experiment.id),
  });
}

export function useUpdateExperiment(experiment: Experiment) {
  const remember = useRemember();
  return useMutation({
    mutationFn: (changes: { goal?: ExperimentGoal | null; split?: number[] }) =>
      updateExperiment(experiment.id, changes),
    onSuccess: (updated) => remember(updated, updated.entryId),
  });
}

export function useStartStopExperiment(experiment: Experiment) {
  const remember = useRemember();
  return useMutation({
    mutationFn: (action: "start" | "stop") =>
      action === "start" ? startExperiment(experiment.id) : stopExperiment(experiment.id),
    onSuccess: (updated) => remember(updated, updated.entryId),
  });
}

export function useEndExperiment(experiment: Experiment) {
  const queryClient = useQueryClient();
  const remember = useRemember();
  return useMutation({
    mutationFn: (version: VersionKey) => endExperiment(experiment.id, version),
    onSuccess: (updated) => {
      remember(updated, updated.entryId);
      // The page's open test is over.
      queryClient.setQueryData(experimentKeys.forPage(updated.entryId), null);
      // A version made the page changed the page itself.
      void queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useDeleteExperiment(experiment: Experiment) {
  const remember = useRemember();
  return useMutation({
    mutationFn: () => deleteExperiment(experiment.id),
    onSuccess: () => remember(null, experiment.entryId, experiment.id),
  });
}
