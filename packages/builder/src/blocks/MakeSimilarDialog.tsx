import type { ComponentFromSimilar } from "@lintel/builder-model";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { inputClassName } from "../ui/controls.js";

/**
 * "Make these one component", before anything changes: a name, then what each element keeps
 * of its own (each property, with what the first few show) so it's clear nothing typed is
 * lost. Making it is one step in Undo.
 */
export function MakeSimilarDialog({
  count,
  suggestedName,
  plan,
  onSubmit,
  onCancel,
}: {
  count: number;
  suggestedName: string;
  plan: ComponentFromSimilar;
  /** Resolves with a sentence when it couldn't be done, or null when it was. */
  onSubmit: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const text = useBuilderText();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const nameId = useId();
  const [name, setName] = useState(suggestedName);
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === "") {
      setProblem(text("pageBuilder.blocks.nameMissing"));
      return;
    }
    setSaving(true);
    setProblem(null);
    const failed = await onSubmit(name.trim());
    setSaving(false);
    if (failed) setProblem(failed);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-make-similar
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto max-h-[85dvh] w-[30rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card bg-surface-raised p-0 text-label shadow-float backdrop:bg-black/30"
    >
      <form onSubmit={(event) => void submit(event)} className="flex max-h-[85dvh] flex-col">
        <div className="hairline-bottom px-5 pt-5 pb-3">
          <h2 id={titleId} className="text-headline font-semibold">
            {text("pageBuilder.components.makeSimilar", { count })}
          </h2>
          <p className="mt-1 text-footnote text-label-secondary">
            {text("pageBuilder.components.similarIntro")}
          </p>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-auto px-5 py-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={nameId} className="text-caption text-label-secondary">
              {text("pageBuilder.blocks.name")}
            </label>
            <input
              id={nameId}
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              className={inputClassName}
            />
          </div>
          <section className="flex flex-col gap-2">
            <h3 className="text-footnote font-semibold text-label">
              {text("pageBuilder.components.similarParts")}
            </h3>
            {plan.parts.length === 0 ? (
              <p className="text-caption text-label-secondary">
                {text("pageBuilder.components.similarNoParts")}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {plan.parts.map((part) => (
                  <li key={part.handle} className="flex flex-col rounded-control bg-fill px-3 py-2">
                    <span className="text-caption font-medium text-label">{part.label}</span>
                    <span className="truncate text-caption text-label-secondary">
                      {part.shown.slice(0, 3).join(", ")}
                      {part.shown.length > 3 &&
                        ` ${text("pageBuilder.components.similarMore", { count: part.shown.length - 3 })}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {plan.sharedMotion.length > 0 && (
            <p className="text-caption text-label-secondary">
              {text("pageBuilder.components.similarMotion", {
                names: plan.sharedMotion.join(", "),
              })}
            </p>
          )}
          {plan.notKept.length > 0 && (
            <p className="text-caption text-warning">
              {text("pageBuilder.components.similarNotKept", { names: plan.notKept.join(", ") })}
            </p>
          )}
          <p className="text-caption text-label-tertiary">
            {text("pageBuilder.components.similarUndo")}
          </p>
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
            disabled={isSaving}
            className="h-8 rounded-control bg-accent-fill px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring disabled:opacity-50"
          >
            {isSaving ? text("pageBuilder.blocks.creating") : text("pageBuilder.blocks.create")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
