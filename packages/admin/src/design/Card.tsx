import type { ReactNode } from "react";
import { classNames } from "./classNames.js";

interface CardProps {
  /** Shown as an h2 at the top of the card. */
  title?: string;
  /** Something small beside the title, such as a plain Button or a Badge. */
  accessory?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A white (or elevated grey, in dark mode) surface that groups related content. */
export function Card({ title, accessory, className, children }: CardProps) {
  return (
    <section className={classNames("flex flex-col rounded-card bg-surface p-5", className)}>
      {(title || accessory) && (
        <header className="mb-4 flex min-h-7 items-center justify-between gap-3">
          {title && <h2 className="text-headline text-label">{title}</h2>}
          {accessory}
        </header>
      )}
      {children}
    </section>
  );
}
