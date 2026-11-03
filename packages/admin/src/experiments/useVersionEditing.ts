import { type PageDocument, siteSectionIds } from "@lintel/builder-model";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { describeError } from "../api/describeError.js";
import type { SaveStatus } from "../content/entryDraft.js";
import { useAutosave } from "../content/useAutosave.js";
import { saveVersion } from "./experiments.api.js";
import { experimentKeys, usePageExperiment } from "./experiments.queries.js";
import type { ChallengerKey, Experiment, VersionKey } from "./experiments.types.js";

/**
 * The page designer's side of A/B tests: which version is on the canvas, what to draw for it
 * and saving it. The original saves as the page always does; Version B and C save to the test,
 * shortly after changes stop, like the page.
 *
 * A section test's version is kept as just its section. On the canvas it is drawn in the
 * page as it is now, with the page's other sections locked, so only the tried section changes.
 */
export function useVersionEditing(entryId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const query = usePageExperiment(entryId, enabled);
  const experiment = enabled ? (query.data ?? null) : null;
  const [chosen, setChosen] = useState<VersionKey>("original");
  const editing: VersionKey =
    chosen !== "original" && experiment?.versions.some((version) => version.key === chosen)
      ? chosen
      : "original";
  const [draft, setDraft] = useState<{ key: ChallengerKey; design: PageDocument } | null>(null);
  const [saved, setSaved] = useState<PageDocument | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasUnsavedChanges = draft !== null && draft.design !== saved;

  const save = useCallback(
    async (next: { key: ChallengerKey; design: PageDocument } | null) => {
      if (!next || !experiment) return;
      setStatus("saving");
      try {
        const updated = await saveVersion(experiment.id, next.key, next.design);
        queryClient.setQueryData(experimentKeys.forPage(entryId), updated);
        queryClient.setQueryData(experimentKeys.experiment(updated.id), updated);
        setSaved(next.design);
        setStatus("saved");
        setErrorMessage(null);
      } catch (error) {
        setStatus("failed");
        setErrorMessage(describeError(error));
        throw error;
      }
    },
    [experiment, entryId, queryClient],
  );
  const { saveNow } = useAutosave({ draft, hasUnsavedChanges, isEnabled: true, save });

  const change = useCallback(
    (design: PageDocument) => {
      if (editing !== "original") setDraft({ key: editing, design });
    },
    [editing],
  );

  /** Saves what's open, then puts another version on the canvas. */
  const switchTo = useCallback(
    async (key: VersionKey) => {
      await saveNow().catch(() => undefined);
      setDraft(null);
      setSaved(null);
      setStatus("idle");
      setChosen(key);
    },
    [saveNow],
  );

  return {
    experiment,
    editing,
    switchTo,
    change,
    status,
    errorMessage,
    hasUnsavedChanges,
    saveNow: () => saveNow().catch(() => undefined),
  };
}

/** What the canvas shows for a version, given the original page as it is now. */
export function versionDocument(
  experiment: Experiment,
  key: ChallengerKey,
  original: PageDocument,
): PageDocument | null {
  const version = experiment.versions.find((candidate) => candidate.key === key);
  if (!version) return null;
  if (experiment.scope === "page" || !experiment.sectionId) return version.design;
  const sectionId = experiment.sectionId;
  const replacement = version.design.root.children.find((child) => child.id === sectionId);
  if (!replacement || !original.root.children.some((child) => child.id === sectionId)) {
    return version.design;
  }
  return {
    ...original,
    root: {
      ...original.root,
      children: original.root.children.map((child) =>
        child.id === sectionId ? replacement : { ...child, locked: true },
      ),
    },
  };
}

/**
 * The section at the top of the page that holds the selected element, if any. The site's
 * navigation and footer are shared by every page, so they can't have a version of their own.
 */
export function sectionAround(document: PageDocument, nodeId: string | null): string | null {
  if (!nodeId) return null;
  for (const section of document.root.children) {
    if (siteSectionIds.has(section.id)) continue;
    if (section.id === nodeId || contains(section, nodeId)) return section.id;
  }
  return null;
}

function contains(node: PageDocument["root"], nodeId: string): boolean {
  return node.children.some((child) => child.id === nodeId || contains(child, nodeId));
}
