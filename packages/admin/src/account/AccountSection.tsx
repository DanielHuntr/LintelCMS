import { useId, type ReactNode } from "react";

interface AccountSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** One card on the account page, with its own heading for screen-reader navigation. */
export function AccountSection({ title, description, children }: AccountSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-card bg-surface p-5"
    >
      <div>
        <h2 id={headingId} className="text-headline text-label">
          {title}
        </h2>
        {description && <p className="mt-1 text-footnote text-label-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}
