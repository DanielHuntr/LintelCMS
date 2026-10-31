import type { ReactNode } from "react";
import { classNames } from "./classNames.js";
import type { Tone } from "./tones.js";

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

const toneClasses: Record<Tone, string> = {
  neutral: "bg-fill text-label-secondary",
  accent: "bg-accent/14 text-accent",
  success: "bg-success/14 text-success",
  warning: "bg-warning/14 text-warning",
  danger: "bg-danger/14 text-danger",
};

/** A short status label, such as "Draft" or "New". Keep the text to one or two words. */
export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={classNames(
        "inline-flex h-5 items-center rounded-full px-2 text-caption font-semibold whitespace-nowrap",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
