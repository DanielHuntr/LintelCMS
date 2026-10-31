import type { ReactNode } from "react";

interface LargeTitleProps {
  title: string;
  subtitle?: string;
  /** Buttons that act on the whole page, shown on the right. */
  actions?: ReactNode;
  /**
   * Every page has exactly one h1, and this is it. The design review page shows
   * the header as a specimen, so it asks for an h2 there instead.
   */
  headingLevel?: 1 | 2;
}

/** The header at the top of every admin page: a large title, an optional subtitle and actions. */
export function LargeTitle({ title, subtitle, actions, headingLevel = 1 }: LargeTitleProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <Heading className="text-large-title text-label">{title}</Heading>
        {subtitle && <p className="mt-1 text-body text-label-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 pb-1">{actions}</div>}
    </header>
  );
}
