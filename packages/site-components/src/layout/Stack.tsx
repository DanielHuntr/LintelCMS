import type { ReactNode } from "react";
import { classNames } from "../class-names.js";

export type StackGap = "small" | "medium" | "large";

export interface StackProps {
  children: ReactNode;
  /** The room between each child, from the theme's spacing scale. */
  gap?: StackGap;
  /** Centre the children, as in a hero or a call to action. */
  centred?: boolean;
  className?: string;
}

/** Children one above the other with even room between. Output: `<div class="lintel-stack">`. */
export function Stack({ children, gap = "medium", centred = false, className }: StackProps) {
  return (
    <div
      className={classNames(
        "lintel-stack",
        gap !== "medium" && `lintel-stack--gap-${gap}`,
        centred && "lintel-stack--centred",
        className,
      )}
    >
      {children}
    </div>
  );
}
