import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { TextField } from "../design/TextField.js";
import type { BlockType, Field, FieldType } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { useFieldtypes } from "./blueprints.queries.js";
import {
  addBlockType,
  addInnerField,
  canGoInBlock,
  changeBlockType,
  changeInnerField,
  changeInnerFields,
  moveBlockType,
  moveInnerField,
  removeBlockType,
  removeInnerField,
} from "./blockTypesDraft.js";
import { cleanTypedHandle } from "./handle.js";
import { FieldTypeOptions } from "./FieldTypeOptions.js";

interface BlockTypesEditorProps {
  blockTypes: readonly BlockType[];
  onChange: (blockTypes: BlockType[]) => void;
  problem: string | undefined;
}

let nextKey = 0;
function newKey(prefix: string): string {
  nextKey += 1;
  return `${prefix}-${nextKey}`;
}

/**
 * The block types of a blocks field, in the field's settings: each with a name, an optional
 * description and its own list of fields. Kept to plain inputs and buttons, so it works by
 * keyboard without any dragging.
 */
export function BlockTypesEditor({ blockTypes, onChange, problem }: BlockTypesEditorProps) {
  const titleId = useId();
  return (
    <section className="flex flex-col gap-3" aria-labelledby={titleId}>
      <div>
        <h3 id={titleId} className="text-footnote font-medium text-label">
          {t("builder.blocks.title")}
        </h3>
        <p className="text-footnote text-label-secondary">{t("builder.blocks.hint")}</p>
        {problem && <p className="mt-1 text-footnote font-medium text-danger">{problem}</p>}
      </div>

      <ol className="flex flex-col gap-3">
        {blockTypes.map((blockType, index) => {
          const key = blockType.draft?.key ?? blockType.handle;
          return (
            <BlockTypeCard
              key={key}
              blockType={blockType}
              isFirst={index === 0}
              isLast={index === blockTypes.length - 1}
              onChange={(changes) => onChange(changeBlockType(blockTypes, key, changes))}
              onFieldsChange={(change) => onChange(changeInnerFields(blockTypes, key, change))}
              onMove={(direction) => onChange(moveBlockType(blockTypes, key, direction))}
              onRemove={() => onChange(removeBlockType(blockTypes, key))}
            />
          );
        })}
      </ol>

      <Button
        variant="tinted"
        size="small"
        icon={<Plus aria-hidden="true" />}
        className="self-start"
        onClick={() => onChange(addBlockType(blockTypes, newKey("block")))}
      >
        {t("builder.blocks.add")}
      </Button>
    </section>
  );
}

interface BlockTypeCardProps {
  blockType: BlockType;
  isFirst: boolean;
  isLast: boolean;
  onChange: (changes: Partial<Pick<BlockType, "name" | "description" | "handle">>) => void;
  onFieldsChange: (change: (fields: Field[]) => Field[]) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

function BlockTypeCard({
  blockType,
  isFirst,
  isLast,
  onChange,
  onFieldsChange,
  onMove,
  onRemove,
}: BlockTypeCardProps) {
  const fieldtypes = useFieldtypes();
  const name = blockType.name.trim() || t("builder.blocks.untitled");
  const allowedTypes = (fieldtypes.data ?? []).filter((fieldtype) => canGoInBlock(fieldtype.type));

  return (
    <li className="flex flex-col gap-3 rounded-card bg-background p-3 hairline-ring">
      <div className="flex items-start gap-2">
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_10rem] gap-2">
          <TextField
            label={t("builder.blocks.name")}
            value={blockType.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
          <TextField
            label={t("builder.blocks.handle")}
            value={blockType.handle}
            spellCheck={false}
            autoCapitalize="off"
            className="[&_input]:font-mono [&_input]:text-footnote"
            onChange={(event) => onChange({ handle: cleanTypedHandle(event.target.value) })}
          />
        </div>
        <div className="mt-6 flex shrink-0 items-center">
          <SmallButton
            label={t("builder.blocks.moveUp", { name })}
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />
          </SmallButton>
          <SmallButton
            label={t("builder.blocks.moveDown", { name })}
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4" />
          </SmallButton>
          <SmallButton
            label={t("builder.blocks.remove", { name })}
            disabled={false}
            onClick={onRemove}
          >
            <X aria-hidden="true" strokeWidth={2} className="size-4" />
          </SmallButton>
        </div>
      </div>
      <TextField
        label={t("builder.blocks.description")}
        hint={t("builder.blocks.descriptionHint")}
        value={blockType.description ?? ""}
        onChange={(event) => onChange({ description: event.target.value })}
      />

      <div className="flex flex-col gap-2">
        <p className="text-footnote font-medium text-label">
          {t("builder.blocks.fields", { name })}
        </p>
        {blockType.fields.length === 0 && (
          <p className="text-footnote text-label-secondary">{t("builder.blocks.noFields")}</p>
        )}
        <ol className="flex flex-col gap-2">
          {blockType.fields.map((field, index) => (
            <InnerFieldRow
              key={field.draft?.key ?? field.handle}
              field={field}
              number={index + 1}
              blockName={name}
              isFirst={index === 0}
              isLast={index === blockType.fields.length - 1}
              allowedTypes={allowedTypes}
              onFieldsChange={onFieldsChange}
            />
          ))}
        </ol>
        <div className="relative max-w-56">
          <select
            aria-label={t("builder.blocks.addField")}
            value=""
            onChange={(event) => {
              const picked = allowedTypes.find(
                (fieldtype) => fieldtype.type === event.target.value,
              );
              if (picked) {
                onFieldsChange((fields) =>
                  addInnerField(fields, newKey("field"), picked.type, picked.name),
                );
              }
            }}
            className={classNames("h-8 appearance-none pe-8 text-footnote", controlClasses())}
          >
            <option value="" disabled>
              {t("builder.blocks.addField")}
            </option>
            {allowedTypes.map((fieldtype) => (
              <option key={fieldtype.type} value={fieldtype.type}>
                {fieldtype.name}
              </option>
            ))}
          </select>
          <Plus
            aria-hidden="true"
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 inset-e-2.5 size-3.5 -translate-y-1/2 text-label-secondary"
          />
        </div>
      </div>
    </li>
  );
}

interface InnerFieldRowProps {
  field: Field;
  number: number;
  blockName: string;
  isFirst: boolean;
  isLast: boolean;
  allowedTypes: ReadonlyArray<{ type: FieldType; name: string }>;
  onFieldsChange: (change: (fields: Field[]) => Field[]) => void;
}

function InnerFieldRow({
  field,
  number,
  blockName,
  isFirst,
  isLast,
  allowedTypes,
  onFieldsChange,
}: InnerFieldRowProps) {
  const key = field.draft?.key ?? field.handle;
  const fieldName = field.label.trim() || String(number);
  const change = (changes: Partial<Pick<Field, "label" | "required" | "options">>) =>
    onFieldsChange((fields) => changeInnerField(fields, key, changes));

  return (
    <li className="flex flex-col gap-2 rounded-control bg-surface p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
        <input
          aria-label={t("builder.blocks.fieldLabel", { number, name: blockName })}
          value={field.label}
          onChange={(event) => change({ label: event.target.value })}
          className={classNames("h-8 text-footnote", controlClasses())}
        />
        <select
          aria-label={t("builder.blocks.fieldType", { number, name: blockName })}
          value={field.type}
          onChange={(event) => {
            const type = event.target.value as FieldType;
            onFieldsChange((fields) =>
              fields.map((candidate) =>
                candidate.draft?.key === key
                  ? {
                      ...candidate,
                      type,
                      options: type === "select" ? { choices: [], multiple: false } : {},
                    }
                  : candidate,
              ),
            );
          }}
          className={classNames("h-8 text-footnote", controlClasses())}
        >
          {allowedTypes.map((fieldtype) => (
            <option key={fieldtype.type} value={fieldtype.type}>
              {fieldtype.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-footnote text-label">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(event) => change({ required: event.target.checked })}
            className="size-4 accent-accent-fill"
          />
          {t("builder.blocks.fieldRequired")}
        </label>
        <span className="ms-auto flex items-center">
          <SmallButton
            label={t("builder.blocks.moveUp", { name: fieldName })}
            disabled={isFirst}
            onClick={() => onFieldsChange((fields) => moveInnerField(fields, key, -1))}
          >
            <ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />
          </SmallButton>
          <SmallButton
            label={t("builder.blocks.moveDown", { name: fieldName })}
            disabled={isLast}
            onClick={() => onFieldsChange((fields) => moveInnerField(fields, key, 1))}
          >
            <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4" />
          </SmallButton>
          <SmallButton
            label={t("builder.blocks.remove", { name: fieldName })}
            disabled={false}
            onClick={() => onFieldsChange((fields) => removeInnerField(fields, key))}
          >
            <X aria-hidden="true" strokeWidth={2} className="size-4" />
          </SmallButton>
        </span>
      </div>
      {field.type === "select" && (
        <FieldTypeOptions
          field={{ ...field, key, handleIsCustom: true, isSaved: false }}
          onChange={(options) => change({ options })}
        />
      )}
    </li>
  );
}

function SmallButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className="flex size-7 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-30"
    >
      {children}
    </button>
  );
}
