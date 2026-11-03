import type {
  ConditionOperator,
  ConditionRule,
  FieldConditionsInput,
} from "@lintel/field-conditions";
import { operatorsWithoutValue } from "@lintel/field-conditions";
import { Plus, X } from "lucide-react";
import { useId } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Toggle } from "../design/Toggle.js";
import type { Field } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import {
  type ConditionTarget,
  describeConditions,
  holdsSeveral,
  operatorLabel,
  operatorsFor,
} from "./conditionTargets.js";

interface ConditionsEditorProps {
  conditions: FieldConditionsInput | undefined;
  targets: readonly ConditionTarget[];
  onChange: (conditions: FieldConditionsInput | undefined) => void;
  /**
   * The field is already saved, so entries may hold values in it. A new condition then keeps
   * them while hidden: the default, clearing them, silently lost them on the next save of
   * each entry (LINTEL-DATA-005).
   */
  isExistingField?: boolean;
}

/**
 * "Only show this field when...": show or hide, all or any, and a list of rules, each a
 * field, a comparison and a value. The value picker knows the field it compares with: its
 * choices, On and Off for a switch, a number box for a number. A sentence at the top says
 * what the rules do in plain words.
 */
export function ConditionsEditor({
  conditions,
  targets,
  onChange,
  isExistingField = false,
}: ConditionsEditorProps) {
  const isOn = conditions !== undefined;

  if (targets.length === 0) {
    return <p className="text-body text-label-secondary">{t("conditions.noTargets")}</p>;
  }

  function newRule(): ConditionRule {
    const target = targets[0];
    const operator = operatorsFor(target?.field)[0] ?? "is";
    return { field: target?.reference ?? "", operator, value: firstValue(target?.field, operator) };
  }

  function setRules(rules: ConditionRule[]) {
    onChange(rules.length === 0 ? undefined : { ...conditions, rules });
  }

  const rules = conditions?.rules ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Toggle
        label={t("conditions.enable")}
        checked={isOn}
        onCheckedChange={(on) =>
          onChange(
            on
              ? {
                  action: "show",
                  match: "all",
                  rules: [newRule()],
                  ...(isExistingField ? { keepHiddenValues: true } : {}),
                }
              : undefined,
          )
        }
      />
      {isOn && (
        <>
          <p className="rounded-card bg-accent/8 px-4 py-3 text-body text-label" aria-live="polite">
            {describeConditions(conditions, targets)}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              label={t("conditions.action")}
              options={[
                { value: "show", label: t("conditions.showWhen") },
                { value: "hide", label: t("conditions.hideWhen") },
              ]}
              value={conditions.action ?? "show"}
              onChange={(action) => onChange({ ...conditions, action })}
            />
            <SegmentedControl
              label={t("conditions.match")}
              options={[
                { value: "all", label: t("conditions.matchAll") },
                { value: "any", label: t("conditions.matchAny") },
              ]}
              value={conditions.match ?? "all"}
              onChange={(match) => onChange({ ...conditions, match })}
            />
          </div>
          <ol className="flex flex-col gap-2">
            {rules.map((rule, index) => (
              <RuleRow
                key={index}
                number={index + 1}
                rule={rule}
                targets={targets}
                onChange={(changed) =>
                  setRules(rules.map((other, position) => (position === index ? changed : other)))
                }
                onRemove={() => setRules(rules.filter((_, position) => position !== index))}
              />
            ))}
          </ol>
          <Button
            variant="tinted"
            size="small"
            icon={<Plus aria-hidden="true" />}
            className="self-start"
            disabled={rules.length >= 20}
            onClick={() => setRules([...rules, newRule()])}
          >
            {t("conditions.addRule")}
          </Button>
          <Toggle
            label={t("conditions.keepHiddenValues")}
            checked={conditions.keepHiddenValues === true}
            onCheckedChange={(keepHiddenValues) => onChange({ ...conditions, keepHiddenValues })}
          />
          <p className="-mt-3 text-footnote text-label-secondary">
            {isExistingField && conditions.keepHiddenValues === true
              ? t("conditions.keepHiddenValuesExistingHint")
              : t("conditions.keepHiddenValuesHint")}
          </p>
        </>
      )}
    </div>
  );
}

/** The value a rule starts with, so it is complete as soon as it is added. */
function firstValue(field: Field | undefined, operator: ConditionOperator): ConditionRule["value"] {
  if (operatorsWithoutValue.includes(operator)) return undefined;
  if (field?.type === "toggle" || field?.type === "revealer") return true;
  const first = field?.options.choices?.[0]?.value;
  if (operator === "includesAny") return first ? [first] : [];
  return first ?? "";
}

interface RuleRowProps {
  number: number;
  rule: ConditionRule;
  targets: readonly ConditionTarget[];
  onChange: (rule: ConditionRule) => void;
  onRemove: () => void;
}

function RuleRow({ number, rule, targets, onChange, onRemove }: RuleRowProps) {
  const target = targets.find((candidate) => candidate.reference === rule.field);
  const operators = operatorsFor(target?.field);
  const needsValue = !operatorsWithoutValue.includes(rule.operator);
  const selectClasses = classNames("h-9 text-footnote", controlClasses());

  return (
    <li className="grid grid-cols-1 items-start gap-2 rounded-card bg-fill/50 p-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
      <select
        aria-label={t("conditions.ruleField", { number })}
        value={rule.field}
        onChange={(event) => {
          const next = targets.find((candidate) => candidate.reference === event.target.value);
          const operator = operatorsFor(next?.field).includes(rule.operator)
            ? rule.operator
            : (operatorsFor(next?.field)[0] ?? "is");
          onChange({
            field: event.target.value,
            operator,
            value: firstValue(next?.field, operator),
          });
        }}
        className={selectClasses}
      >
        {!target && <option value={rule.field}>{rule.field || t("conditions.chooseField")}</option>}
        <TargetOptions targets={targets} />
      </select>
      <select
        aria-label={t("conditions.ruleOperator", { number })}
        value={rule.operator}
        onChange={(event) => {
          const operator = event.target.value as ConditionOperator;
          const keepsValue =
            !operatorsWithoutValue.includes(operator) &&
            Array.isArray(rule.value) === (operator === "includesAny");
          onChange({
            ...rule,
            operator,
            value: keepsValue ? rule.value : firstValue(target?.field, operator),
          });
        }}
        className={selectClasses}
      >
        {operators.map((operator) => (
          <option key={operator} value={operator}>
            {operatorLabel(operator, target?.field)}
          </option>
        ))}
      </select>
      {needsValue ? (
        <ValuePicker number={number} rule={rule} field={target?.field} onChange={onChange} />
      ) : (
        <span aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("conditions.removeRule", { number })}
        title={t("conditions.removeRule", { number })}
        className="flex size-9 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-danger focus-visible:focus-ring"
      >
        <X aria-hidden="true" strokeWidth={2} className="size-4" />
      </button>
    </li>
  );
}

function TargetOptions({ targets }: { targets: readonly ConditionTarget[] }) {
  const groups = [
    { where: "beside", label: t("conditions.group.beside") },
    { where: "outside", label: t("conditions.group.outside") },
    { where: "entry", label: t("conditions.group.entry") },
  ] as const;
  const used = groups.filter((group) => targets.some((target) => target.where === group.where));
  const options = (where: ConditionTarget["where"]) =>
    targets
      .filter((target) => target.where === where)
      .map((target) => (
        <option key={target.reference} value={target.reference}>
          {target.field.label || target.field.handle}
        </option>
      ));
  // Only fields beside this one: no need for headings.
  if (used.length === 1) return <>{options(used[0]?.where ?? "beside")}</>;
  return (
    <>
      {used.map((group) => (
        <optgroup key={group.where} label={group.label}>
          {options(group.where)}
        </optgroup>
      ))}
    </>
  );
}

interface ValuePickerProps {
  number: number;
  rule: ConditionRule;
  field: Field | undefined;
  onChange: (rule: ConditionRule) => void;
}

/** The right control for the value: choices, On/Off, a number or text. */
function ValuePicker({ number, rule, field, onChange }: ValuePickerProps) {
  const groupId = useId();
  const label = t("conditions.ruleValue", { number });
  const inputClasses = classNames("h-9 text-footnote", controlClasses());
  const choices = field?.options.choices;
  const setValue = (value: ConditionRule["value"]) => onChange({ ...rule, value });

  if (field?.type === "toggle" || field?.type === "revealer") {
    return (
      <select
        aria-label={label}
        value={rule.value === false || rule.value === "false" ? "false" : "true"}
        onChange={(event) => setValue(event.target.value === "true")}
        className={inputClasses}
      >
        <option value="true">{t("conditions.on")}</option>
        <option value="false">{t("conditions.off")}</option>
      </select>
    );
  }

  if (choices && choices.length > 0) {
    if (
      rule.operator === "includesAny" ||
      (field && holdsSeveral(field) && Array.isArray(rule.value))
    ) {
      const selected = Array.isArray(rule.value) ? rule.value : [];
      return (
        <div role="group" aria-labelledby={groupId} className="flex flex-wrap gap-1.5 pt-1">
          <span id={groupId} className="sr-only">
            {label}
          </span>
          {choices.map((choice) => {
            const isChosen = selected.includes(choice.value);
            return (
              <label
                key={choice.value}
                className={classNames(
                  "inline-flex h-7 cursor-pointer items-center rounded-full px-3 text-footnote has-[:focus-visible]:focus-ring",
                  isChosen ? "bg-accent/14 text-accent" : "bg-surface text-label-secondary",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isChosen}
                  onChange={() =>
                    setValue(
                      isChosen
                        ? selected.filter((value) => value !== choice.value)
                        : [...selected, choice.value],
                    )
                  }
                />
                {choice.label}
              </label>
            );
          })}
        </div>
      );
    }
    return (
      <select
        aria-label={label}
        value={typeof rule.value === "string" ? rule.value : String(rule.value ?? "")}
        onChange={(event) => setValue(event.target.value)}
        className={inputClasses}
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }

  const isNumber = field?.type === "number" || field?.type === "range";
  const inputType = isNumber
    ? "number"
    : field?.type === "date"
      ? "date"
      : field?.type === "time"
        ? "time"
        : "text";
  return (
    <input
      aria-label={label}
      type={inputType}
      value={Array.isArray(rule.value) ? rule.value.join(", ") : String(rule.value ?? "")}
      onChange={(event) => {
        const text = event.target.value;
        setValue(
          isNumber && text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : text,
        );
      }}
      className={inputClasses}
    />
  );
}
