import type { ReactNode } from "react";

/** One titled block on the review page, e.g. "Buttons". */
export function SpecimenGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-footnote font-semibold tracking-wide text-label-secondary uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
