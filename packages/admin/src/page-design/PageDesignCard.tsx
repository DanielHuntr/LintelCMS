import { Link } from "@tanstack/react-router";
import { CircleAlert, PanelsTopLeft, Sparkles } from "lucide-react";
import { lazy, Suspense, useId } from "react";
import { Button } from "../design/Button.js";
import { LinkButton } from "../design/LinkButton.js";
import type { Field } from "../fields/field.types.js";
import { t, tCount } from "../i18n/strings.js";
import { countDesignSections } from "./designSummary.js";

// The renderer is part of the builder, so the picture loads only when a page has a design.
const DesignThumbnail = lazy(async () => ({
  default: (await import("./DesignThumbnail.js")).DesignThumbnail,
}));

interface PageDesignCardProps {
  field: Field;
  value: unknown;
  collectionHandle: string;
  /** Undefined until a new page is first saved. */
  entryId: string | undefined;
  /** For a new page: whether it has a title yet, which is all it needs to be designed. */
  hasTitle: boolean;
  /** Saves a new page, then opens it in the builder. */
  onStartDesigning: () => void;
  isStarting: boolean;
  error?: string;
}

/**
 * The first thing on a page's editor: how the page looks, and the way into the builder. A
 * designed page shows a live picture of itself and Edit design; an empty one offers to start
 * from a template or a section; a new one opens the builder as soon as it has a title.
 */
export function PageDesignCard({
  field,
  value,
  collectionHandle,
  entryId,
  hasTitle,
  onStartDesigning,
  isStarting,
  error,
}: PageDesignCardProps) {
  const headingId = useId();
  const summaryId = useId();
  const errorId = useId();
  const sections = countDesignSections(value);
  const isDesigned = sections > 0;
  const designRoute = {
    to: "/content/$collection/$entryId/design/$field",
    params: { collection: collectionHandle, entryId: entryId ?? "", field: field.handle },
  } as const;
  const describedBy = [summaryId, error ? errorId : undefined].filter(Boolean).join(" ");

  return (
    <section
      aria-labelledby={headingId}
      data-field-handle={field.handle}
      className="flex flex-col overflow-hidden rounded-card bg-surface hairline-ring"
    >
      <div className="relative aspect-[16/9] max-h-[22rem] w-full overflow-hidden bg-fill/60 hairline-bottom">
        {isDesigned ? (
          <Link {...designRoute} tabIndex={-1} aria-hidden="true" className="block size-full">
            <Suspense fallback={<div className="size-full bg-fill" />}>
              <DesignThumbnail design={value} />
            </Suspense>
          </Link>
        ) : (
          <EmptyDesignPicture />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={headingId} className="text-headline text-label">
            {isDesigned || entryId === undefined ? field.label : t("pageDesign.card.emptyTitle")}
          </h2>
          <p id={summaryId} className="text-footnote text-label-secondary">
            {entryId === undefined
              ? t("pageDesign.card.nameFirst")
              : isDesigned
                ? tCount(
                    {
                      one: "pageDesign.field.summary.one",
                      other: "pageDesign.field.summary.other",
                    },
                    sections,
                  )
                : t("pageDesign.card.emptyDescription")}
          </p>
        </div>
        {entryId === undefined ? (
          <Button
            size="large"
            icon={<Sparkles aria-hidden="true" />}
            disabled={!hasTitle || isStarting}
            aria-describedby={describedBy}
            onClick={onStartDesigning}
          >
            {isStarting ? t("pageDesign.card.opening") : t("pageDesign.card.startDesigning")}
          </Button>
        ) : (
          <LinkButton {...designRoute} size="large" aria-describedby={describedBy}>
            {isDesigned ? t("pageDesign.field.edit") : t("pageDesign.card.start")}
          </LinkButton>
        )}
      </div>
      {error && (
        <p
          id={errorId}
          className="flex items-start gap-2 px-5 pb-4 text-footnote font-medium text-danger"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </section>
  );
}

/** A quiet sketch of a page waiting to be designed. */
function EmptyDesignPicture() {
  return (
    <div aria-hidden="true" className="flex size-full items-center justify-center p-8">
      <div className="flex w-full max-w-sm flex-col gap-2.5 rounded-card bg-surface p-4 shadow-float">
        <div className="flex items-center gap-2">
          <PanelsTopLeft className="size-4 text-accent" />
          <div className="h-2 w-20 rounded-full bg-fill-strong" />
        </div>
        <div className="h-14 rounded-control bg-accent/12" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-8 rounded-control bg-fill" />
          <div className="h-8 rounded-control bg-fill" />
          <div className="h-8 rounded-control bg-fill" />
        </div>
      </div>
    </div>
  );
}
