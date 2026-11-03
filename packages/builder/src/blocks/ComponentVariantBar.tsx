import {
  type ComponentVariants,
  editTarget,
  handleFromLabel,
  type VariantProperty,
  withoutUnknownLooks,
} from "@lintel/builder-model";
import { Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { inputClassName } from "../ui/controls.js";
import type { BlockMaster } from "./blocks-context.js";
import { VariantChoices } from "./VariantChoices.js";

/**
 * Over the canvas while designing a component: which variant is shown, and where changes go
 * ("Changes go to Small · Outline", or to every variant with each at its default). With no
 * variants yet, just **Add variants**. **Edit variants** names them and their choices.
 */
export function ComponentVariantBar({ master }: { master: BlockMaster }) {
  const text = useBuilderText();
  const [isEditing, setEditing] = useState(false);
  const { variants, onSelectionChange, onVariantsChange } = master;
  if (!variants || !onSelectionChange || !onVariantsChange || master.isReadOnly) return null;
  const selection = master.selection ?? {};
  const target = editTarget(variants, selection);
  const targetName = variants.properties
    .flatMap((property) => {
      const value = target[property.handle];
      const option = property.options.find((each) => each.value === value);
      return option ? [option.label] : [];
    })
    .join(" · ");
  const hasVariants = variants.properties.length > 0;

  return (
    <div
      role="group"
      aria-label={text("pageBuilder.components.switcherLabel")}
      data-variant-bar
      className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 hairline-bottom bg-surface px-3 py-1.5"
    >
      {hasVariants && (
        <>
          <VariantChoices
            inline
            variants={variants}
            selection={selection}
            onChange={onSelectionChange}
          />
          <p role="status" className="text-caption text-label-tertiary">
            {targetName
              ? text("pageBuilder.components.changesGoTo", { target: targetName })
              : text("pageBuilder.components.changesGoToAll")}
          </p>
        </>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="ms-auto flex h-7 items-center gap-1.5 rounded-control px-2 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
      >
        <SlidersHorizontal aria-hidden="true" className="size-3.5" />
        {text(
          hasVariants
            ? "pageBuilder.components.editVariants"
            : "pageBuilder.components.addVariants",
        )}
      </button>
      {isEditing && (
        <VariantsDialog
          name={master.block.name}
          variants={variants}
          onCancel={() => setEditing(false)}
          onDone={(next) => {
            onVariantsChange(next);
            onSelectionChange({});
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

interface VariantRow {
  key: string;
  /** The handle it was saved with, kept so its looks stay with it. */
  handle?: string;
  name: string;
  choices: string;
}

function rowsOf(variants: ComponentVariants): VariantRow[] {
  return variants.properties.map((property) => ({
    key: property.handle,
    handle: property.handle,
    name: property.label,
    choices: [
      ...property.options.filter((option) => option.value === property.default),
      ...property.options.filter((option) => option.value !== property.default),
    ]
      .map((option) => option.label)
      .join(", "),
  }));
}

/**
 * The variants as typed: each a name and its choices separated by commas, the first being
 * where it starts. Choices keep the values they had (matched by name), so their looks stay.
 */
export function variantsFromRows(
  rows: readonly VariantRow[],
  previous: ComponentVariants,
  clientsMayChoose: boolean,
): ComponentVariants | { problem: "name" | "choices"; name: string } {
  const takenHandles = new Set<string>(rows.flatMap((row) => (row.handle ? [row.handle] : [])));
  const properties: VariantProperty[] = [];
  for (const row of rows) {
    const name = row.name.trim();
    if (name === "") return { problem: "name", name };
    const labels = [
      ...new Set(
        row.choices
          .split(",")
          .map((choice) => choice.trim())
          .filter(Boolean),
      ),
    ];
    if (labels.length < 2) return { problem: "choices", name };
    const before = previous.properties.find((property) => property.handle === row.handle);
    let handle = row.handle;
    if (!handle) {
      handle = handleFromLabel(name, takenHandles);
      takenHandles.add(handle);
    }
    const takenValues = new Set<string>();
    const options = labels.map((label) => {
      const kept = before?.options.find(
        (option) => option.label.toLowerCase() === label.toLowerCase(),
      );
      const value =
        kept && !takenValues.has(kept.value) ? kept.value : handleFromLabel(label, takenValues);
      takenValues.add(value);
      return { value, label };
    });
    properties.push({
      handle,
      label: name,
      options,
      default: options[0]?.value ?? "",
    });
  }
  return withoutUnknownLooks({ properties, looks: previous.looks, clientsMayChoose });
}

function VariantsDialog({
  name,
  variants,
  onCancel,
  onDone,
}: {
  name: string;
  variants: ComponentVariants;
  onCancel: () => void;
  onDone: (variants: ComponentVariants) => void;
}) {
  const text = useBuilderText();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const clientsId = useId();
  const [rows, setRows] = useState<VariantRow[]>(() =>
    variants.properties.length > 0 ? rowsOf(variants) : [{ key: "new-0", name: "", choices: "" }],
  );
  const [clientsMayChoose, setClientsMayChoose] = useState(variants.clientsMayChoose);
  const [problem, setProblem] = useState<string | null>(null);
  const counter = useRef(1);

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
  }, []);

  const change = (key: string, update: Partial<VariantRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...update } : row)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const filled = rows.filter((row) => row.name.trim() !== "" || row.choices.trim() !== "");
    const result = variantsFromRows(filled, variants, clientsMayChoose);
    if ("problem" in result) {
      setProblem(
        result.problem === "name"
          ? text("pageBuilder.components.variantNeedsName")
          : text("pageBuilder.components.variantNeedsChoices", { name: result.name }),
      );
      return;
    }
    onDone(result);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-variants-dialog
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto max-h-[85dvh] w-[32rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card bg-surface-raised p-0 text-label shadow-float backdrop:bg-black/30"
    >
      <form onSubmit={submit} className="flex max-h-[85dvh] flex-col">
        <div className="hairline-bottom px-5 pt-5 pb-3">
          <h2 id={titleId} className="text-headline font-semibold">
            {text("pageBuilder.components.variantsTitle", { name })}
          </h2>
          <p className="mt-1 text-footnote text-label-secondary">
            {text("pageBuilder.components.variantsIntro")}
          </p>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-auto px-5 py-4">
          {rows.map((row, index) => (
            <fieldset
              key={row.key}
              className="m-0 grid min-w-0 grid-cols-[8rem_1fr_auto] items-end gap-2 border-0 p-0"
            >
              <legend className="sr-only">{row.name || `${index + 1}`}</legend>
              <label className="flex flex-col gap-1 text-caption text-label-secondary">
                {text("pageBuilder.components.variantName")}
                <input
                  value={row.name}
                  autoFocus={index === 0}
                  placeholder={text("pageBuilder.components.variantNamePlaceholder")}
                  onChange={(event) => change(row.key, { name: event.target.value })}
                  className={inputClassName}
                />
              </label>
              <label className="flex flex-col gap-1 text-caption text-label-secondary">
                {text("pageBuilder.components.variantChoices")}
                <input
                  value={row.choices}
                  placeholder={text("pageBuilder.components.variantChoicesPlaceholder")}
                  onChange={(event) => change(row.key, { choices: event.target.value })}
                  className={inputClassName}
                />
              </label>
              <button
                type="button"
                aria-label={text("pageBuilder.components.removeVariant", {
                  name: row.name || `${index + 1}`,
                })}
                onClick={() => setRows((current) => current.filter((each) => each.key !== row.key))}
                className="flex size-8 items-center justify-center rounded-control text-label-secondary hover:bg-fill hover:text-danger focus-visible:focus-ring"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </fieldset>
          ))}
          <p className="text-caption text-label-tertiary">
            {text("pageBuilder.components.variantChoicesHint")}
          </p>
          <button
            type="button"
            onClick={() => {
              const key = `new-${counter.current++}`;
              setRows((current) => [...current, { key, name: "", choices: "" }]);
            }}
            className="flex h-8 items-center gap-1.5 self-start rounded-control px-2 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
          >
            <Plus aria-hidden="true" className="size-4" />
            {text("pageBuilder.components.addVariant")}
          </button>
          <label htmlFor={clientsId} className="flex items-center gap-2 text-footnote text-label">
            <input
              id={clientsId}
              type="checkbox"
              checked={clientsMayChoose}
              onChange={(event) => setClientsMayChoose(event.target.checked)}
              className="size-4"
            />
            {text("pageBuilder.components.clientsMayChoose")}
          </label>
          {variants.looks.length > 0 && (
            <p className="text-caption text-label-tertiary">
              {text("pageBuilder.components.variantsLostLooks")}
            </p>
          )}
          {problem && (
            <p role="alert" className="text-caption text-danger">
              {problem}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 hairline-top px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-control px-3 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
          >
            {text("pageBuilder.blocks.cancel")}
          </button>
          <button
            type="submit"
            className="h-8 rounded-control bg-accent-fill px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring"
          >
            {text("pageBuilder.components.variantsDone")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
