import { Plus, X } from "lucide-react";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { SelectField } from "./FormControls.js";
import type { Condition, ConditionStep, ConditionType } from "./workflows.types.js";

const conditionTypes: readonly ConditionType[] = [
  "field_equals",
  "field_contains",
  "field_changed",
  "collection_is",
  "user_role",
  "value_equals",
];

/** The conditions of an "Only continue if…" step, and whether all or any must hold. */
export function ConditionsField({
  step,
  onChange,
}: {
  step: ConditionStep;
  roles: readonly { handle: string; name: string }[];
  onChange: (step: ConditionStep) => void;
}) {
  function change(index: number, condition: Condition) {
    onChange({
      ...step,
      conditions: step.conditions.map((existing, position) =>
        position === index ? condition : existing,
      ),
    });
  }

  return (
    <>
      <SelectField
        label={t("stepEditor.matchLabel")}
        value={step.match}
        onChange={(event) =>
          onChange({ ...step, match: event.target.value === "any" ? "any" : "all" })
        }
      >
        <option value="all">{t("stepEditor.match.all")}</option>
        <option value="any">{t("stepEditor.match.any")}</option>
      </SelectField>
      {step.conditions.map((condition, index) => (
        <fieldset key={index} className="flex flex-col gap-3 rounded-card bg-fill/60 p-3">
          <div className="flex items-center justify-between">
            <legend className="text-footnote font-semibold text-label">
              {t("stepEditor.conditionLabel", { number: index + 1 })}
            </legend>
            {step.conditions.length > 1 && (
              <button
                type="button"
                aria-label={t("stepEditor.removeCondition", { number: index + 1 })}
                onClick={() =>
                  onChange({
                    ...step,
                    conditions: step.conditions.filter(
                      (_condition, position) => position !== index,
                    ),
                  })
                }
                className="flex size-7 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
          <SelectField
            label={t("stepEditor.conditionType")}
            value={condition.type}
            onChange={(event) => change(index, emptyCondition(event.target.value as ConditionType))}
          >
            {conditionTypes.map((type) => (
              <option key={type} value={type}>
                {t(`condition.${type}`)}
              </option>
            ))}
          </SelectField>
          <ConditionInputs condition={condition} onChange={(next) => change(index, next)} />
        </fieldset>
      ))}
      <div>
        <Button
          variant="tinted"
          size="small"
          icon={<Plus aria-hidden="true" />}
          onClick={() =>
            onChange({ ...step, conditions: [...step.conditions, emptyCondition("field_equals")] })
          }
        >
          {t("stepEditor.addCondition")}
        </Button>
      </div>
    </>
  );
}

function ConditionInputs({
  condition,
  onChange,
}: {
  condition: Condition;
  onChange: (condition: Condition) => void;
}) {
  switch (condition.type) {
    case "field_equals":
    case "field_contains":
      return (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t("stepEditor.fieldLabel")}
            value={condition.field}
            placeholder="title"
            onChange={(event) => onChange({ ...condition, field: event.target.value.trim() })}
          />
          <TextField
            label={t("stepEditor.valueLabel")}
            value={condition.value}
            onChange={(event) => onChange({ ...condition, value: event.target.value })}
          />
        </div>
      );
    case "field_changed":
      return (
        <TextField
          label={t("stepEditor.fieldLabel")}
          hint={t("stepEditor.fieldHint")}
          value={condition.field}
          onChange={(event) => onChange({ ...condition, field: event.target.value.trim() })}
        />
      );
    case "collection_is":
      return (
        <TextField
          label={t("stepEditor.collectionsLabel")}
          value={condition.collections.join(", ")}
          placeholder="pages, posts"
          onChange={(event) =>
            onChange({ ...condition, collections: splitList(event.target.value) })
          }
        />
      );
    case "user_role":
      return (
        <TextField
          label={t("stepEditor.rolesLabel")}
          value={condition.roles.join(", ")}
          placeholder="editor"
          onChange={(event) => onChange({ ...condition, roles: splitList(event.target.value) })}
        />
      );
    case "value_equals":
      return (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t("stepEditor.leftLabel")}
            value={condition.left}
            placeholder="{{steps.call1.body.ok}}"
            onChange={(event) => onChange({ ...condition, left: event.target.value })}
          />
          <TextField
            label={t("stepEditor.rightLabel")}
            value={condition.right}
            onChange={(event) => onChange({ ...condition, right: event.target.value })}
          />
        </div>
      );
  }
}

function emptyCondition(type: ConditionType): Condition {
  switch (type) {
    case "field_equals":
    case "field_contains":
      return { type, field: "", value: "" };
    case "field_changed":
      return { type, field: "" };
    case "collection_is":
      return { type, collections: [] };
    case "user_role":
      return { type, roles: [] };
    case "value_equals":
      return { type, left: "", right: "" };
  }
}

/** Keeps a trailing comma while typing, so "pages, " doesn't jump back to "pages". */
function splitList(text: string): string[] {
  return text
    .split(",")
    .map((item, index, items) => (index === items.length - 1 ? item.trimStart() : item.trim()));
}
