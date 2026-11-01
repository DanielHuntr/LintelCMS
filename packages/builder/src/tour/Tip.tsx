import { Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { useBuilderText } from "../i18n/builder-text.js";

interface TipProps {
  /** Remembered once closed, so the same tip doesn't keep coming back. */
  id: string;
  tips: { isDismissed: (tip: string) => boolean; dismiss: (tip: string) => void };
  children: ReactNode;
}

/** A short, friendly hint where it helps, that people can close. Help and tips brings them back. */
export function Tip({ id, tips, children }: TipProps) {
  const text = useBuilderText();
  if (tips.isDismissed(id)) return null;
  return (
    <aside
      aria-label={text("pageBuilder.help.button")}
      className="flex items-start gap-2 rounded-card bg-accent/10 px-3 py-2 text-caption text-label"
    >
      <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1">{children}</p>
      <button
        type="button"
        onClick={() => tips.dismiss(id)}
        className="shrink-0 rounded-control px-1.5 font-semibold text-accent hover:bg-fill focus-visible:focus-ring"
      >
        {text("pageBuilder.tips.dismiss")}
      </button>
    </aside>
  );
}
