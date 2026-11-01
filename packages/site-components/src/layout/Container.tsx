import type { ReactNode } from "react";
import { classNames } from "../class-names.js";

export type ContainerWidth = "narrow" | "normal" | "wide";

export interface ContainerProps {
  children: ReactNode;
  /** Narrow suits reading (about 70 characters a line); wide suits pictures. */
  width?: ContainerWidth;
  className?: string;
}

/** Centres its content and keeps it to a width. Output: `<div class="lintel-container">`. */
export function Container({ children, width = "normal", className }: ContainerProps) {
  return (
    <div
      className={classNames(
        "lintel-container",
        width !== "normal" && `lintel-container--${width}`,
        className,
      )}
    >
      {children}
    </div>
  );
}
