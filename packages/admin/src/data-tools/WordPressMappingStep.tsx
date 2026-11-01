import { ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { Toggle } from "../design/Toggle.js";
import { t, type StringKey } from "../i18n/strings.js";
import { useDryRun, useMappingChoices, useSaveMapping } from "./dataTools.queries.js";
import type {
  MappingChoices,
  WordPressFieldMapping,
  WordPressImportMapping,
} from "./wordpressImport.api.js";
import { WordPressReport } from "./WordPressReport.js";

const LEAVE_OUT = "";

/**
 * Choosing where things go, then a dry run that shows exactly what the import will do,
 * then starting it. The mapping is saved before the dry run and before starting, so both
 * use what is on screen.
 */
export function WordPressMappingStep({
  importId,
  isStarting,
  startError,
  onStart,
}: {
  importId: string;
  isStarting: boolean;
  startError: string | null;
  onStart: () => void;
}) {
  const choices = useMappingChoices(importId);
  if (choices.isError) return <LoadError error={choices.error} onRetry={() => void choices.refetch()} />;
  if (!choices.data) {
    return (
      <LoadingRegion label={t("wordpress.loading")}>
        <Skeleton className="h-64 rounded-card" />
      </LoadingRegion>
    );
  }
  return (
    <MappingForm
      importId={importId}
      choices={choices.data}
      isStarting={isStarting}
      startError={startError}
      onStart={onStart}
    />
  );
}

function MappingForm({
  importId,
  choices,
  isStarting,
  startError,
  onStart,
}: {
  importId: string;
  choices: MappingChoices;
  isStarting: boolean;
  startError: string | null;
  onStart: () => void;
}) {
  const [mapping, setMapping] = useState<WordPressImportMapping>(choices.suggested);
  const save = useSaveMapping(importId);
  const dryRun = useDryRun(importId);
  const change = (changes: Partial<WordPressImportMapping>) => {
    setMapping((current) => ({ ...current, ...changes }));
    dryRun.reset();
  };
  const collections = choices.collections.map((item) => ({ value: item.handle, label: item.name }));
  const taxonomies = choices.taxonomies.map((item) => ({ value: item.handle, label: item.name }));
  const error = save.error ?? dryRun.error;

  async function checkWithDryRun() {
    await save.mutateAsync(mapping);
    dryRun.mutate();
  }

  return (
    <>
      <Card title={t("wordpress.mappingTitle")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceSelect label={t("wordpress.postsInto")} value={mapping.postsCollection} options={collections} onChange={(postsCollection) => change({ postsCollection })} />
          <ChoiceSelect label={t("wordpress.pagesInto")} value={mapping.pagesCollection} options={collections} onChange={(pagesCollection) => change({ pagesCollection })} />
          <ChoiceSelect label={t("wordpress.categoriesInto")} value={mapping.categoriesTaxonomy} options={taxonomies} onChange={(categoriesTaxonomy) => change({ categoriesTaxonomy })} />
          <ChoiceSelect label={t("wordpress.tagsInto")} value={mapping.tagsTaxonomy} options={taxonomies} onChange={(tagsTaxonomy) => change({ tagsTaxonomy })} />
          <ChoiceSelect
            label={t("wordpress.mediaFrom")}
            value={mapping.media}
            required
            options={[
              { value: "download", label: t("wordpress.media.download") },
              ...(choices.import.hasContentZip ? [{ value: "zip", label: t("wordpress.media.zip") }] : []),
              { value: "skip", label: t("wordpress.media.skip") },
            ]}
            onChange={(media) => change({ media: (media ?? "skip") as WordPressImportMapping["media"] })}
          />
          <ChoiceSelect
            label={t("wordpress.authors")}
            value={mapping.authors}
            required
            options={[
              { value: "invite", label: t("wordpress.authors.invite") },
              { value: "skip", label: t("wordpress.authors.skip") },
            ]}
            onChange={(authors) => change({ authors: (authors ?? "skip") as WordPressImportMapping["authors"] })}
          />
          <ChoiceSelect
            label={t("wordpress.drafts")}
            value={mapping.drafts}
            required
            options={[
              { value: "import", label: t("wordpress.drafts.import") },
              { value: "skip", label: t("wordpress.drafts.skip") },
            ]}
            onChange={(drafts) => change({ drafts: (drafts ?? "skip") as WordPressImportMapping["drafts"] })}
          />
        </div>
        <div className="mt-5 flex flex-col gap-1">
          <Toggle label={t("wordpress.redirects")} checked={mapping.redirects} onCheckedChange={(redirects) => change({ redirects })} />
          <p className="text-footnote text-label-secondary">{t("wordpress.redirectsHint")}</p>
        </div>
      </Card>

      {save.data && (
        <>
          <FieldMappingCard kind="post" fields={save.data.fields.posts} />
          <FieldMappingCard kind="page" fields={save.data.fields.pages} />
        </>
      )}
      {dryRun.data && (
        <Card title={t("wordpress.dryRunTitle")}>
          <p className="mb-4 text-footnote text-label-secondary">{t("wordpress.dryRunNote")}</p>
          <WordPressReport report={dryRun.data} />
        </Card>
      )}
      {(error || startError) && (
        <p role="alert" className="text-footnote text-danger">
          {error ? describeError(error) : startError}
        </p>
      )}
      {dryRun.isPending && (
        <p role="status" className="text-footnote text-label-secondary">
          {t("wordpress.dryRunning")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="tinted" onClick={() => void checkWithDryRun()} disabled={save.isPending || dryRun.isPending}>
          {t("wordpress.dryRun")}
        </Button>
        <Button
          onClick={() => void save.mutateAsync(mapping).then(onStart)}
          disabled={save.isPending || dryRun.isPending || isStarting}
        >
          {t("wordpress.start")}
        </Button>
      </div>
    </>
  );
}

function ChoiceSelect({
  label,
  value,
  options,
  required = false,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-footnote font-medium text-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value ?? LEAVE_OUT}
          onChange={(event) => onChange(event.target.value === LEAVE_OUT ? null : event.target.value)}
          className={classNames("h-10 appearance-none pr-9", controlClasses())}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {!required && <option value={LEAVE_OUT}>{t("wordpress.leaveOut")}</option>}
        </select>
        <ChevronsUpDown
          aria-hidden="true"
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-label-secondary"
        />
      </div>
    </div>
  );
}

const parts = ["body", "excerpt", "featuredImage", "categories", "tags"] as const;

function FieldMappingCard({ kind, fields }: { kind: "post" | "page"; fields: WordPressFieldMapping | null }) {
  if (!fields) return null;
  return (
    <Card title={t("wordpress.fieldsTitle", { kind: t(`wordpress.kind.${kind}`) })}>
      <ul className="flex flex-col gap-1 text-body text-label">
        {parts.map((part) => {
          const field = fields[part];
          return (
            <li key={part} className={field ? undefined : "text-label-secondary"}>
              {field
                ? t(`wordpress.field.${part}` as StringKey, { field })
                : t("wordpress.field.none", { part: t(`wordpress.part.${part}` as StringKey) })}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
