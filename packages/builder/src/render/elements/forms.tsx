import {
  type DataForm,
  type DataFormField,
  formEmbedComponent,
  newsletterSignupComponent,
} from "@lintel/builder-model";
import { drawsProps, type RenderMode } from "../component-registry.js";
import { usePageData } from "../data-context.js";
import { cx } from "./behaviour-types.js";
import { useSite } from "./navigation.js";

/**
 * Forms from the Forms plugin, drawn as plain HTML forms that post to the forms API through
 * the website (`/_lintel/api/forms/...`), so they work without script. The elements script
 * sends them in the background instead and shows the thank-you message in place.
 */

function FieldInput({ field, formId }: { field: DataFormField; formId: string }) {
  const id = `${formId}-${field.handle}`;
  const hintId = field.helpText ? `${id}-hint` : undefined;
  const common = {
    id,
    name: field.handle,
    required: field.required || undefined,
    "aria-describedby": hintId,
  };
  const label = (
    <label htmlFor={id} className="lintel-form__label">
      {field.label}
      {field.required && <span className="lintel-form__required"> (required)</span>}
    </label>
  );
  const hint = field.helpText ? (
    <p id={hintId} className="lintel-form__hint">
      {field.helpText}
    </p>
  ) : null;
  const error = <p className="lintel-form__error" data-error-for={field.handle} hidden />;

  if (field.type === "hidden") return <input type="hidden" name={field.handle} />;
  if (field.type === "choice" || field.type === "checkboxes") {
    const type = field.type === "choice" ? "radio" : "checkbox";
    return (
      <fieldset className="lintel-form__field lintel-form__choices" aria-describedby={hintId}>
        <legend className="lintel-form__label">
          {field.label}
          {field.required && <span className="lintel-form__required"> (required)</span>}
        </legend>
        {hint}
        {field.choices.map((choice, index) => (
          <label key={choice} className="lintel-form__choice">
            <input
              type={type}
              name={field.handle}
              value={choice}
              required={type === "radio" && field.required && index === 0 ? true : undefined}
            />
            {choice}
          </label>
        ))}
        {error}
      </fieldset>
    );
  }
  if (field.type === "consent") {
    return (
      <div className="lintel-form__field lintel-form__consent">
        <label className="lintel-form__choice">
          <input type="checkbox" value="yes" {...common} />
          {field.label}
        </label>
        {hint}
        {error}
      </div>
    );
  }
  const control =
    field.type === "longText" ? (
      <textarea {...common} rows={5} placeholder={field.placeholder || undefined} />
    ) : field.type === "dropdown" ? (
      <select {...common} defaultValue="">
        <option value="" disabled>
          Choose…
        </option>
        {field.choices.map((choice) => (
          <option key={choice}>{choice}</option>
        ))}
      </select>
    ) : (
      <input
        {...common}
        type={
          { email: "email", phone: "tel", number: "number", date: "date", file: "file" }[
            field.type
          ] ?? "text"
        }
        autoComplete={{ email: "email", phone: "tel" }[field.type]}
        placeholder={field.placeholder || undefined}
      />
    );
  return (
    <div className="lintel-form__field">
      {label}
      {hint}
      {control}
      {error}
    </div>
  );
}

function SpamFields({ form }: { form: DataForm }) {
  return (
    <>
      <input
        type="hidden"
        name={form.spamProtection.tokenField}
        value={form.spamProtection.token}
      />
      <div className="lintel-form__trap" aria-hidden="true">
        <label>
          Leave this empty
          <input
            type="text"
            name={form.spamProtection.honeypotField}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
    </>
  );
}

function formAction(apiBase: string, handle: string, mode: RenderMode) {
  return mode === "site" ? `${apiBase}/forms/${encodeURIComponent(handle)}/submissions` : undefined;
}

function Unavailable({
  attributes,
  mode,
  what,
}: {
  attributes: { className: string };
  mode: RenderMode;
  what: string;
}) {
  return mode === "canvas" ? (
    <div
      {...attributes}
      className={cx(attributes.className, "lintel-form")}
      data-lintel-placeholder="form"
    >
      <p className="lintel-form__hint">{what}</p>
    </div>
  ) : null;
}

const FormEmbed = drawsProps(formEmbedComponent, ({ props, attributes, node, mode }) => {
  const form = usePageData().forms?.[props.form];
  const site = useSite();
  if (!form)
    return (
      <Unavailable attributes={attributes} mode={mode} what="Choose a form in the Content panel." />
    );
  const hasFiles = form.fields.some((field) => field.type === "file");
  const formId = `form-${node.id}`;
  return (
    <div {...attributes} className={cx(attributes.className, "lintel-form")}>
      {props.showTitle && <h2 className="lintel-form__title">{form.name}</h2>}
      {form.acceptingSubmissions ? (
        <form
          id={formId}
          action={formAction(site.apiBase, form.handle, mode)}
          method="post"
          encType={hasFiles ? "multipart/form-data" : undefined}
          data-behaviour="form"
          data-confirmation={form.confirmationMessage}
        >
          <SpamFields form={form} />
          {form.fields.map((field) => (
            <FieldInput key={field.handle} field={field} formId={formId} />
          ))}
          <p className="lintel-form__status" role="status" aria-live="polite" />
          <button type="submit" className="lintel-button">
            {form.submitLabel}
          </button>
        </form>
      ) : (
        <p className="lintel-form__hint">This form isn’t taking answers at the moment.</p>
      )}
    </div>
  );
});

const NewsletterSignup = drawsProps(
  newsletterSignupComponent,
  ({ props, attributes, node, mode, editableText }) => {
    const form = usePageData().forms?.[props.form];
    const site = useSite();
    const emailField = form?.fields.find((field) => field.type === "email")?.handle ?? "email";
    const inputId = `newsletter-${node.id}`;
    return (
      <section
        {...attributes}
        className={cx(attributes.className, "lintel-newsletter")}
        aria-labelledby={`${inputId}-title`}
      >
        <h2 id={`${inputId}-title`} className="lintel-newsletter__title" {...editableText("title")}>
          {props.title}
        </h2>
        {props.text && <p className="lintel-newsletter__text">{props.text}</p>}
        {form || mode === "canvas" ? (
          <form
            action={form ? formAction(site.apiBase, form.handle, mode) : undefined}
            method="post"
            className="lintel-newsletter__form"
            data-behaviour="form"
            data-confirmation={form?.confirmationMessage ?? ""}
          >
            {form && <SpamFields form={form} />}
            <label htmlFor={inputId} className="lintel-newsletter__label">
              {props.emailLabel}
            </label>
            <span className="lintel-newsletter__row">
              <input id={inputId} type="email" name={emailField} autoComplete="email" required />
              <button type="submit" className="lintel-button">
                {props.buttonLabel}
              </button>
            </span>
            <p className="lintel-form__error" data-error-for={emailField} hidden />
            <p className="lintel-form__status" role="status" aria-live="polite" />
          </form>
        ) : null}
      </section>
    );
  },
);

export const formRenders = { formEmbed: FormEmbed, newsletterSignup: NewsletterSignup };
