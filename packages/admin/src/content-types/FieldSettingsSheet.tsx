import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { isTitleField, type BlueprintDraftAction, type DraftField } from "./blueprintDraft.js";
import { blockTypesProblem } from "./blockTypesDraft.js";
import { FieldTypeOptions } from "./FieldTypeOptions.js";

interface FieldSettingsSheetProps {
  /** The field being edited; null closes the sheet. */
  field: DraftField | null;
  typeName: string;
  problem: string | undefined;
  dispatch: (action: BlueprintDraftAction) => void;
  onRemove: (field: DraftField) => void;
  onClose: () => void;
}

/**
 * A field's settings. Changes apply as you make them (there's no separate "Apply"), and
 * the content type is saved with the page's Save button, like a document.
 */
export function FieldSettingsSheet({
  field,
  typeName,
  problem,
  dispatch,
  onRemove,
  onClose,
}: FieldSettingsSheetProps) {
  if (!field) return null;
  const isTitle = isTitleField(field);
  const { key } = field;
  // A problem with the block types is shown above them, not under the label.
  const blocksProblem =
    field.type === "blocks" ? blockTypesProblem(field.options.blockTypes ?? []) : null;
  const labelProblem = problem === blocksProblem ? undefined : problem;

  return (
    <Dialog
      open
      onClose={onClose}
      title={field.label || t("builder.unnamedField")}
      description={typeName}
      footer={
        <>
          {!isTitle && (
            <Button variant="destructive" className="mr-auto" onClick={() => onRemove(field)}>
              {t("builder.remove")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.done")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pt-2 pb-1">
        <TextField
          label={t("builder.label")}
          value={field.label}
          error={labelProblem}
          data-autofocus
          onChange={(event) =>
            dispatch({ type: "fieldChanged", key, changes: { label: event.target.value } })
          }
        />
        <TextField
          label={t("builder.handle")}
          hint={
            isTitle
              ? t("builder.handleLocked")
              : field.isSaved
                ? t("builder.handleSavedHint")
                : t("builder.handleHint")
          }
          value={field.handle}
          disabled={isTitle}
          spellCheck={false}
          autoCapitalize="off"
          className="[&_input]:font-mono [&_input]:text-footnote"
          onChange={(event) => dispatch({ type: "handleEdited", key, handle: event.target.value })}
        />
        <TextField
          label={t("builder.helpText")}
          hint={t("builder.helpTextHint")}
          value={field.helpText ?? ""}
          onChange={(event) =>
            dispatch({ type: "fieldChanged", key, changes: { helpText: event.target.value } })
          }
        />
        <Toggle
          label={t("builder.required")}
          checked={isTitle || field.required}
          disabled={isTitle}
          onCheckedChange={(required) =>
            dispatch({ type: "fieldChanged", key, changes: { required } })
          }
        />
        <FieldTypeOptions
          field={field}
          problem={problem === blocksProblem ? (problem ?? undefined) : undefined}
          onChange={(options) => dispatch({ type: "fieldOptionsChanged", key, options })}
        />
      </div>
    </Dialog>
  );
}
