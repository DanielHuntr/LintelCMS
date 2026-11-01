import { useId, type ComponentType } from "react";
import type { FieldMessages } from "../api/client.js";
import { t } from "../i18n/strings.js";
import { ColourFieldEditor } from "./ColourFieldEditor.js";
import { BlocksFieldEditor } from "./blocks/BlocksFieldEditor.js";
import { DateFieldEditor } from "./DateFieldEditor.js";
import { EmailFieldEditor } from "./EmailFieldEditor.js";
import { EntriesFieldEditor } from "./EntriesFieldEditor.js";
import { ListFieldEditor } from "./ListFieldEditor.js";
import { MarkdownFieldEditor } from "./MarkdownFieldEditor.js";
import { TermsFieldEditor } from "./TermsFieldEditor.js";
import { UrlFieldEditor } from "./UrlFieldEditor.js";
import type { Field, FieldType, FieldValue } from "./field.types.js";
import type { FieldEditorProps, InnerFieldProps } from "./fieldEditorProps.js";
import { describedByIds, FieldShell, type FieldLabelling } from "./FieldShell.js";
import { ImageFieldEditor } from "./ImageFieldEditor.js";
import { LinkFieldEditor } from "./LinkFieldEditor.js";
import { NumberFieldEditor } from "./NumberFieldEditor.js";
import { RichTextFieldEditor } from "./RichTextFieldEditor.js";
import { SelectFieldEditor } from "./SelectFieldEditor.js";
import { TextareaFieldEditor } from "./TextareaFieldEditor.js";
import { TextFieldEditor } from "./TextFieldEditor.js";
import { ToggleFieldEditor } from "./ToggleFieldEditor.js";

interface FieldEditorRegistration {
  Editor: ComponentType<FieldEditorProps>;
  labelling: (field: Field) => FieldLabelling;
}

const labelAbove = () => "label" as const;

/**
 * Every fieldtype and the editor that edits it, in one visible list. A new fieldtype is
 * added here (and in core's list), never discovered by a naming convention.
 */
export const fieldEditors: Record<FieldType, FieldEditorRegistration> = {
  text: { Editor: TextFieldEditor, labelling: labelAbove },
  textarea: { Editor: TextareaFieldEditor, labelling: labelAbove },
  richText: { Editor: RichTextFieldEditor, labelling: labelAbove },
  number: { Editor: NumberFieldEditor, labelling: labelAbove },
  toggle: { Editor: ToggleFieldEditor, labelling: () => "inline" },
  select: {
    Editor: SelectFieldEditor,
    labelling: (field) => (field.options.multiple ? "group" : "label"),
  },
  date: { Editor: DateFieldEditor, labelling: labelAbove },
  image: { Editor: ImageFieldEditor, labelling: () => "group" },
  link: { Editor: LinkFieldEditor, labelling: () => "group" },
  email: { Editor: EmailFieldEditor, labelling: labelAbove },
  url: { Editor: UrlFieldEditor, labelling: labelAbove },
  colour: { Editor: ColourFieldEditor, labelling: labelAbove },
  markdown: { Editor: MarkdownFieldEditor, labelling: labelAbove },
  list: { Editor: ListFieldEditor, labelling: () => "group" },
  entries: { Editor: EntriesFieldEditor, labelling: () => "group" },
  terms: {
    Editor: TermsFieldEditor,
    labelling: (field) => (field.options.maxItems === 1 ? "label" : "group"),
  },
  blocks: { Editor: BlocksFieldEditor, labelling: () => "group" },
};

const noErrors: FieldMessages = {};

function renderInnerField(props: InnerFieldProps) {
  return <FieldEditor {...props} />;
}

interface FieldEditorComponentProps {
  field: Field;
  value: unknown;
  onChange: (handle: string, value: FieldValue) => void;
  /** The API's message for this field, if the last save rejected it. */
  error?: string;
  /** Messages for fields inside this one (blocks), keyed "<block id>.<inner handle>". */
  innerErrors?: FieldMessages;
}

/** One field of an entry: the right editor for its type, inside the shared label and messages. */
export function FieldEditor({
  field,
  value,
  onChange,
  error,
  innerErrors = noErrors,
}: FieldEditorComponentProps) {
  const baseId = useId();
  const ids = {
    controlId: `${baseId}-control`,
    labelId: `${baseId}-label`,
    helpId: `${baseId}-help`,
    errorId: `${baseId}-error`,
  };
  const registration = fieldEditors[field.type] as FieldEditorRegistration | undefined;

  // A plugin may add a fieldtype this admin doesn't know yet. Say so rather than break the page.
  if (!registration) {
    return (
      <div data-field-handle={field.handle} className="flex flex-col gap-1">
        <p className="text-footnote font-medium text-label">{field.label}</p>
        <p className="text-footnote text-label-secondary">{t("fields.unsupported")}</p>
      </div>
    );
  }

  const labelling = registration.labelling(field);
  const { Editor } = registration;

  return (
    <FieldShell field={field} labelling={labelling} error={error} value={value} {...ids}>
      <Editor
        field={field}
        value={value}
        onChange={(nextValue) => onChange(field.handle, nextValue)}
        controlId={ids.controlId}
        labelId={ids.labelId}
        // A fieldset already carries the description for everything inside it.
        describedBy={
          labelling === "group" ? undefined : describedByIds(field, error, ids.helpId, ids.errorId)
        }
        hasError={error !== undefined}
        innerErrors={innerErrors}
        renderField={renderInnerField}
      />
    </FieldShell>
  );
}
