import {
  cleanProps,
  customShaderDefinition,
  customShaderLimits,
  readCustomShader,
  type ShaderProblem,
} from "@lintel/motion/effects";
import { createShaderPreview, type ShaderPreview } from "@lintel/motion/shader-preview";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TextInput } from "../controls/Field.js";
import { EffectSettings } from "../effects/EffectSettings.js";
import { useTranslate } from "../strings/translate.js";
import { starterShader, type ShaderInLibrary, type ShaderLibrary } from "./shader-library.js";

const newShaderId = () => `s${Math.random().toString(36).slice(2, 10)}`;

/**
 * Where a developer writes a shader: the code, a live preview, plain messages that name the
 * line, and the controls its comments make, working as non-technical people will see them.
 * Nothing can be saved until it compiles here. The server checks the code again.
 */
export function ShaderCodeBox({
  shader,
  library,
  onClose,
  onSaved,
}: {
  shader?: ShaderInLibrary;
  library: ShaderLibrary;
  onClose: () => void;
  onSaved: (shader: ShaderInLibrary, isNew: boolean) => void;
}) {
  const t = useTranslate();
  const titleId = useId();
  const [code, setCode] = useState(shader?.code ?? starterShader);
  const [name, setName] = useState(shader?.name ?? "");
  const [problems, setProblems] = useState<ShaderProblem[]>([]);
  const [noPreview, setNoPreview] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<string>();
  const [values, setValues] = useState<Record<string, number | string | boolean>>({});
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<ShaderPreview | undefined>(undefined);
  const gutter = useRef<HTMLDivElement>(null);

  const read = useMemo(() => readCustomShader(code), [code]);
  const definition = useMemo(
    () => customShaderDefinition(name || read.name || "Shader", read),
    [name, read],
  );
  const shownName = name || read.name || "";

  useEffect(() => {
    if (!library.allowed || !canvas.current) return;
    const made = createShaderPreview(canvas.current, () => setStopped(true));
    if (!made) setNoPreview(true);
    preview.current = made;
    return () => {
      made?.destroy();
      preview.current = undefined;
    };
  }, [library.allowed, stopped]);

  // Waits for a pause in typing, so the card isn't asked to compile every key press.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (preview.current) setProblems(preview.current.show(code));
      else setProblems(read.problems);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [code, read, stopped]);

  useEffect(() => preview.current?.setValues(values), [values]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  const lines = code.split("\n").length;
  const badLines = new Set(problems.map((problem) => problem.line));
  const canSave = problems.length === 0 && read.problems.length === 0 && shownName !== "";

  async function save() {
    setSaving(true);
    setRefused(undefined);
    const next = { id: shader?.id ?? newShaderId(), name: shownName, code };
    const problem = await library.save(next);
    setSaving(false);
    if (problem) setRefused(problem);
    else onSaved(next, shader === undefined);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col overflow-auto bg-background text-label"
    >
      <header className="flex min-h-12 shrink-0 items-center gap-3 px-4 hairline-bottom">
        <button
          type="button"
          onClick={onClose}
          className="text-body text-label underline focus-visible:focus-ring"
        >
          {t("motionEditor.shaders.code.cancel")}
        </button>
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-center text-headline text-label">
          {t(shader ? "motionEditor.shaders.code.editTitle" : "motionEditor.shaders.code.title")}
        </h2>
        {library.allowed ? (
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void save()}
            className="h-8 rounded-control bg-accent-fill px-3 font-semibold text-on-accent hover:bg-accent-fill-hover focus-visible:focus-ring disabled:opacity-40"
          >
            {t("motionEditor.shaders.code.save")}
          </button>
        ) : (
          <span className="w-12" />
        )}
      </header>

      {library.allowed ? (
        <div className="grid min-h-0 flex-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-h-[320px] min-w-0 flex-col gap-2">
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-card bg-surface font-mono text-[13px] leading-5">
              <div
                ref={gutter}
                aria-hidden="true"
                className="shrink-0 overflow-hidden py-2 pr-2 pl-3 text-end text-label-tertiary select-none"
              >
                {Array.from({ length: lines }, (_, at) => (
                  <div key={at} className={badLines.has(at + 1) ? "font-bold text-danger" : ""}>
                    {at + 1}
                  </div>
                ))}
              </div>
              <textarea
                aria-label={t("motionEditor.shaders.code.label")}
                aria-describedby={`${titleId}-problems`}
                aria-invalid={problems.length > 0}
                value={code}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                maxLength={customShaderLimits.size}
                wrap="off"
                onChange={(event) => setCode(event.target.value)}
                onScroll={(event) => {
                  if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
                }}
                className="min-w-0 flex-1 resize-none bg-transparent py-2 pr-3 text-label outline-none"
              />
            </div>
            <div id={`${titleId}-problems`} aria-live="polite" className="flex flex-col gap-0.5">
              {[...problems.map((problem) => problem.message), ...(refused ? [refused] : [])]
                .slice(0, 6)
                .map((message) => (
                  <p key={message} className="text-footnote text-danger">
                    {message}
                  </p>
                ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative aspect-video overflow-hidden rounded-card bg-surface">
              <canvas
                key={String(stopped)}
                ref={canvas}
                width={640}
                height={360}
                aria-label={t("motionEditor.shaders.code.preview")}
                className="block size-full"
              />
              {(stopped || noPreview) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background p-4 text-center text-footnote text-label-secondary">
                  {t(
                    stopped
                      ? "motionEditor.shaders.code.stopped"
                      : "motionEditor.shaders.code.noPreview",
                  )}
                </div>
              )}
            </div>
            <div className="rounded-card bg-surface p-3">
              <TextInput
                label={t("motionEditor.shaders.code.name")}
                value={shownName}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            {read.controls.length > 0 && (
              <div className="flex flex-col gap-2 rounded-card bg-surface p-3">
                <h3 className="text-footnote font-semibold text-label">
                  {t("motionEditor.shaders.code.controls")}
                </h3>
                <EffectSettings
                  definition={definition}
                  values={cleanProps(definition, values)}
                  onChange={setValues}
                />
              </div>
            )}
            <p className="px-1 text-caption text-label-secondary">
              {t("motionEditor.shaders.code.help")}
            </p>
            {shader && (
              <button
                type="button"
                onClick={() => {
                  library.remove(shader.id);
                  onClose();
                }}
                className="min-h-11 rounded-card bg-surface text-body font-medium text-danger hover:bg-fill focus-visible:focus-ring"
              >
                {t("motionEditor.shaders.code.delete")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 p-6 text-center">
          <p className="text-headline text-label">{t("motionEditor.shaders.code.offTitle")}</p>
          <p className="text-footnote text-label-secondary">
            {t(
              library.allowCode
                ? "motionEditor.shaders.code.offBody"
                : "motionEditor.shaders.code.offAsk",
            )}
          </p>
          {library.allowCode && (
            <button
              type="button"
              onClick={library.allowCode}
              className="mx-auto h-10 rounded-card bg-accent-fill px-4 font-semibold text-on-accent hover:bg-accent-fill-hover focus-visible:focus-ring"
            >
              {t("motionEditor.shaders.code.allow")}
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
