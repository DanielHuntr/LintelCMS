import { useId, type ReactNode } from "react";

interface PanelSectionProps {
  title: string;
  /** Something small beside the title, such as the status badge. */
  accessory?: ReactNode;
  children: ReactNode;
}

/** One group of the editor's side panel, like a section of the inspector in Keynote. */
export function PanelSection({ title, accessory, children }: PanelSectionProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 px-4 py-4 [&+&]:hairline-top">
      <header className="flex min-h-5 items-center justify-between gap-2">
        <h2 id={titleId} className="text-footnote font-semibold text-label-secondary">
          {title}
        </h2>
        {accessory}
      </header>
      {children}
    </section>
  );
}
