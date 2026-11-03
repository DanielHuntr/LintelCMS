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
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t, type StringKey } from "../i18n/strings.js";
import { useDryRun, useMappingChoices, useSaveMapping } from "./dataTools.queries.js";
import type {
  MappingChoices,
  WordPressCustomField,
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
  if (choices.isError)
    return <LoadError error={choices.error} onRetry={() => void choices.refetch()} />;
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
  const [mapping, setMapping] = useState<WordPressImportMapping>({
    ...choices.suggested,
    mediaHosts: choices.suggested.mediaHosts ?? [],
    postFields: choices.suggested.postFields ?? {},
    pageFields: choices.suggested.pageFields ?? {},
    menus: choices.suggested.menus ?? true,
    products: choices.suggested.products ?? "import",
  });
  const customFields = choices.import.found.customFields ?? { post: [], page: [] };
  const foundMenus = choices.import.found.menus ?? 0;
  const foundProducts = choices.import.found.products ?? 0;
  const [mediaHostsText, setMediaHostsText] = useState(mapping.mediaHosts.join(", "));
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
          <ChoiceSelect
            label={t("wordpress.postsInto")}
            value={mapping.postsCollection}
            options={collections}
            onChange={(postsCollection) => change({ postsCollection })}
          />
          <ChoiceSelect
            label={t("wordpress.pagesInto")}
            value={mapping.pagesCollection}
            options={collections}
            onChange={(pagesCollection) => change({ pagesCollection })}
          />
          <ChoiceSelect
            label={t("wordpress.categoriesInto")}
            value={mapping.categoriesTaxonomy}
            options={taxonomies}
            onChange={(categoriesTaxonomy) => change({ categoriesTaxonomy })}
          />
          <ChoiceSelect
            label={t("wordpress.tagsInto")}
            value={mapping.tagsTaxonomy}
            options={taxonomies}
            onChange={(tagsTaxonomy) => change({ tagsTaxonomy })}
          />
          <ChoiceSelect
            label={t("wordpress.mediaFrom")}
            value={mapping.media}
            required
            options={[
              { value: "download", label: t("wordpress.media.download") },
              ...(choices.import.hasContentZip
                ? [{ value: "zip", label: t("wordpress.media.zip") }]
                : []),
              { value: "skip", label: t("wordpress.media.skip") },
            ]}
            onChange={(media) =>
              change({ media: (media ?? "skip") as WordPressImportMapping["media"] })
            }
          />
          {mapping.media === "download" && (
            <TextField
              className="sm:col-span-2"
              label={t("wordpress.mediaHosts")}
              hint={t("wordpress.mediaHostsHint")}
              placeholder="cdn.example.com"
              value={mediaHostsText}
              onChange={(event) => {
                setMediaHostsText(event.target.value);
                change({ mediaHosts: hostsFromText(event.target.value) });
              }}
            />
          )}
          <ChoiceSelect
            label={t("wordpress.authors")}
            value={mapping.authors}
            required
            options={[
              { value: "invite", label: t("wordpress.authors.invite") },
              { value: "skip", label: t("wordpress.authors.skip") },
            ]}
            onChange={(authors) =>
              change({ authors: (authors ?? "skip") as WordPressImportMapping["authors"] })
            }
          />
          <ChoiceSelect
            label={t("wordpress.drafts")}
            value={mapping.drafts}
            required
            options={[
              { value: "import", label: t("wordpress.drafts.import") },
              { value: "skip", label: t("wordpress.drafts.skip") },
            ]}
            onChange={(drafts) =>
              change({ drafts: (drafts ?? "skip") as WordPressImportMapping["drafts"] })
            }
          />
        </div>
        {foundProducts > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            <ChoiceSelect
              label={t("wordpress.products")}
              value={mapping.products}
              required
              options={[
                { value: "import", label: t("wordpress.products.import") },
                { value: "skip", label: t("wordpress.products.skip") },
              ]}
              onChange={(products) => change({ products: products === "skip" ? "skip" : "import" })}
            />
            {!choices.shopEnabled && (
              <p className="text-footnote text-warning">{t("wordpress.productsShopOff")}</p>
            )}
          </div>
        )}
        {foundMenus > 0 && (
          <div className="mt-5">
            <Toggle
              label={t("wordpress.menus")}
              checked={mapping.menus}
              onCheckedChange={(menus) => change({ menus })}
            />
          </div>
        )}
        <div className="mt-5 flex flex-col gap-1">
          <Toggle
            label={t("wordpress.redirects")}
            checked={mapping.redirects}
            onCheckedChange={(redirects) => change({ redirects })}
          />
          <p className="text-footnote text-label-secondary">{t("wordpress.redirectsHint")}</p>
        </div>
      </Card>

      <CustomFieldsCard
        kind="post"
        found={customFields.post}
        fields={choices.collectionFields[mapping.postsCollection ?? ""] ?? []}
        chosen={mapping.postFields}
        onChange={(postFields) => change({ postFields })}
      />
      <CustomFieldsCard
        kind="page"
        found={customFields.page}
        fields={choices.collectionFields[mapping.pagesCollection ?? ""] ?? []}
        chosen={mapping.pageFields}
        onChange={(pageFields) => change({ pageFields })}
      />
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
        <Button
          variant="tinted"
          onClick={() => void checkWithDryRun()}
          disabled={save.isPending || dryRun.isPending}
        >
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

/** "cdn.example.com, i0.wp.com" → one host each; the server checks each is an address. */
function hostsFromText(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((host) => host.trim())
    .filter((host) => host !== "");
}

/** A labelled menu of choices, with "Don’t import" unless `required`. Shared by the importers. */
export function ChoiceSelect({
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
          onChange={(event) =>
            onChange(event.target.value === LEAVE_OUT ? null : event.target.value)
          }
          className={classNames("h-10 appearance-none pe-9", controlClasses())}
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
          className="pointer-events-none absolute top-1/2 inset-e-3 size-4 -translate-y-1/2 text-label-secondary"
        />
      </div>
    </div>
  );
}

/** Custom fields (Advanced Custom Fields and the like) and the field each goes into. */
function CustomFieldsCard({
  kind,
  found,
  fields,
  chosen,
  onChange,
}: {
  kind: "post" | "page";
  found: WordPressCustomField[];
  fields: Array<{ handle: string; label: string }>;
  chosen: Record<string, string | null>;
  onChange: (chosen: Record<string, string | null>) => void;
}) {
  if (found.length === 0) return null;
  const options = fields.map((field) => ({ value: field.handle, label: field.label }));
  return (
    <Card title={t("wordpress.customFieldsTitle", { kind: t(`wordpress.kind.${kind}`) })}>
      <p className="mb-4 text-footnote text-label-secondary">{t("wordpress.customFieldsText")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {found.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <ChoiceSelect
              label={t("wordpress.customFieldInto", { key: field.key })}
              value={chosen[field.key] ?? null}
              options={options}
              onChange={(handle) => onChange({ ...chosen, [field.key]: handle })}
            />
            <p className="text-footnote text-label-secondary">
              {[
                field.fromAcf ? t("wordpress.customFieldFromAcf") : null,
                field.example
                  ? t("wordpress.customFieldExample", { example: field.example })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

const parts = ["body", "excerpt", "featuredImage", "categories", "tags"] as const;

function FieldMappingCard({
  kind,
  fields,
}: {
  kind: "post" | "page";
  fields: WordPressFieldMapping | null;
}) {
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
