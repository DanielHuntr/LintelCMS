import type { ReactNode } from "react";
import { classNames } from "../class-names.js";

export type ColumnCount = 2 | 3 | 4;

export interface ColumnsProps {
  children: ReactNode;
  /** How many columns on a wide screen. They fold to fewer as the screen narrows. */
  count?: ColumnCount;
  className?: string;
}

/**
 * Children side by side in equal columns, folding to one column on phones. Output:
 * `<div class="lintel-columns lintel-columns--3">`.
 */
export function Columns({ children, count = 2, className }: ColumnsProps) {
  return (
    <div className={classNames("lintel-columns", `lintel-columns--${count}`, className)}>
      {children}
    </div>
  );
}
