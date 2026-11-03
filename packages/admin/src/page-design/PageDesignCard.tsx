import { Link } from "@tanstack/react-router";
import { CircleAlert, PanelsTopLeft, PencilRuler } from "lucide-react";
import { lazy, Suspense, useId } from "react";
import { Button } from "../design/Button.js";
import { LinkButton } from "../design/LinkButton.js";
import type { Field } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
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
 * designed page shows a live picture of itself and Edit design; an empty one is a single row
 * offering a start from a template or a section, so the page's fields stay in view; a new one
 * opens the builder as soon as it has a title.
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
  const canDesign = useCan("builder:design");
  const sections = countDesignSections(value);
  const isDesigned = sections > 0;
  const designRoute = {
    to: "/content/$collection/$entryId/design/$field",
    params: { collection: collectionHandle, entryId: entryId ?? "", field: field.handle },
  } as const;
  const describedBy = [summaryId, error ? errorId : undefined].filter(Boolean).join(" ");

  const actionLabel = canDesign ? t("pageDesign.field.edit") : t("pageHome.editOnThePage");
  const words = (
    <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
      <h2 id={headingId} className="text-headline text-label">
        {isDesigned || entryId === undefined ? field.label : t("pageDesign.card.emptyTitle")}
      </h2>
      <p id={summaryId} className="text-footnote text-label-secondary">
        {entryId === undefined
          ? t("pageDesign.card.nameFirst")
          : isDesigned
            ? t("pageDesign.field.summary", { count: sections })
            : t("pageDesign.card.emptyDescription")}
      </p>
    </div>
  );
  const action =
    entryId === undefined ? (
      <Button
        icon={<PencilRuler aria-hidden="true" />}
        disabled={!hasTitle || isStarting}
        aria-describedby={describedBy}
        onClick={onStartDesigning}
      >
        {isStarting ? t("pageDesign.card.opening") : t("pageDesign.card.startDesigning")}
      </Button>
    ) : (
      <LinkButton {...designRoute} aria-describedby={describedBy}>
        {isDesigned ? actionLabel : canDesign ? t("pageDesign.card.start") : actionLabel}
      </LinkButton>
    );

  return (
    <section
      aria-labelledby={headingId}
      data-field-handle={field.handle}
      className="flex flex-col overflow-hidden rounded-card bg-surface hairline-ring"
    >
      {isDesigned && (
        <div className="group relative aspect-[16/9] max-h-[22rem] w-full overflow-hidden bg-fill/60 hairline-bottom">
          <Link {...designRoute} tabIndex={-1} aria-hidden="true" className="block size-full">
            <Suspense fallback={<div className="size-full bg-fill" />}>
              <DesignThumbnail design={value} />
            </Suspense>
            {/* Pointing at the picture says what a click does; the button below is the real way. */}
            <span className="absolute inset-0 flex items-center justify-center bg-label/0 opacity-0 transition duration-150 ease-standard group-hover:bg-label/10 group-hover:opacity-100">
              <span className="rounded-full bg-surface-raised px-3 py-1.5 text-footnote font-medium text-label shadow-float">
                {actionLabel}
              </span>
            </span>
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        {!isDesigned && (
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-control bg-fill text-label-secondary"
          >
            <PanelsTopLeft strokeWidth={1.75} className="size-5" />
          </span>
        )}
        {words}
        {action}
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
