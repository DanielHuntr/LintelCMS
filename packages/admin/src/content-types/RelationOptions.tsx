import { Link } from "@tanstack/react-router";
import { ChevronsUpDown } from "lucide-react";
import { useId } from "react";
import { useCollections } from "../content/content.queries.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import type { FieldOptions } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { useTaxonomies } from "../taxonomies/taxonomies.queries.js";

interface RelationOptionsProps {
  options: FieldOptions;
  onChange: (changes: FieldOptions) => void;
}

/** A terms field's settings: which taxonomy, and whether one term or several. */
export function TermsOptions({ options, onChange }: RelationOptionsProps) {
  const taxonomies = useTaxonomies();
  const selectId = useId();
  const hintId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-footnote font-medium text-label">
          {t("builder.taxonomy")}
        </label>
        <div className="relative max-w-sm">
          <select
            id={selectId}
            value={options.taxonomy ?? ""}
            aria-describedby={hintId}
            onChange={(event) => onChange({ taxonomy: event.target.value })}
            className={classNames("h-10 appearance-none pe-9", controlClasses())}
          >
            <option value="" disabled>
              {t("fields.select.choose")}
            </option>
            {(taxonomies.data ?? []).map((taxonomy) => (
              <option key={taxonomy.handle} value={taxonomy.handle}>
                {taxonomy.name}
              </option>
            ))}
          </select>
          <ChevronsUpDown
            aria-hidden="true"
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 inset-e-3 size-4 -translate-y-1/2 text-label-secondary"
          />
        </div>
        <p id={hintId} className="text-footnote text-label-secondary">
          {t("builder.taxonomyHint")}{" "}
          <Link
            to="/content/taxonomies"
            className="text-accent underline decoration-1 underline-offset-2 hover:decoration-2"
          >
            {t("builder.manageTaxonomies")}
          </Link>
        </p>
      </div>
      <HowMany
        options={options}
        onChange={onChange}
        one={t("builder.oneTerm")}
        several={t("builder.severalTerms")}
      />
    </div>
  );
}

/** An entries field's settings: which collections to choose from, and how many. */
export function EntriesOptions({ options, onChange }: RelationOptionsProps) {
  const collections = useCollections();
  const chosen = options.collections ?? [];

  function toggle(handle: string) {
    onChange({
      collections: chosen.includes(handle)
        ? chosen.filter((existing) => existing !== handle)
        : [...chosen, handle],
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-footnote font-medium text-label">
          {t("builder.entryCollections")}
        </legend>
        <ul className="flex flex-wrap gap-2">
          {(collections.data ?? []).map((collection) => (
            <li key={collection.handle}>
              <label
                className={classNames(
                  "inline-flex h-8 cursor-pointer items-center rounded-full px-3.5 text-footnote font-medium select-none has-[:focus-visible]:focus-ring",
                  chosen.includes(collection.handle)
                    ? "bg-accent/14 text-accent"
                    : "bg-fill text-label-secondary hover:text-label",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={chosen.includes(collection.handle)}
                  onChange={() => toggle(collection.handle)}
                />
                {collection.name}
              </label>
            </li>
          ))}
        </ul>
        <p className="text-footnote text-label-secondary">{t("builder.entryCollectionsHint")}</p>
      </fieldset>
      <HowMany
        options={options}
        onChange={onChange}
        one={t("builder.oneEntry")}
        several={t("builder.severalEntries")}
      />
    </div>
  );
}

function HowMany({
  options,
  onChange,
  one,
  several,
}: RelationOptionsProps & { one: string; several: string }) {
  return (
    <SegmentedControl<"one" | "several">
      label={t("builder.howMany")}
      options={[
        { value: "one", label: one },
        { value: "several", label: several },
      ]}
      value={options.maxItems === 1 ? "one" : "several"}
      onChange={(choice) => onChange({ maxItems: choice === "one" ? 1 : undefined })}
    />
  );
}
