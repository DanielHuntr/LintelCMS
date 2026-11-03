import {
  type ComponentCatalogue,
  findPropertyCandidates,
  type PageNode,
  type PropertyCandidate,
  type PropertyChoice,
} from "@lintel/builder-model";
import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames, inputClassName } from "../ui/controls.js";
import { ComponentIcon } from "../ui/component-icons.js";

/**
 * "Make into a block" and "Choose what editors can change": a name, an icon and a group for
 * Insert (when making one), then every part of the design that could be filled in by
 * editors (each heading's words, each picture, each link, showing or hiding an element, its
 * colours, a list of repeated cards), to tick and name the way editors will see them.
 */

export interface BlockDetails {
  name: string;
  icon: string;
  category: string;
  choices: PropertyChoice[];
}

interface MakeBlockDialogProps {
  mode: "create" | "map";
  design: PageNode;
  designName: string;
  catalogue: ComponentCatalogue;
  initialChoices?: readonly PropertyChoice[];
  /** Groups the site's blocks already use, offered as suggestions. */
  categories?: readonly string[];
  /** Resolves with a sentence when it couldn't be done, or null when it was. */
  onSubmit: (details: BlockDetails) => Promise<string | null>;
  onCancel: () => void;
}

export const blockIcons = [
  "users",
  "star",
  "heart",
  "megaphone",
  "briefcase",
  "calendar",
  "camera",
  "gift",
  "award",
  "sparkles",
  "lightbulb",
  "mail",
  "map-pin",
  "message-square-quote",
  "shopping-bag",
  "square",
] as const;

export function MakeBlockDialog({
  mode,
  design,
  designName,
  catalogue,
  initialChoices = [],
  categories = [],
  onSubmit,
  onCancel,
}: MakeBlockDialogProps) {
  const text = useBuilderText();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const categoriesId = useId();
  const candidates = useMemo(() => findPropertyCandidates(design, catalogue), [design, catalogue]);
  const [name, setName] = useState(mode === "create" ? designName : "");
  const [icon, setIcon] = useState<string>(blockIcons[0]);
  const [category, setCategory] = useState("");
  const [chosen, setChosen] = useState<ReadonlyMap<string, string>>(
    () => new Map(initialChoices.map((choice) => [choice.candidateId, choice.label])),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
  }, []);

  const toggle = (candidate: PropertyCandidate, on: boolean) =>
    setChosen((current) => {
      const next = new Map(current);
      if (on) next.set(candidate.id, candidate.suggestedLabel);
      else next.delete(candidate.id);
      return next;
    });
  const rename = (candidateId: string, label: string) =>
    setChosen((current) => new Map(current).set(candidateId, label));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "create" && name.trim() === "") {
      setProblem(text("pageBuilder.blocks.nameMissing"));
      return;
    }
    setSaving(true);
    setProblem(null);
    const choices = candidates.flatMap((candidate) => {
      const label = chosen.get(candidate.id);
      return label === undefined ? [] : [{ candidateId: candidate.id, label }];
    });
    const failed = await onSubmit({ name: name.trim(), icon, category: category.trim(), choices });
    setSaving(false);
    if (failed) setProblem(failed);
  };

  const byElement = groupByElement(candidates);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto max-h-[85dvh] w-[34rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card bg-surface-raised p-0 text-label shadow-float backdrop:bg-black/30"
    >
      <form onSubmit={(event) => void submit(event)} className="flex max-h-[85dvh] flex-col">
        <div className="hairline-bottom px-5 pt-5 pb-3">
          <h2 id={titleId} className="text-headline font-semibold">
            {mode === "create"
              ? text("pageBuilder.blocks.makeTitle", { name: designName })
              : text("pageBuilder.blocks.mapTitle")}
          </h2>
          {mode === "create" && (
            <p className="mt-1 text-footnote text-label-secondary">
              {text("pageBuilder.blocks.makeHint")}
            </p>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-5 py-4">
          {mode === "create" && (
            <>
              <Field label={text("pageBuilder.blocks.name")}>
                {(id) => (
                  <input
                    id={id}
                    value={name}
                    placeholder={text("pageBuilder.blocks.namePlaceholder")}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClassName}
                    autoFocus
                    required
                    maxLength={100}
                  />
                )}
              </Field>
              <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
                <legend className="mb-1 text-caption text-label-secondary">
                  {text("pageBuilder.blocks.icon")}
                </legend>
                <div className="flex flex-wrap gap-1">
                  {blockIcons.map((choice) => (
                    <label
                      key={choice}
                      title={choice}
                      className={classNames(
                        "flex size-8 cursor-pointer items-center justify-center rounded-control has-[:focus-visible]:focus-ring",
                        icon === choice
                          ? "bg-accent-fill text-on-accent"
                          : "bg-fill text-label-secondary",
                      )}
                    >
                      <input
                        type="radio"
                        name="block-icon"
                        value={choice}
                        checked={icon === choice}
                        onChange={() => setIcon(choice)}
                        className="sr-only"
                        aria-label={choice.replace(/-/g, " ")}
                      />
                      <ComponentIcon name={choice} className="size-4" />
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field
                label={text("pageBuilder.blocks.category")}
                hint={text("pageBuilder.blocks.categoryHint")}
              >
                {(id) => (
                  <>
                    <input
                      id={id}
                      value={category}
                      list={categoriesId}
                      placeholder={text("pageBuilder.blocks.categoryPlaceholder")}
                      onChange={(event) => setCategory(event.target.value)}
                      className={inputClassName}
                      maxLength={60}
                    />
                    <datalist id={categoriesId}>
                      {categories.map((existing) => (
                        <option key={existing} value={existing} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
            </>
          )}
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" data-block-parts>
            <legend className="text-footnote font-semibold">
              {text("pageBuilder.blocks.parts")}
            </legend>
            <p className="text-caption text-label-secondary">
              {text("pageBuilder.blocks.partsHint")}
            </p>
            {candidates.length === 0 && (
              <p className="text-footnote text-label-secondary">
                {text("pageBuilder.blocks.noParts")}
              </p>
            )}
            {byElement.map(([elementName, parts]) => (
              <div
                key={parts[0]?.nodeId}
                className="flex flex-col gap-1 rounded-control bg-fill/60 p-2"
              >
                <p className="text-caption font-medium text-label-secondary">{elementName}</p>
                {parts.map((candidate) => (
                  <CandidateRow
                    key={candidate.id}
                    candidate={candidate}
                    label={chosen.get(candidate.id)}
                    onToggle={(on) => toggle(candidate, on)}
                    onRename={(label) => rename(candidate.id, label)}
                  />
                ))}
              </div>
            ))}
          </fieldset>
        </div>
        <div className="flex items-center justify-end gap-2 hairline-top px-5 py-3">
          {problem && (
            <p role="alert" className="me-auto text-footnote text-danger">
              {problem}
            </p>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-control px-3 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
          >
            {text("pageBuilder.blocks.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="h-8 rounded-control bg-accent-fill px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring disabled:opacity-50"
          >
            {isSaving
              ? text("pageBuilder.blocks.creating")
              : mode === "create"
                ? text("pageBuilder.blocks.create")
                : text("pageBuilder.blocks.saveMapping")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function CandidateRow({
  candidate,
  label,
  onToggle,
  onRename,
}: {
  candidate: PropertyCandidate;
  label: string | undefined;
  onToggle: (on: boolean) => void;
  onRename: (label: string) => void;
}) {
  const text = useBuilderText();
  const checkboxId = useId();
  const labelId = useId();
  const isOn = label !== undefined;
  const now =
    candidate.kind === "items"
      ? text("pageBuilder.blocks.listNow", { count: candidate.currentValue })
      : candidate.currentValue
        ? text("pageBuilder.blocks.partNow", { value: shorten(candidate.currentValue) })
        : "";
  return (
    <div className="flex flex-col gap-1" data-candidate={candidate.id}>
      <div className="flex items-start gap-2">
        <input
          id={checkboxId}
          type="checkbox"
          checked={isOn}
          onChange={(event) => onToggle(event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <label htmlFor={checkboxId} className="flex min-w-0 flex-col text-footnote">
          <span>{text(`pageBuilder.blocks.kind.${candidate.kind}`)}</span>
          {now && <span className="truncate text-caption text-label-tertiary">{now}</span>}
        </label>
      </div>
      {isOn && (
        <div className="ms-6 flex flex-col gap-0.5">
          <label htmlFor={labelId} className="text-caption text-label-secondary">
            {text("pageBuilder.blocks.partLabel")}
          </label>
          <input
            id={labelId}
            value={label}
            onChange={(event) => onRename(event.target.value)}
            className={inputClassName}
            maxLength={100}
          />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-caption text-label-secondary">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-caption text-label-tertiary">{hint}</p>}
    </div>
  );
}

function groupByElement(
  candidates: readonly PropertyCandidate[],
): Array<[string, PropertyCandidate[]]> {
  const groups = new Map<string, { name: string; parts: PropertyCandidate[] }>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.nodeId) ?? { name: candidate.elementName, parts: [] };
    group.parts.push(candidate);
    groups.set(candidate.nodeId, group);
  }
  return [...groups.values()].map((group) => [group.name, group.parts]);
}

function shorten(value: string): string {
  return value.length > 48 ? `${value.slice(0, 47)}…` : value;
}
