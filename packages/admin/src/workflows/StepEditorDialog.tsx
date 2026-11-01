import { type FormEvent, useState } from "react";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { ConditionsField } from "./ConditionsField.js";
import { SelectField, TextAreaField } from "./FormControls.js";
import { HeadersField } from "./HeadersField.js";
import { RecipientsField, RoleSelect } from "./RecipientsField.js";
import type { Catalogue, Workflow, WorkflowStep } from "./workflows.types.js";

interface StepEditorDialogProps {
  step: WorkflowStep;
  catalogue: Catalogue | undefined;
  /** Other workflows, for "Run another automation". */
  workflows: readonly Pick<Workflow, "id" | "name">[];
  onClose: () => void;
  onSave: (step: WorkflowStep) => void;
}

/** Fills in one step. The form changes with the kind of step; Done puts it in the flow. */
export function StepEditorDialog({
  step,
  catalogue,
  workflows,
  onClose,
  onSave,
}: StepEditorDialogProps) {
  const [draft, setDraft] = useState<WorkflowStep>(step);
  const [problem, setProblem] = useState<string | undefined>();
  const roles = catalogue?.roles ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    const tidy = tidyStep(draft);
    const missing = findMissing(tidy);
    if (missing.length > 0) {
      setProblem(t("stepEditor.problem", { fields: missing.join(", ") }));
      return;
    }
    onSave(tidy);
  }

  return (
    <Dialog
      open
      size="sheet"
      onClose={onClose}
      title={t(`step.${step.type}`)}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="step-editor">
            {t("stepEditor.save")}
          </Button>
        </>
      }
    >
      <form id="step-editor" onSubmit={submit} className="flex flex-col gap-5">
        <StepFields draft={draft} onChange={setDraft} roles={roles} workflows={workflows} />
        {problem && (
          <p role="alert" className="text-footnote text-danger">
            {problem}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function StepFields({
  draft,
  onChange,
  roles,
  workflows,
}: {
  draft: WorkflowStep;
  onChange: (step: WorkflowStep) => void;
  roles: readonly { handle: string; name: string }[];
  workflows: readonly Pick<Workflow, "id" | "name">[];
}) {
  switch (draft.type) {
    case "send_email":
      return (
        <>
          <RecipientsField
            value={draft.to}
            roles={roles}
            allowAddresses
            onChange={(to) => onChange({ ...draft, to })}
          />
          <TextField
            label={t("stepEditor.subjectLabel")}
            value={draft.subject}
            onChange={(event) => onChange({ ...draft, subject: event.target.value })}
            data-autofocus
          />
          <TextAreaField
            label={t("stepEditor.bodyLabel")}
            hint={t("stepEditor.templateHint")}
            value={draft.body}
            rows={6}
            onChange={(event) => onChange({ ...draft, body: event.target.value })}
          />
        </>
      );
    case "notify_users":
      return (
        <>
          <RecipientsField
            value={draft.to}
            roles={roles}
            allowAddresses={false}
            onChange={(to) => onChange({ ...draft, to })}
          />
          <TextAreaField
            label={t("stepEditor.notifyMessageLabel")}
            hint={t("stepEditor.templateHint")}
            value={draft.message}
            rows={3}
            onChange={(event) => onChange({ ...draft, message: event.target.value })}
          />
        </>
      );
    case "http_request":
      return (
        <>
          <TextField
            label={t("stepEditor.urlLabel")}
            hint={t("stepEditor.urlHint")}
            type="url"
            inputMode="url"
            value={draft.url}
            placeholder="https://example.com/lintel"
            onChange={(event) => onChange({ ...draft, url: event.target.value })}
            data-autofocus
          />
          <SelectField
            label={t("stepEditor.methodLabel")}
            value={draft.method}
            onChange={(event) =>
              onChange({ ...draft, method: event.target.value as typeof draft.method })
            }
          >
            {(["POST", "PUT", "PATCH", "GET", "DELETE"] as const).map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </SelectField>
          <HeadersField
            headers={draft.headers}
            onChange={(headers) => onChange({ ...draft, headers })}
          />
          {draft.method !== "GET" && draft.method !== "DELETE" && (
            <TextAreaField
              label={t("stepEditor.jsonBodyLabel")}
              hint={t("stepEditor.jsonBodyHint")}
              code
              rows={6}
              value={draft.body}
              placeholder={'{ "title": "{{entry.title}}" }'}
              onChange={(event) => onChange({ ...draft, body: event.target.value })}
            />
          )}
          <Toggle
            label={t("stepEditor.signLabel")}
            checked={draft.sign}
            onCheckedChange={(sign) => onChange({ ...draft, sign })}
          />
          <p className="-mt-3 text-footnote text-label-secondary">{t("stepEditor.signHint")}</p>
          <TextField
            label={t("stepEditor.timeoutLabel")}
            type="number"
            min={1}
            max={30}
            value={String(draft.timeoutSeconds)}
            onChange={(event) =>
              onChange({ ...draft, timeoutSeconds: clamp(event.target.valueAsNumber, 1, 30) })
            }
          />
        </>
      );
    case "update_entry_field":
      return (
        <>
          <TextField
            label={t("stepEditor.fieldLabel")}
            hint={t("stepEditor.fieldHint")}
            value={draft.field}
            onChange={(event) => onChange({ ...draft, field: event.target.value.trim() })}
            data-autofocus
          />
          <TextField
            label={t("stepEditor.valueLabel")}
            hint={t("stepEditor.templateHint")}
            value={draft.value}
            onChange={(event) => onChange({ ...draft, value: event.target.value })}
          />
        </>
      );
    case "wait":
      return (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t("stepEditor.amountLabel")}
            type="number"
            min={1}
            max={1000}
            value={String(draft.amount)}
            onChange={(event) =>
              onChange({ ...draft, amount: clamp(event.target.valueAsNumber, 1, 1000) })
            }
            data-autofocus
          />
          <SelectField
            label={t("stepEditor.unitLabel")}
            value={draft.unit}
            onChange={(event) =>
              onChange({ ...draft, unit: event.target.value as typeof draft.unit })
            }
          >
            <option value="minutes">{t("describe.unit.minutes")}</option>
            <option value="hours">{t("describe.unit.hours")}</option>
            <option value="days">{t("describe.unit.days")}</option>
          </SelectField>
        </div>
      );
    case "run_workflow":
      return (
        <SelectField
          label={t("stepEditor.workflowLabel")}
          value={draft.workflowId}
          onChange={(event) => onChange({ ...draft, workflowId: event.target.value })}
        >
          <option value="">{t("stepEditor.chooseWorkflow")}</option>
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name}
            </option>
          ))}
        </SelectField>
      );
    case "condition":
      return <ConditionsField step={draft} roles={roles} onChange={onChange} />;
    case "approval":
      return (
        <>
          <RoleSelect
            label={t("stepEditor.approverLabel")}
            roles={roles}
            value={draft.role}
            onChange={(role) => onChange({ ...draft, role })}
          />
          <TextAreaField
            label={t("stepEditor.approvalMessageLabel")}
            hint={t("stepEditor.templateHint")}
            rows={2}
            value={draft.message}
            onChange={(event) => onChange({ ...draft, message: event.target.value })}
          />
          <TextField
            label={t("stepEditor.expiresLabel")}
            hint={t("stepEditor.expiresHint")}
            type="number"
            min={1}
            max={90}
            value={draft.expiresAfterDays === null ? "" : String(draft.expiresAfterDays)}
            onChange={(event) =>
              onChange({
                ...draft,
                expiresAfterDays:
                  event.target.value === "" ? null : clamp(event.target.valueAsNumber, 1, 90),
              })
            }
          />
        </>
      );
    case "publish_entry":
    case "unpublish_entry":
      return null;
  }
}

/** Labels of the fields still empty, so Done can say what is missing. */
export function findMissing(step: WorkflowStep): string[] {
  const missing: string[] = [];
  if (
    (step.type === "send_email" || step.type === "notify_users") &&
    step.to.type === "addresses" &&
    !step.to.addresses.trim()
  ) {
    missing.push(t("stepEditor.addressesLabel"));
  }
  if (step.type === "send_email" && !step.subject.trim())
    missing.push(t("stepEditor.subjectLabel"));
  if (step.type === "notify_users" && !step.message.trim())
    missing.push(t("stepEditor.notifyMessageLabel"));
  if (step.type === "http_request" && !step.url.trim()) missing.push(t("stepEditor.urlLabel"));
  if (step.type === "update_entry_field" && !step.field) missing.push(t("stepEditor.fieldLabel"));
  if (step.type === "run_workflow" && !step.workflowId) missing.push(t("stepEditor.workflowLabel"));
  return missing;
}

/** Drops empty list items and headers left over from typing. */
function tidyStep(step: WorkflowStep): WorkflowStep {
  if (step.type === "condition") {
    return {
      ...step,
      conditions: step.conditions.map((condition) =>
        condition.type === "collection_is"
          ? { ...condition, collections: condition.collections.filter(Boolean) }
          : condition.type === "user_role"
            ? { ...condition, roles: condition.roles.filter(Boolean) }
            : condition,
      ),
    };
  }
  if (step.type === "http_request") {
    return { ...step, headers: step.headers.filter((header) => header.name.trim() !== "") };
  }
  return step;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (Number.isNaN(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
