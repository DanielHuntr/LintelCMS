import { t } from "../i18n/strings.js";
import { isTitleField, type BlueprintDraftAction, type DraftField } from "./blueprintDraft.js";
import { blockTypesProblem } from "./blockTypesDraft.js";
import { FieldSettingsDialog } from "./FieldSettingsDialog.js";

interface FieldSettingsSheetProps {
  /** The field being edited; null closes the sheet. */
  field: DraftField | null;
  typeName: string;
  /** Every field of the content type (or global set), for conditions. */
  fields: readonly DraftField[];
  problem: string | undefined;
  /** Only a content type's own fields can be columns in its list of entries. */
  canShowInList?: boolean;
  dispatch: (action: BlueprintDraftAction) => void;
  onRemove: (field: DraftField) => void;
  onClose: () => void;
}

/**
 * The settings of one of a content type's own fields: the shared settings dialog, wired to
 * the builder's state. Changes apply as you make them (there's no separate "Apply"), and the
 * content type is saved with the page's Save button, like a document.
 */
export function FieldSettingsSheet({
  field,
  typeName,
  fields,
  problem,
  canShowInList = true,
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

  return (
    <FieldSettingsDialog
      field={field}
      typeName={typeName}
      siblings={fields}
      problem={problem === blocksProblem ? undefined : problem}
      handleHint={
        isTitle
          ? t("builder.handleLocked")
          : field.isSaved
            ? t("builder.handleSavedHint")
            : t("builder.handleHint")
      }
      isHandleLocked={isTitle}
      isRequiredLocked={isTitle}
      canShowInList={canShowInList && !isTitle}
      isSaved={field.isSaved}
      onChange={(changes) => dispatch({ type: "fieldChanged", key, changes })}
      onOptionsChange={(options) => dispatch({ type: "fieldOptionsChanged", key, options })}
      onHandleChange={(handle) => dispatch({ type: "handleEdited", key, handle })}
      onRemove={isTitle ? undefined : () => onRemove(field)}
      onClose={onClose}
    />
  );
}
