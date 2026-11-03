import { Container } from "../layout/Container.js";
import { Section } from "../layout/Section.js";
import type { FormBlock, SiteForm, SiteFormField } from "./block.types.js";

export type FormSectionProps = Omit<FormBlock, "type">;

/**
 * One of the site's forms, as plain labelled HTML that posts like any form. A small script
 * (`scriptUrl`) adds the anti-spam token when the page opens; the server checks every
 * answer again, so nothing here is trusted.
 */
export function FormSection({ id, heading, form }: FormSectionProps) {
  if (!form) {
    return null;
  }
  const headingId = `form-${id}`;
  return (
    <Section component="form" labelledBy={headingId} className="lintel-form-section">
      <Container width="narrow">
        <h2 id={headingId} className="lintel-form-section__heading" data-lintel-field="heading">
          {heading || form.name}
        </h2>
        {form.acceptingSubmissions ? (
          <PlainForm form={form} id={id} />
        ) : (
          <p className="lintel-form-section__closed">
            This form isn’t taking submissions at the moment.
          </p>
        )}
      </Container>
    </Section>
  );
}

function PlainForm({ form, id }: { form: SiteForm; id: string }) {
  return (
    <>
      <form
        className="lintel-site-form"
        method="post"
        action={form.action}
        encType="application/x-www-form-urlencoded"
        data-lintel-form={form.handle}
        data-lintel-token-url={form.tokenUrl}
      >
        {form.fields.map((field) => (
          <FormField key={field.handle} field={field} formId={id} />
        ))}
        <div className="lintel-site-form__trap" aria-hidden="true">
          <label htmlFor={`${id}-${form.honeypotField}`}>Leave this empty</label>
          <input
            id={`${id}-${form.honeypotField}`}
            name={form.honeypotField}
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <input type="hidden" name={form.tokenField} value="" />
        <button type="submit" className="lintel-button lintel-button--primary">
          {form.submitLabel}
        </button>
      </form>
      <script src={form.scriptUrl} defer />
    </>
  );
}

function FormField({ field, formId }: { field: SiteFormField; formId: string }) {
  const inputId = `${formId}-${field.handle}`;
  const helpId = field.helpText ? `${inputId}-help` : undefined;
  const label = (
    <>
      {field.label}
      {field.required && (
        <span className="lintel-site-form__required" aria-hidden="true">
          *
        </span>
      )}
    </>
  );
  if (field.type === "hidden") {
    return <input type="hidden" name={field.handle} value={field.placeholder} />;
  }
  if (field.type === "choice" || field.type === "checkboxes") {
    const isCheckboxes = field.type === "checkboxes";
    return (
      <fieldset className="lintel-site-form__field" aria-describedby={helpId}>
        <legend className="lintel-site-form__label">{label}</legend>
        {field.choices.map((choice, index) => (
          <label key={choice} className="lintel-site-form__option">
            <input
              type={isCheckboxes ? "checkbox" : "radio"}
              name={field.handle}
              value={choice}
              required={!isCheckboxes && field.required && index === 0}
            />
            {choice}
          </label>
        ))}
        <HelpText id={helpId} text={field.helpText} />
      </fieldset>
    );
  }
  if (field.type === "consent") {
    return (
      <div className="lintel-site-form__field">
        <label className="lintel-site-form__option">
          <input
            type="checkbox"
            name={field.handle}
            value="yes"
            required={field.required}
            aria-describedby={helpId}
          />
          {label}
        </label>
        <HelpText id={helpId} text={field.helpText} />
      </div>
    );
  }
  return (
    <div className="lintel-site-form__field">
      <label className="lintel-site-form__label" htmlFor={inputId}>
        {label}
      </label>
      <FieldControl field={field} inputId={inputId} helpId={helpId} />
      <HelpText id={helpId} text={field.helpText} />
    </div>
  );
}

function FieldControl({
  field,
  inputId,
  helpId,
}: {
  field: SiteFormField;
  inputId: string;
  helpId: string | undefined;
}) {
  const shared = {
    id: inputId,
    name: field.handle,
    required: field.required,
    "aria-describedby": helpId,
  };
  switch (field.type) {
    case "longText":
      return <textarea {...shared} placeholder={field.placeholder || undefined} rows={6} />;
    case "dropdown":
      return (
        <select {...shared} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {field.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <input
          {...shared}
          type={inputTypes[field.type] ?? "text"}
          placeholder={field.placeholder || undefined}
          autoComplete={field.type === "email" ? "email" : undefined}
        />
      );
  }
}

const inputTypes: Record<string, string> = {
  email: "email",
  phone: "tel",
  number: "number",
  date: "date",
  file: "file",
};

function HelpText({ id, text }: { id: string | undefined; text: string }) {
  return text ? (
    <p id={id} className="lintel-site-form__help">
      {text}
    </p>
  ) : null;
}
