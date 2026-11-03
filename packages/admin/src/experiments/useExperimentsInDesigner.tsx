import type { PageDocument } from "@lintel/builder-model";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { describeError } from "../api/describeError.js";
import { SaveIndicator } from "../content/SaveIndicator.js";
import { t } from "../i18n/strings.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { VersionSwitcher } from "./VersionSwitcher.js";
import { addVersion } from "./experiments.api.js";
import { experimentKeys, useCreateExperiment } from "./experiments.queries.js";
import type { Experiment, VersionKey } from "./experiments.types.js";
import { sectionAround, useVersionEditing, versionDocument } from "./useVersionEditing.js";

/** The field the website draws, and so the only one A/B tests try versions of. */
const TESTED_FIELD = "design";

/**
 * Everything the page designer needs for A/B tests, kept out of PageDesignPage: the toolbar's
 * version switcher, which design the canvas opens with, where its changes are saved, and the
 * save state to show while a version is open. With the plugin off, or without
 * `experiments:manage`, it adds nothing.
 */
export function useExperimentsInDesigner(options: {
  entryId: string;
  fieldHandle: string;
  /** The page as opened; kept up to date from the canvas while the original is open. */
  original: PageDocument | null;
  saveOriginal: () => Promise<unknown>;
}) {
  const session = useSession();
  const canManage = useCan("experiments:manage");
  const isAvailable =
    session.enabledPlugins.includes("experiments") &&
    canManage &&
    options.fieldHandle === TESTED_FIELD &&
    options.original !== null;
  const versions = useVersionEditing(options.entryId, isAvailable);
  const queryClient = useQueryClient();
  const create = useCreateExperiment();
  const [isAdding, setIsAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [latestOriginal, setLatestOriginal] = useState(options.original);
  // The design the canvas opened with: worked out when switching, read by the canvas only then.
  const [opened, setOpened] = useState(options.original);
  const { experiment, editing } = versions;
  const changeVersion = versions.change;

  /** Sends a change to the open version; false when the original is open. */
  const change = useCallback(
    (document: PageDocument) => {
      if (editing === "original") {
        setLatestOriginal(document);
        return false;
      }
      changeVersion(document);
      return true;
    },
    [editing, changeVersion],
  );

  const open = async (key: VersionKey, test: Experiment | null) => {
    await versions.switchTo(key);
    setOpened(
      key === "original" || !test || !latestOriginal
        ? latestOriginal
        : (versionDocument(test, key, latestOriginal) ?? latestOriginal),
    );
  };

  const switchTo = async (key: VersionKey) => {
    setProblem(null);
    await options.saveOriginal();
    await open(key, experiment);
  };

  const tryVersion = async (sectionId?: string) => {
    setProblem(null);
    await options.saveOriginal();
    try {
      const created = await create.mutateAsync({ entryId: options.entryId, sectionId });
      await open("b", created);
    } catch (error) {
      setProblem(describeError(error));
    }
  };

  const add = async (from: VersionKey) => {
    if (!experiment) return;
    setProblem(null);
    setIsAdding(true);
    try {
      await options.saveOriginal();
      await versions.saveNow();
      const updated = await addVersion(experiment.id, from);
      queryClient.setQueryData(experimentKeys.forPage(options.entryId), updated);
      queryClient.setQueryData(experimentKeys.experiment(updated.id), updated);
      const newest = updated.versions.at(-1)?.key;
      if (newest) await open(newest, updated);
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setIsAdding(false);
    }
  };

  const selectedSectionId = latestOriginal ? sectionAround(latestOriginal, selectedId) : null;

  return {
    editing,
    isEditingVersion: editing !== "original",
    initialDocument: opened,
    change,
    select: isAvailable ? setSelectedId : undefined,
    hasUnsavedChanges: versions.hasUnsavedChanges,
    saveNow: versions.saveNow,
    saveBeforeLeaving: versions.saveBeforeLeaving,
    switcher: isAvailable ? (
      <VersionSwitcher
        experiment={experiment}
        editing={editing}
        onSwitch={(key) => void switchTo(key)}
        onTry={(sectionId) => void tryVersion(sectionId)}
        selectedSectionId={editing === "original" ? selectedSectionId : null}
        onAdd={(from) => void add(from)}
        isWorking={create.isPending || isAdding}
      />
    ) : null,
    saveState: (
      <span className="flex items-center gap-3">
        {experiment?.scope === "section" && (
          <span className="hidden text-footnote text-label-secondary xl:inline">
            {t("experiments.designer.sectionNote")}
          </span>
        )}
        <SaveIndicator
          status={versions.status}
          hasUnsavedChanges={versions.hasUnsavedChanges}
          errorMessage={versions.errorMessage}
          onRetry={versions.saveNow}
        />
      </span>
    ),
    dialogs: problem ? (
      <p
        role="alert"
        className="fixed bottom-4 left-1/2 z-40 max-w-xl -translate-x-1/2 rounded-card bg-surface-raised px-4 py-3 text-footnote text-danger shadow-float"
      >
        {problem}
      </p>
    ) : null,
  };
}
