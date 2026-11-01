import {
  type BlockProperty,
  currentValues,
  type CustomBlock,
  instanceValues,
  type PageNode,
} from "@lintel/builder-model";
import { useEffect, useId, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ComponentIcon } from "../ui/component-icons.js";
import { inputClassName } from "../ui/controls.js";
import { useBuilderBlocks } from "./blocks-context.js";

/**
 * The right-hand side for an instance of one of the site's blocks: its name, its properties'
 * form (the app's field editors, so it is the same form editors know from content), and,
 * for people who may change blocks, **Edit block design**. **Detach from block** turns it
 * into ordinary elements after asking.
 */
export function BlockInstancePanel({
  node,
  isLocked,
  onChange,
  onDetach,
}: {
  node: PageNode;
  isLocked: boolean;
  onChange: (values: Record<string, unknown>, blockName: string) => void;
  onDetach: () => void;
}) {
  const text = useBuilderText();
  const blocks = useBuilderBlocks();
  const handle = String(node.props.block ?? "");
  const block = blocks.library.find((candidate) => candidate.handle === handle);
  const [isConfirmingDetach, setConfirmingDetach] = useState(false);

  if (!block) {
    return (
      <p role="note" className="px-4 py-6 text-footnote text-warning">
        {text("pageBuilder.blocks.missing")}
      </p>
    );
  }
  const values = currentValues(instanceValues(node), block.renamedProperties);
  const change = (next: Record<string, unknown>) => onChange(next, block.name);

  return (
    <div className="flex flex-col" data-block-instance={block.handle}>
      <div className="flex items-start gap-3 hairline-bottom px-4 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-fill text-accent">
          <ComponentIcon name={block.icon} className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-footnote font-semibold text-label">
            {text("pageBuilder.blocks.instanceOf", { name: block.name })}
          </h2>
          <p className="text-caption text-label-secondary">
            {text("pageBuilder.blocks.instanceHint")}
          </p>
          {block.source !== "site" && (
            <p className="text-caption font-medium text-label-secondary">
              {text(
                block.source === "code"
                  ? "pageBuilder.blocks.definedInCode"
                  : "pageBuilder.blocks.fromPlugin",
              )}
            </p>
          )}
        </div>
      </div>
      <fieldset disabled={isLocked} className="m-0 min-w-0 border-0 px-4 py-4">
        <legend className="sr-only">{text("pageBuilder.content.legend")}</legend>
        {isLocked && (
          <p className="pb-3 text-caption text-warning">{text("pageBuilder.style.lockedNote")}</p>
        )}
        {block.properties.length === 0 ? (
          <p className="text-footnote text-label-secondary">
            {text("pageBuilder.blocks.noProperties")}
          </p>
        ) : blocks.renderProperties ? (
          blocks.renderProperties({ block, values, onChange: change })
        ) : (
          <SimplePropertyForm block={block} values={values} onChange={change} />
        )}
      </fieldset>
      <div className="flex flex-col gap-2 hairline-top px-4 py-4">
        {blocks.canManage && block.source === "site" && blocks.editDesign && (
          <>
            <button
              type="button"
              onClick={() => blocks.editDesign?.(block.handle)}
              className="h-8 rounded-control bg-fill px-3 text-footnote font-medium text-accent hover:bg-fill-secondary focus-visible:focus-ring"
            >
              {text("pageBuilder.blocks.editDesign")}
            </button>
            <p className="text-caption text-label-tertiary">
              {text("pageBuilder.blocks.editDesignHint")}
            </p>
          </>
        )}
        {block.design && !isLocked && (
          <button
            type="button"
            onClick={() => setConfirmingDetach(true)}
            className="h-8 rounded-control px-3 text-footnote font-medium text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            {text("pageBuilder.blocks.detach")}
          </button>
        )}
      </div>
      {isConfirmingDetach && (
        <DetachConfirm
          blockName={block.name}
          onConfirm={() => {
            setConfirmingDetach(false);
            onDetach();
          }}
          onCancel={() => setConfirmingDetach(false)}
        />
      )}
    </div>
  );
}

/** Asks before detaching, since later changes to the block won't reach it any more. */
function DetachConfirm({
  blockName,
  onConfirm,
  onCancel,
}: {
  blockName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const text = useBuilderText();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
  }, []);
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[24rem] max-w-[calc(100vw-2rem)] rounded-card bg-surface-raised p-5 text-label shadow-float backdrop:bg-black/30"
    >
      <h2 id={titleId} className="text-headline font-semibold">
        {text("pageBuilder.blocks.detachTitle", { name: blockName })}
      </h2>
      <p id={messageId} className="mt-2 text-footnote text-label-secondary">
        {text("pageBuilder.blocks.detachMessage")}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          autoFocus
          className="h-8 rounded-control px-3 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
        >
          {text("pageBuilder.blocks.cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-8 rounded-control bg-danger px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring"
        >
          {text("pageBuilder.blocks.detachConfirm")}
        </button>
      </div>
    </dialog>
  );
}

/**
 * A plain form for when the app hasn't given its own: words, numbers and toggles. Anything
 * else (pictures, links, lists) says where it is changed.
 */
function SimplePropertyForm({
  block,
  values,
  onChange,
}: {
  block: CustomBlock;
  values: Readonly<Record<string, unknown>>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {block.properties.map((property) => (
        <SimpleProperty
          key={property.handle}
          property={property}
          value={values[property.handle]}
          onChange={(value) => onChange({ ...values, [property.handle]: value })}
        />
      ))}
    </div>
  );
}

function SimpleProperty({
  property,
  value,
  onChange,
}: {
  property: BlockProperty;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const text = useBuilderText();
  const id = useId();
  if (property.type === "toggle") {
    return (
      <label className="flex items-center gap-2 text-footnote text-label">
        <input
          type="checkbox"
          checked={
            value === undefined || value === null ? property.default !== false : value === true
          }
          onChange={(event) => onChange(event.target.checked)}
          className="size-4"
        />
        {property.label}
      </label>
    );
  }
  if (["text", "textarea", "email", "number", "markdown"].includes(property.type)) {
    const isLong = property.type === "textarea" || property.type === "markdown";
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-caption text-label-secondary">
          {property.label}
        </label>
        {isLong ? (
          <textarea
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            rows={3}
            className={`${inputClassName} h-auto py-1.5`}
          />
        ) : (
          <input
            id={id}
            type={property.type === "number" ? "number" : "text"}
            value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
            onChange={(event) =>
              onChange(
                property.type === "number"
                  ? event.target.value === ""
                    ? null
                    : Number(event.target.value)
                  : event.target.value,
              )
            }
            className={inputClassName}
          />
        )}
        {property.helpText && (
          <p className="text-caption text-label-tertiary">{property.helpText}</p>
        )}
      </div>
    );
  }
  return (
    <p className="text-caption text-label-secondary">
      {text("pageBuilder.blocks.propertyUnsupported", { label: property.label })}
    </p>
  );
}
