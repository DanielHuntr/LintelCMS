import { useId, useState } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import { stepsOf } from "./formDraft.js";
import type { FormField } from "./forms.types.js";

interface FormPreviewProps {
  name: string;
  fields: readonly FormField[];
  submitLabel: string;
}

/**
 * The form roughly as visitors see it, updated with every change in the builder. It can be
 * clicked through (steps included) but sends nothing. Websites draw it with their own
 * styles, so this shows what is asked and in what order rather than the exact look.
 */
export function FormPreview({ name, fields, submitLabel }: FormPreviewProps) {
  const steps = stepsOf(fields);
  const [stepIndex, setStepIndex] = useState(0);
  const current = Math.min(stepIndex, steps.length - 1);
  const step = steps[current];
  const isLast = current === steps.length - 1;

  return (
    <section aria-label={t("forms.preview.label")} className="rounded-card bg-surface p-5">
      <p className="mb-4 text-caption font-medium tracking-wide text-label-secondary uppercase">
        {t("forms.preview.title")}
      </p>
      <form
        aria-label={name}
        onSubmit={(event) => event.preventDefault()}
        className="flex flex-col gap-4"
        noValidate
      >
        {steps.length > 1 && (
          <p className="text-footnote text-label-secondary">
            {t("forms.preview.step", { number: current + 1, count: steps.length })}
          </p>
        )}
        {step?.title && <h3 className="text-headline text-label">{step.title}</h3>}
        {step?.fields.length === 0 && (
          <p className="text-body text-label-secondary">{t("forms.preview.empty")}</p>
        )}
        {step?.fields.map((field) => (
          <PreviewField key={field.id} field={field} />
        ))}
        <div className="flex gap-2">
          {current > 0 && (
            <Button type="button" variant="tinted" onClick={() => setStepIndex(current - 1)}>
              {t("forms.preview.back")}
            </Button>
          )}
          {isLast ? (
            <Button type="submit" disabled={fields.length === 0}>
              {submitLabel || t("forms.settings.submitLabelDefault")}
            </Button>
          ) : (
            <Button type="button" onClick={() => setStepIndex(current + 1)}>
              {t("forms.preview.next")}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

function PreviewField({ field }: { field: FormField }) {
  const id = useId();
  const helpId = `${id}-help`;
  const describedBy = field.helpText ? helpId : undefined;
  const label = (
    <>
      {field.label}
      {field.required && (
        <span className="ms-1 text-danger" aria-hidden="true">
          *
        </span>
      )}
    </>
  );
  const help = field.helpText && (
    <p id={helpId} className="text-footnote text-label-secondary">
      {field.helpText}
    </p>
  );
  const choices = field.options.choices ?? [];

  if (field.type === "hidden") {
    return (
      <p className="rounded-control bg-fill px-3 py-2 text-footnote text-label-secondary">
        {t("forms.preview.hidden", { label: field.label })}
      </p>
    );
  }
  if (field.type === "consent") {
    return (
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-body text-label">
          <input
            type="checkbox"
            className="mt-1 accent-accent-fill"
            aria-describedby={describedBy}
          />
          <span>{label}</span>
        </label>
        {help}
      </div>
    );
  }
  if (field.type === "choice" || field.type === "checkboxes") {
    return (
      <fieldset className="flex flex-col gap-1.5" aria-describedby={describedBy}>
        <legend className="mb-1 text-footnote text-label">{label}</legend>
        {choices.map((choice) => (
          <label key={choice} className="flex items-center gap-2 text-body text-label">
            <input
              type={field.type === "choice" ? "radio" : "checkbox"}
              name={`${id}-${field.handle}`}
              className="accent-accent-fill"
            />
            {choice}
          </label>
        ))}
        {help}
      </fieldset>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-footnote text-label">
        {label}
      </label>
      <PreviewControl field={field} id={id} describedBy={describedBy} choices={choices} />
      {help}
    </div>
  );
}

function PreviewControl({
  field,
  id,
  describedBy,
  choices,
}: {
  field: FormField;
  id: string;
  describedBy: string | undefined;
  choices: readonly string[];
}) {
  const common = {
    id,
    "aria-describedby": describedBy,
    placeholder: field.placeholder || undefined,
  };
  switch (field.type) {
    case "longText":
      return <textarea {...common} rows={4} className={classNames(controlClasses(), "py-2")} />;
    case "dropdown":
      return (
        <select {...common} className={classNames(controlClasses(), "h-10")}>
          <option value="">{t("forms.preview.choose")}</option>
          {choices.map((choice) => (
            <option key={choice}>{choice}</option>
          ))}
        </select>
      );
    case "file":
      return <input {...common} type="file" className="text-footnote text-label" />;
    default: {
      const types: Partial<Record<FormField["type"], string>> = {
        email: "email",
        phone: "tel",
        number: "number",
        date: "date",
      };
      return (
        <input
          {...common}
          type={types[field.type] ?? "text"}
          className={classNames(controlClasses(), "h-10")}
        />
      );
    }
  }
}
