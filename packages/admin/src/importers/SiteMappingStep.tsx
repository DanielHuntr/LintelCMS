import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { ChoiceSelect } from "../data-tools/WordPressMappingStep.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t, type StringKey } from "../i18n/strings.js";
import { canGoInto, handleFor } from "./fieldCompatibility.js";
import type {
  ContentTypeMapping,
  FoundContentType,
  SiteImportMapping,
  SiteMappingChoices,
} from "./siteImport.api.js";
import { SiteImportReportView } from "./SiteImportReportView.js";
import { useSaveSiteMapping, useSiteDryRun, useSiteMappingChoices } from "./siteImport.queries.js";

const NEW = "__new__";

/**
 * Choosing where each kind of content goes and which field takes what, then a dry run that
 * shows exactly what the import will do, then starting it. Everything starts on a sensible
 * choice: content goes into the collection with the same name when there is one, otherwise
 * a new content type is made with a field for each of the old site's.
 */
export function SiteMappingStep(props: {
  importId: string;
  isStarting: boolean;
  startError: string | null;
  onStart: () => void;
}) {
  const choices = useSiteMappingChoices(props.importId);
  if (choices.isError) {
    return <LoadError error={choices.error} onRetry={() => void choices.refetch()} />;
  }
  if (!choices.data) {
    return (
      <LoadingRegion label={t("siteImport.loading")}>
        <Skeleton className="h-64 rounded-card" />
      </LoadingRegion>
    );
  }
  return <MappingForm {...props} choices={choices.data} />;
}

function MappingForm({
  importId,
  choices,
  isStarting,
  startError,
  onStart,
}: {
  importId: string;
  choices: SiteMappingChoices;
  isStarting: boolean;
  startError: string | null;
  onStart: () => void;
}) {
  const [mapping, setMapping] = useState<SiteImportMapping>(choices.suggested);
  const [hostsText, setHostsText] = useState(choices.suggested.mediaHosts.join(", "));
  const save = useSaveSiteMapping(importId);
  const dryRun = useSiteDryRun(importId);
  const change = (changes: Partial<SiteImportMapping>) => {
    setMapping((current) => ({ ...current, ...changes }));
    dryRun.reset();
  };
  const changeType = (key: string, typeMapping: ContentTypeMapping) =>
    change({ contentTypes: { ...mapping.contentTypes, [key]: typeMapping } });
  const error = save.error ?? dryRun.error;
  const found = choices.import.found;

  return (
    <>
      {found.contentTypes.map((type) => (
        <ContentTypeCard
          key={type.key}
          type={type}
          mapping={mapping.contentTypes[type.key]}
          choices={choices}
          onChange={(typeMapping) => changeType(type.key, typeMapping)}
        />
      ))}

      <Card title={t("siteImport.optionsTitle")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {found.taxonomies.map((taxonomy) => (
            <ChoiceSelect
              key={taxonomy.key}
              label={t("siteImport.taxonomyInto", { name: taxonomy.name })}
              value={mapping.taxonomies[taxonomy.key] ?? null}
              options={[
                ...choices.taxonomies.map((item) => ({ value: item.handle, label: item.name })),
                ...(choices.taxonomies.some((item) => item.handle === taxonomy.handle)
                  ? []
                  : [
                      {
                        value: taxonomy.handle,
                        label: t("siteImport.newTaxonomy", { name: taxonomy.name }),
                      },
                    ]),
              ]}
              onChange={(handle) =>
                change({ taxonomies: { ...mapping.taxonomies, [taxonomy.key]: handle } })
              }
            />
          ))}
          <ChoiceSelect
            label={t("siteImport.drafts")}
            value={mapping.drafts}
            required
            options={[
              { value: "import", label: t("wordpress.drafts.import") },
              { value: "skip", label: t("wordpress.drafts.skip") },
            ]}
            onChange={(drafts) => change({ drafts: drafts === "skip" ? "skip" : "import" })}
          />
        </div>
        <div className="mt-5 flex flex-col gap-3">
          <Toggle
            label={t("siteImport.media", { count: found.media })}
            checked={mapping.media === "import"}
            onCheckedChange={(on) => change({ media: on ? "import" : "skip" })}
          />
          {mapping.media === "import" && (
            <TextField
              label={t("wordpress.mediaHosts")}
              hint={t("siteImport.mediaHostsHint", {
                hosts: choices.import.mediaHosts.join(", ") || t("siteImport.noHosts"),
              })}
              placeholder="cdn.example.com"
              value={hostsText}
              onChange={(event) => {
                setHostsText(event.target.value);
                change({
                  mediaHosts: event.target.value.split(/[\s,]+/).filter((host) => host !== ""),
                });
              }}
            />
          )}
          {found.menus > 0 && (
            <Toggle
              label={t("siteImport.menus", { count: found.menus })}
              checked={mapping.menus}
              onCheckedChange={(menus) => change({ menus })}
            />
          )}
          {found.globals > 0 && (
            <Toggle
              label={t("siteImport.globals", { count: found.globals })}
              checked={mapping.globals}
              onCheckedChange={(globals) => change({ globals })}
            />
          )}
          <Toggle
            label={t("wordpress.redirects")}
            checked={mapping.redirects}
            onCheckedChange={(redirects) => change({ redirects })}
          />
          <p className="text-footnote text-label-secondary">{t("wordpress.redirectsHint")}</p>
        </div>
      </Card>

      {dryRun.data && (
        <Card title={t("wordpress.dryRunTitle")}>
          <p className="mb-4 text-footnote text-label-secondary">{t("wordpress.dryRunNote")}</p>
          <SiteImportReportView report={dryRun.data} />
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
          onClick={() => void save.mutateAsync(mapping).then(() => dryRun.mutate())}
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

function ContentTypeCard({
  type,
  mapping,
  choices,
  onChange,
}: {
  type: FoundContentType;
  mapping: ContentTypeMapping | undefined;
  choices: SiteMappingChoices;
  onChange: (mapping: ContentTypeMapping) => void;
}) {
  const current = mapping ?? { collection: null, create: false, name: type.name, fields: {} };
  const existing =
    current.collection && !current.create
      ? (choices.collectionFields[current.collection] ?? [])
      : null;
  const newHandle = choices.collectionFields[type.handle] ? `${type.handle}_imported` : type.handle;

  function chooseCollection(value: string | null) {
    if (value === null) {
      onChange({ ...current, collection: null });
    } else if (value === NEW) {
      onChange({
        collection: newHandle,
        create: true,
        name: type.name,
        fields: Object.fromEntries(type.fields.map((field) => [field.key, handleFor(field.key)])),
      });
    } else {
      const fields = choices.collectionFields[value] ?? [];
      onChange({
        collection: value,
        create: false,
        name: type.name,
        fields: Object.fromEntries(
          type.fields.map((field) => {
            const match = fields.find(
              (candidate) =>
                canGoInto(field.kind, candidate.type) &&
                (candidate.handle === handleFor(field.key) || field.kind === "design"),
            );
            return [field.key, match?.handle ?? null];
          }),
        ),
      });
    }
  }

  return (
    <Card title={t("siteImport.typeTitle", { name: type.name, count: type.entries })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceSelect
          label={t("siteImport.typeInto")}
          value={current.collection === null ? null : current.create ? NEW : current.collection}
          options={[
            ...choices.collections.map((item) => ({ value: item.handle, label: item.name })),
            { value: NEW, label: t("siteImport.newType", { name: type.name }) },
          ]}
          onChange={chooseCollection}
        />
        {current.create && current.collection !== null && (
          <TextField
            label={t("siteImport.newTypeName")}
            value={current.name}
            onChange={(event) => onChange({ ...current, name: event.target.value })}
          />
        )}
      </div>
      {current.collection !== null && type.fields.length > 0 && (
        <table className="mt-5 w-full text-start text-body text-label">
          <caption className="mb-2 text-start text-footnote text-label-secondary">
            {t("siteImport.fieldsCaption")}
          </caption>
          <thead className="text-footnote text-label-secondary">
            <tr>
              <th scope="col" className="pb-2 text-start font-medium">
                {t("siteImport.column.oldField")}
              </th>
              <th scope="col" className="pb-2 text-start font-medium">
                {t("siteImport.column.newField")}
              </th>
            </tr>
          </thead>
          <tbody>
            {type.fields.map((field) => (
              <tr key={field.key} className="hairline-top">
                <th scope="row" className="py-2 pe-3 text-start align-middle font-normal">
                  {field.label}
                  <span className="block text-footnote text-label-secondary">
                    {t(`siteImport.kind.${field.kind}` as StringKey)}
                  </span>
                </th>
                <td className="py-2">
                  <ChoiceSelect
                    label={t("siteImport.fieldInto", { name: field.label })}
                    value={current.fields[field.key] ?? null}
                    options={
                      existing
                        ? existing
                            .filter((candidate) => canGoInto(field.kind, candidate.type))
                            .map((candidate) => ({
                              value: candidate.handle,
                              label: candidate.label,
                            }))
                        : [
                            {
                              value: handleFor(field.key),
                              label: t("siteImport.newField", { name: field.label }),
                            },
                          ]
                    }
                    onChange={(handle) =>
                      onChange({ ...current, fields: { ...current.fields, [field.key]: handle } })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
