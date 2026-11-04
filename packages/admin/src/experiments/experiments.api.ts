import type { PageDocument } from "@lintel/builder-model";
import { apiRequest } from "../api/client.js";
import type {
  ChallengerKey,
  Experiment,
  ExperimentGoal,
  ExperimentResults,
  ExperimentsSettings,
  VersionKey,
} from "./experiments.types.js";

/** Calls to the API's A/B testing routes (see packages/core/src/experiments). */

export function getExperimentsSettings() {
  return apiRequest<ExperimentsSettings>("/plugins/experiments/settings");
}

export function saveExperimentsSettings(settings: ExperimentsSettings) {
  return apiRequest<ExperimentsSettings>("/plugins/experiments/settings", {
    method: "PUT",
    body: settings,
  });
}

const experimentPath = (experimentId: string) => `/experiments/${encodeURIComponent(experimentId)}`;

export async function listExperiments(): Promise<Experiment[]> {
  const { experiments } = await apiRequest<{ experiments: Experiment[] }>("/experiments");
  return experiments;
}

export function getExperiment(experimentId: string) {
  return apiRequest<Experiment>(experimentPath(experimentId));
}

export async function getExperimentForPage(entryId: string): Promise<Experiment | null> {
  const { experiment } = await apiRequest<{ experiment: Experiment | null }>(
    `/experiments/for-page/${encodeURIComponent(entryId)}`,
  );
  return experiment;
}

export function createExperiment(request: { entryId: string; sectionId?: string }) {
  return apiRequest<Experiment>("/experiments", { method: "POST", body: request });
}

export function updateExperiment(
  experimentId: string,
  changes: { goal?: ExperimentGoal | null; split?: number[] },
) {
  return apiRequest<Experiment>(experimentPath(experimentId), { method: "PATCH", body: changes });
}

export function deleteExperiment(experimentId: string) {
  return apiRequest<void>(experimentPath(experimentId), { method: "DELETE" });
}

export function addVersion(experimentId: string, from: VersionKey) {
  return apiRequest<Experiment>(`${experimentPath(experimentId)}/versions`, {
    method: "POST",
    body: { from },
  });
}

export function saveVersion(
  experimentId: string,
  key: ChallengerKey,
  design: PageDocument,
  baseUpdatedAt?: string | null,
) {
  return apiRequest<Experiment>(`${experimentPath(experimentId)}/versions/${key}`, {
    method: "PUT",
    body: { design, ...(baseUpdatedAt === undefined ? {} : { baseUpdatedAt }) },
  });
}

export async function removeVersion(experimentId: string, key: ChallengerKey) {
  const { experiment } = await apiRequest<{ experiment: Experiment | null }>(
    `${experimentPath(experimentId)}/versions/${key}`,
    { method: "DELETE" },
  );
  return experiment;
}

export function startExperiment(experimentId: string) {
  return apiRequest<Experiment>(`${experimentPath(experimentId)}/start`, { method: "POST" });
}

export function stopExperiment(experimentId: string) {
  return apiRequest<Experiment>(`${experimentPath(experimentId)}/stop`, { method: "POST" });
}

export function endExperiment(experimentId: string, version: VersionKey) {
  return apiRequest<Experiment>(`${experimentPath(experimentId)}/end`, {
    method: "POST",
    body: { version },
  });
}

export function getResults(experimentId: string) {
  return apiRequest<ExperimentResults>(`${experimentPath(experimentId)}/results`);
}
