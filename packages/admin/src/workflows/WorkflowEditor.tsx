import { useState } from "react";
import { CopyButton } from "../design/CopyButton.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { describeTrigger, summariseWorkflow } from "./describeSteps.js";
import { StepCard } from "./StepCard.js";
import { StepEditorDialog } from "./StepEditorDialog.js";
import { type FlowActions, StepList } from "./StepList.js";
import {
  allStepIds,
  createStep,
  insertStep,
  moveStep,
  newStepId,
  removeStep,
  replaceStep,
  type StepPlace,
  topOfFlow,
} from "./stepTree.js";
import { TriggerEditorDialog } from "./TriggerEditorDialog.js";
import { useDescribeContext } from "./useDescribeContext.js";
import type { Catalogue, Workflow, WorkflowDraft, WorkflowStep } from "./workflows.types.js";

interface WorkflowEditorProps {
  draft: WorkflowDraft;
  onChange: (draft: WorkflowDraft) => void;
  saved: Workflow | undefined;
  catalogue: Catalogue | undefined;
  readOnly: boolean;
  hasChanges: boolean;
}

type Editing =
  | { kind: "trigger" }
  | { kind: "step"; step: WorkflowStep; insertAt?: { place: StepPlace; index: number } };

/**
 * The builder itself: the name, then the flow read top to bottom (the trigger card,
 * then each step), with dialogs to fill steps in.
 */
export function WorkflowEditor({
  draft,
  onChange,
  saved,
  catalogue,
  readOnly,
  hasChanges,
}: WorkflowEditorProps) {
  const [editing, setEditing] = useState<Editing | undefined>();
  const context = useDescribeContext();
  const otherWorkflows = context.workflows.filter((workflow) => workflow.id !== saved?.id);
  const signs = JSON.stringify(draft.steps).includes('"sign":true');

  const setSteps = (steps: WorkflowStep[]) => onChange({ ...draft, steps });
  const actions: FlowActions | undefined = readOnly
    ? undefined
    : {
        onAdd: (place, index, type) => {
          const step = createStep(type, newStepId(type, draft.steps));
          if (type === "publish_entry" || type === "unpublish_entry") {
            setSteps(insertStep(draft.steps, place, index, step));
          } else {
            setEditing({ kind: "step", step, insertAt: { place, index } });
          }
        },
        onEdit: (step) => setEditing({ kind: "step", step }),
        onRemove: (stepId) => setSteps(removeStep(draft.steps, stepId)),
        onMove: (stepId, direction) => setSteps(moveStep(draft.steps, stepId, direction)),
      };

  function saveStep(step: WorkflowStep) {
    if (editing?.kind !== "step") return;
    const { insertAt } = editing;
    const isNew = insertAt !== undefined && !allStepIds(draft.steps).includes(step.id);
    setSteps(
      isNew
        ? insertStep(draft.steps, insertAt.place, insertAt.index, step)
        : replaceStep(draft.steps, step),
    );
    setEditing(undefined);
  }

  return (
    <>
      {saved?.purpose && (
        <p className="rounded-card bg-accent/10 px-4 py-3 text-footnote text-label">
          {t("builder.managedNotice")}
        </p>
      )}
      <div className="flex flex-col gap-4 rounded-card bg-surface p-5">
        <TextField
          label={t("builder.nameLabel")}
          placeholder={t("builder.namePlaceholder")}
          value={draft.name}
          maxLength={120}
          readOnly={readOnly}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
        <TextField
          label={t("builder.descriptionLabel")}
          hint={t("builder.descriptionHint")}
          value={draft.description}
          maxLength={500}
          readOnly={readOnly}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
        <Toggle
          label={t("builder.enabled")}
          checked={draft.enabled}
          disabled={readOnly}
          onCheckedChange={(enabled) => onChange({ ...draft, enabled })}
        />
      </div>

      <section aria-labelledby="workflow-flow" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="workflow-flow" className="text-headline text-label">
            {t("builder.flowLabel")}
          </h2>
          {hasChanges && saved && (
            <span className="text-footnote text-label-secondary">{t("builder.unsaved")}</span>
          )}
        </div>
        <p className="text-footnote text-label-secondary">
          <span className="sr-only">{t("builder.summaryLabel")}: </span>
          {summariseWorkflow(draft, context)}
        </p>
        <ol className="@container mt-2 flex flex-col">
          <StepCard
            type="trigger"
            kindLabel={t("trigger.title")}
            description={describeTrigger(draft.trigger, context)}
            onEdit={readOnly ? undefined : () => setEditing({ kind: "trigger" })}
          />
        </ol>
        <StepList steps={draft.steps} place={topOfFlow} context={context} actions={actions} />
      </section>

      {saved && signs && (
        <section
          aria-labelledby="workflow-secret"
          className="flex flex-col gap-2 rounded-card bg-surface p-5"
        >
          <h2 id="workflow-secret" className="text-headline text-label">
            {t("builder.secretTitle")}
          </h2>
          <p className="text-footnote text-label-secondary">{t("builder.secretDescription")}</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 truncate rounded-control bg-fill px-3 py-2 font-mono text-footnote">
              {saved.secret}
            </code>
            <CopyButton value={saved.secret} label={t("builder.copySecret")} />
          </div>
        </section>
      )}

      {editing?.kind === "trigger" && (
        <TriggerEditorDialog
          trigger={draft.trigger}
          events={catalogue?.events ?? []}
          onClose={() => setEditing(undefined)}
          onSave={(trigger) => {
            onChange({ ...draft, trigger });
            setEditing(undefined);
          }}
        />
      )}
      {editing?.kind === "step" && (
        <StepEditorDialog
          step={editing.step}
          catalogue={catalogue}
          workflows={otherWorkflows}
          onClose={() => setEditing(undefined)}
          onSave={saveStep}
        />
      )}
    </>
  );
}
