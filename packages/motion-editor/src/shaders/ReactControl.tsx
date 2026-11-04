import { reactSources, type ReactSourceName, type SettingReactInput } from "@lintel/motion/effects";
import { Activity } from "lucide-react";
import { useState, type ReactNode } from "react";
import { classNames } from "../controls/classNames.js";
import { Select } from "../controls/Field.js";
import { Slider } from "../controls/Slider.js";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";

/**
 * A number setting, with a quiet button that lets the pointer, scrolling or a timeline drive
 * it. Off, it's only the button. On, the setting's own slider is where it starts, and a second
 * slider says where it goes.
 */
export function ReactControl({
  label,
  min,
  max,
  step,
  value,
  react,
  onChange,
  onCommit,
  children,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  react: SettingReactInput | undefined;
  onChange: (react: SettingReactInput | undefined) => void;
  onCommit?: () => void;
  /** The setting's own slider. */
  children: ReactNode;
}) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const showing = open || react !== undefined;
  const choose = (source: string) => {
    onChange(
      source === "none"
        ? undefined
        : {
            source: source as ReactSourceName,
            to: react?.to ?? (value === max ? min : max),
            ...(source === "timeline" ? { seconds: react?.seconds ?? 6 } : {}),
          },
    );
    onCommit?.();
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">{children}</div>
        <button
          type="button"
          aria-expanded={showing}
          aria-label={t("motionEditor.shaders.react.button", { name: label })}
          title={t("motionEditor.shaders.react.button", { name: label })}
          onClick={() => {
            setOpen(!showing);
            if (showing && react) choose("none");
          }}
          className={classNames(
            "flex size-6 shrink-0 items-center justify-center rounded-full focus-visible:focus-ring",
            react
              ? "bg-accent-fill text-on-accent"
              : "text-label-tertiary hover:bg-fill hover:text-label-secondary",
          )}
        >
          <Activity aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      {showing && (
        <div className="flex flex-col gap-2 rounded-control bg-fill/50 p-2">
          <Select
            label={t("motionEditor.shaders.react.source", { name: label })}
            value={react?.source ?? "none"}
            options={[
              { value: "none", label: t("motionEditor.shaders.react.none") },
              ...reactSources.map((source) => ({
                value: source,
                label: t(`motionEditor.shaders.react.${source}` as MotionEditorStringKey),
              })),
            ]}
            onChange={(event) => choose(event.target.value)}
          />
          {react && (
            <Slider
              label={t("motionEditor.shaders.react.to")}
              min={min}
              max={max}
              step={step}
              value={react.to}
              displayValue={String(Math.round(react.to * 100) / 100)}
              onChange={(to) => onChange({ ...react, to })}
              onCommit={onCommit}
            />
          )}
          {react?.source === "timeline" && (
            <Slider
              label={t("motionEditor.shaders.react.seconds")}
              min={1}
              max={60}
              step={1}
              value={react.seconds ?? 6}
              displayValue={t("motionEditor.simple.seconds", { seconds: react.seconds ?? 6 })}
              onChange={(seconds) => onChange({ ...react, seconds })}
              onCommit={onCommit}
            />
          )}
        </div>
      )}
    </div>
  );
}
