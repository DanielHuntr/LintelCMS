import { type DraftPlan, type DraftSectionKind, draftSectionKinds } from "@lintel/builder-model";
import { X } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames, inputClassName } from "../ui/controls.js";
import { keepFocusInside, useReturnFocus } from "../ui/focus-trap.js";
import { type DraftTone, draftTones, type PageDrafting } from "./page-drafting.js";

interface DraftPageDialogProps {
  drafting: PageDrafting;
  returnFocusTo: RefObject<HTMLElement | null>;
  /** Called with the finished plan; the dialog has closed by then. */
  onDrafted: (plan: DraftPlan) => void;
  onClose: (message?: string) => void;
}

/** The sections a new draft starts with: a sensible home page. */
const startingSections: DraftSectionKind[] = ["welcome", "features", "story", "call-to-action"];

/**
 * "Draft a page for me": a short form (what the page is for, who it's for, a tone and roughly
 * which sections), then a progress bar with Stop while the model on the server writes. The
 * plan goes back to the builder, which adds it as ordinary sections; nothing is published.
 */
export function DraftPageDialog({
  drafting,
  returnFocusTo,
  onDrafted,
  onClose,
}: DraftPageDialogProps) {
  const text = useBuilderText();
  const ids = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLTextAreaElement>(null);
  const [purpose, setPurpose] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<DraftTone>("friendly");
  const [sections, setSections] = useState<DraftSectionKind[]>(startingSections);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const stopper = useRef<AbortController | null>(null);
  useReturnFocus(true, returnFocusTo);
  useEffect(() => firstField.current?.focus(), []);
  useEffect(() => () => stopper.current?.abort(), []);

  const isWriting = progress !== null;

  const close = (message?: string) => {
    stopper.current?.abort();
    onClose(message);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(isWriting ? text("pageBuilder.draft.stopped") : undefined);
      return;
    }
    keepFocusInside(dialog.current, event);
  };

  const toggleSection = (kind: DraftSectionKind) =>
    setSections((chosen) =>
      chosen.includes(kind)
        ? chosen.filter((item) => item !== kind)
        : draftSectionKinds.filter((item) => item === kind || chosen.includes(item)),
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (purpose.trim().length < 3) return;
    const controller = new AbortController();
    stopper.current = controller;
    setProblem(null);
    setProgress(0);
    try {
      const plan = await drafting.draftPage(
        { purpose, audience, tone, sections },
        { signal: controller.signal, onProgress: setProgress },
      );
      if (!controller.signal.aborted) onDrafted(plan);
    } catch (error) {
      if (controller.signal.aborted) return;
      setProblem(error instanceof Error ? error.message : String(error));
      setProgress(null);
    }
  }

  const titleId = `${ids}-title`;
  const fieldClassName = classNames(inputClassName, "h-9 text-body");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-scrim p-6">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="flex max-h-full w-full max-w-lg flex-col rounded-panel bg-surface-raised text-start text-label shadow-float hairline-ring"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-headline">
              {text("pageBuilder.draft.title")}
            </h2>
            <p className="text-footnote text-label-secondary">
              {text("pageBuilder.draft.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => close(isWriting ? text("pageBuilder.draft.stopped") : undefined)}
            aria-label={text("pageBuilder.draft.close")}
            className="-me-1 flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        {!drafting.isReady ? (
          <p className="px-5 pb-5 text-body text-label-secondary">
            {text("pageBuilder.draft.notReady")}
          </p>
        ) : isWriting ? (
          <div className="flex flex-col gap-3 px-5 pt-2 pb-5" aria-live="polite">
            <p className="text-body font-semibold">{text("pageBuilder.draft.writing")}</p>
            <div
              role="progressbar"
              aria-label={text("pageBuilder.draft.progress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              className="h-1.5 overflow-hidden rounded-full bg-fill"
            >
              <div
                className="h-full rounded-full bg-accent-fill transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
              />
            </div>
            <p className="text-footnote text-label-secondary">
              {text("pageBuilder.draft.timeNote")}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => close(text("pageBuilder.draft.stopped"))}
                className="h-8 rounded-control bg-fill px-4 text-footnote font-semibold text-label hover:bg-fill-strong focus-visible:focus-ring"
              >
                {text("pageBuilder.draft.stop")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-col">
            <div className="flex min-h-0 flex-col gap-4 overflow-auto px-5 pt-1 pb-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={`${ids}-purpose`} className="text-footnote font-medium">
                  {text("pageBuilder.draft.purpose")}
                </label>
                <textarea
                  ref={firstField}
                  id={`${ids}-purpose`}
                  required
                  minLength={3}
                  maxLength={600}
                  rows={3}
                  value={purpose}
                  placeholder={text("pageBuilder.draft.purposePlaceholder")}
                  onChange={(event) => setPurpose(event.target.value)}
                  className={classNames(inputClassName, "h-auto py-2 text-body")}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${ids}-audience`} className="text-footnote font-medium">
                    {text("pageBuilder.draft.audience")}
                  </label>
                  <input
                    id={`${ids}-audience`}
                    maxLength={200}
                    value={audience}
                    placeholder={text("pageBuilder.draft.audiencePlaceholder")}
                    onChange={(event) => setAudience(event.target.value)}
                    className={fieldClassName}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${ids}-tone`} className="text-footnote font-medium">
                    {text("pageBuilder.draft.tone")}
                  </label>
                  <select
                    id={`${ids}-tone`}
                    value={tone}
                    onChange={(event) => setTone(event.target.value as DraftTone)}
                    className={fieldClassName}
                  >
                    {draftTones.map((choice) => (
                      <option key={choice} value={choice}>
                        {text(`pageBuilder.draft.tone.${choice}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-footnote font-medium">
                  {text("pageBuilder.draft.sections")}
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {draftSectionKinds.map((kind) => {
                    const isChosen = sections.includes(kind);
                    return (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={isChosen}
                        onClick={() => toggleSection(kind)}
                        className={classNames(
                          "h-7 rounded-full px-3 text-footnote focus-visible:focus-ring",
                          isChosen
                            ? "bg-accent-fill text-on-accent"
                            : "bg-fill text-label hover:bg-fill-strong",
                        )}
                      >
                        {text(`pageBuilder.draft.section.${kind}`)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-caption text-label-tertiary">
                  {text("pageBuilder.draft.sectionsHint")}
                </p>
              </fieldset>
              {problem && (
                <p role="alert" className="text-footnote text-danger">
                  {problem}
                </p>
              )}
              <p className="text-caption text-label-secondary">
                {text("pageBuilder.draft.timeNote")} {text("pageBuilder.draft.checkNote")}
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 pt-3 pb-5 hairline-top">
              <button
                type="button"
                onClick={() => close()}
                className="h-8 rounded-control px-4 text-footnote font-semibold text-accent hover:bg-fill focus-visible:focus-ring"
              >
                {text("pageBuilder.draft.cancel")}
              </button>
              <button
                type="submit"
                className="h-8 rounded-control bg-accent-fill px-4 text-footnote font-semibold text-on-accent focus-visible:focus-ring"
              >
                {text("pageBuilder.draft.start")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
