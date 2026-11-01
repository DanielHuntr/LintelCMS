import type { ReactNode } from "react";
import { classNames } from "../design/classNames.js";

/** A small icon button at the end of a list row, such as Edit or Delete. */
export function RowIconButton({
  label,
  onClick,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={classNames(
        "flex size-7 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring",
        tone === "danger" ? "hover:text-danger" : "hover:text-label",
      )}
    >
      {children}
    </button>
  );
}
