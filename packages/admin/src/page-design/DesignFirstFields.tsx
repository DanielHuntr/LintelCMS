import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import type { FieldMessages } from "../api/client.js";
import { EntryFields } from "../content/EntryFields.js";
import { classNames } from "../design/classNames.js";
import type { EntryData, Field, FieldValue } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { countBlocks, countDesignSections } from "./designSummary.js";
import { PageDesignCard } from "./PageDesignCard.js";

interface DesignFirstFieldsProps {
  /** The blueprint's first page field: the page's design. */
  designField: Field;
  fields: readonly Field[];
  data: EntryData;
  errors: FieldMessages;
  onChange: (handle: string, value: FieldValue) => void;
  collectionHandle: string;
  entryId: string | undefined;
  hasTitle: boolean;
  onStartDesigning: () => void;
  isStarting: boolean;
}

/**
 * A page's fields when its blueprint has a design: the Design card first, then the other
 * fields. Blocks fields ("Page sections") are the older way to build a page; they're hidden
 * once the page has a design, and folded away under "Simple sections" until then.
 */
export function DesignFirstFields({
  designField,
  fields,
  data,
  errors,
  onChange,
  collectionHandle,
  entryId,
  hasTitle,
  onStartDesigning,
  isStarting,
}: DesignFirstFieldsProps) {
  const others = fields
    .filter((field) => field !== designField && field.type !== "blocks")
    .map(withPlainSummaryHelp);
  const sectionFields = fields.filter((field) => field.type === "blocks");
  const isDesigned = countDesignSections(data[designField.handle]) > 0;

  return (
    <div className="flex flex-col gap-9">
      <PageDesignCard
        field={designField}
        value={data[designField.handle]}
        collectionHandle={collectionHandle}
        entryId={entryId}
        hasTitle={hasTitle}
        onStartDesigning={onStartDesigning}
        isStarting={isStarting}
        error={errors[designField.handle]}
      />
      <EntryFields fields={others} data={data} errors={errors} onChange={onChange} />
      {!isDesigned && sectionFields.length > 0 && (
        <SimpleSections fields={sectionFields} data={data} errors={errors} onChange={onChange} />
      )}
    </div>
  );
}

/** What a site's Page blueprint says unless someone wrote their own. */
const STOCK_SUMMARY_HELP = "A sentence or two for search results and link previews";

/**
 * A page's Summary sits under its design, so people wonder where it shows. It says so here,
 * in words that can be translated; help someone wrote for their own blueprint stays.
 */
function withPlainSummaryHelp(field: Field): Field {
  if (field.handle !== "summary") return field;
  const isStock = !field.helpText || field.helpText === STOCK_SUMMARY_HELP;
  return isStock ? { ...field, helpText: t("pageHome.summaryHelp") } : field;
}

interface SimpleSectionsProps {
  fields: readonly Field[];
  data: EntryData;
  errors: FieldMessages;
  onChange: (handle: string, value: FieldValue) => void;
}

/** The form-based sections, closed unless asked for (or something in them needs attention). */
function SimpleSections({ fields, data, errors, onChange }: SimpleSectionsProps) {
  const [isChosenOpen, setChosenOpen] = useState(false);
  const contentId = useId();
  const hasProblem = fields.some((field) =>
    Object.keys(errors).some((key) => key === field.handle || key.startsWith(`${field.handle}.`)),
  );
  const isOpen = isChosenOpen || hasProblem;
  const blocks = fields.reduce((total, field) => total + countBlocks(data[field.handle]), 0);

  return (
    <section className="flex flex-col gap-4 rounded-card bg-fill/40 px-4 py-1">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setChosenOpen(!isOpen)}
          className="-mx-2 flex h-11 w-[calc(100%+1rem)] items-center gap-2 rounded-control px-2 text-start focus-visible:focus-ring"
        >
          <ChevronRight
            aria-hidden="true"
            className={classNames(
              "size-4 shrink-0 text-label-tertiary motion-safe:transition-transform motion-safe:duration-150",
              isOpen && "rotate-90",
            )}
          />
          <span className="text-body font-medium text-label">
            {t("pageDesign.simpleSections.title")}
          </span>
          <span className="ms-auto text-footnote text-label-secondary">
            {blocks === 0
              ? t("pageDesign.simpleSections.unused")
              : t("pageDesign.simpleSections.count", { count: blocks })}
          </span>
        </button>
      </h2>
      <div id={contentId} hidden={!isOpen} className="flex flex-col gap-6 pb-5">
        {isOpen && (
          <>
            <p className="text-footnote text-label-secondary">
              {t("pageDesign.simpleSections.description")}
            </p>
            <EntryFields fields={fields} data={data} errors={errors} onChange={onChange} />
          </>
        )}
      </div>
    </section>
  );
}
