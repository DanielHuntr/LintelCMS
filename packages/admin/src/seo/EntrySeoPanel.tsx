import {
  adviseDescriptionLength,
  adviseTitleLength,
  applyTitleTemplate,
  RECOMMENDED_DESCRIPTION_LENGTH,
  RECOMMENDED_TITLE_LENGTH,
} from "@lintel/core/seo-titles";
import { useEffect, useId, useRef, useState } from "react";
import { describeError } from "../api/describeError.js";
import { entryUrlPreview } from "../content/slug.js";
import { PanelSection } from "../content/PanelSection.js";
import { controlClasses } from "../design/controlStyles.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { MediaPicker } from "../media/MediaPicker.js";
import type { EditorPanelProps } from "../plugins/adminPlugin.js";
import { useCan } from "../session/SessionContext.js";
import type { EntrySeo } from "./seo.api.js";
import { useEntrySeo, useSaveEntrySeo, useSeoDefaults } from "./seo.queries.js";
import { LengthGuidance } from "./LengthGuidance.js";
import { SearchPreview } from "./SearchPreview.js";

const SAVE_DELAY_MILLISECONDS = 800;

/**
 * The editor's "Search engines" panel, from the SEO plugin: a preview of the search
 * result, the title and description with advice on their length, the picture for social
 * networks, and a switch to keep the page out of search results. Saves as you type.
 */
export function EntrySeoPanel({ entryId, entryTitle, slug, collection }: EditorPanelProps) {
  return (
    <PanelSection title={t("seo.panelTitle")}>
      {entryId === undefined ? (
        <p className="text-footnote text-label-secondary">{t("seo.saveFirst")}</p>
      ) : (
        <EntrySeoForm
          entryId={entryId}
          entryTitle={entryTitle}
          slug={slug}
          routePattern={collection.routePattern}
        />
      )}
    </PanelSection>
  );
}

interface EntrySeoFormProps {
  entryId: string;
  entryTitle: string;
  slug: string;
  routePattern: string | null;
}

function EntrySeoForm({ entryId, ...rest }: EntrySeoFormProps) {
  const stored = useEntrySeo(entryId);
  if (stored.isError) {
    return <p className="text-footnote text-danger">{describeError(stored.error)}</p>;
  }
  if (!stored.data) {
    return <p className="text-footnote text-label-secondary">{t("seo.loading")}</p>;
  }
  return <EntrySeoFields key={entryId} entryId={entryId} initial={stored.data} {...rest} />;
}

interface EntrySeoFieldsProps extends EntrySeoFormProps {
  initial: EntrySeo;
}

function EntrySeoFields({ entryId, initial, entryTitle, slug, routePattern }: EntrySeoFieldsProps) {
  const defaults = useSeoDefaults();
  const save = useSaveEntrySeo(entryId);
  const { mutate: saveSeo } = save;
  const canEdit = useCan("entries:update");
  const [seo, setSeo] = useState<EntrySeo>(initial);
  const lastSaved = useRef(JSON.stringify(initial));
  const titleId = useId();
  const titleAdviceId = useId();
  const descriptionId = useId();
  const descriptionAdviceId = useId();

  // Saves a moment after typing stops, like the rest of the editor.
  useEffect(() => {
    const changed = JSON.stringify(seo);
    if (!canEdit || changed === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = changed;
      saveSeo(seo);
    }, SAVE_DELAY_MILLISECONDS);
    return () => clearTimeout(timer);
  }, [seo, canEdit, saveSeo]);

  const siteName = defaults.data?.siteName ?? "";
  const template = defaults.data?.titleTemplate ?? "{title}";
  const fullTitle = applyTitleTemplate(template, seo.title || entryTitle, siteName);
  const description = seo.description || defaults.data?.defaultDescription || "";
  const path = routePattern ? entryUrlPreview(routePattern, slug) : `/${slug}`;
  const address = defaults.data?.siteUrl ? `${defaults.data.siteUrl}${path}` : path;
  const change = (changes: Partial<EntrySeo>) => setSeo({ ...seo, ...changes });

  return (
    <div className="flex flex-col gap-4">
      <SearchPreview title={fullTitle} url={address} description={description} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className="text-footnote font-medium text-label">
          {t("seo.titleLabel")}
        </label>
        <input
          id={titleId}
          value={seo.title}
          placeholder={entryTitle}
          maxLength={200}
          disabled={!canEdit}
          aria-describedby={titleAdviceId}
          onChange={(event) => change({ title: event.target.value })}
          className={`h-9 ${controlClasses()}`}
        />
        <LengthGuidance
          id={titleAdviceId}
          kind="title"
          length={fullTitle.length}
          recommended={RECOMMENDED_TITLE_LENGTH}
          advice={adviseTitleLength(fullTitle)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={descriptionId} className="text-footnote font-medium text-label">
          {t("seo.descriptionLabel")}
        </label>
        <textarea
          id={descriptionId}
          value={seo.description}
          placeholder={defaults.data?.defaultDescription || t("seo.descriptionPlaceholder")}
          maxLength={500}
          rows={4}
          disabled={!canEdit}
          aria-describedby={descriptionAdviceId}
          onChange={(event) => change({ description: event.target.value })}
          className={`min-h-20 resize-y py-2 text-footnote ${controlClasses()}`}
        />
        <LengthGuidance
          id={descriptionAdviceId}
          kind="description"
          length={description.length}
          recommended={RECOMMENDED_DESCRIPTION_LENGTH}
          advice={adviseDescriptionLength(description)}
        />
      </div>

      <MediaPicker
        label={t("seo.socialImageLabel")}
        value={seo.socialImageId}
        onChange={(socialImageId) => change({ socialImageId })}
      />

      <Toggle
        label={t("seo.noindexLabel")}
        checked={seo.noindex}
        disabled={!canEdit}
        onCheckedChange={(noindex) => change({ noindex })}
      />

      <p role="status" className="text-caption text-label-secondary">
        {save.isError
          ? describeError(save.error)
          : save.isPending
            ? t("seo.saving")
            : save.isSuccess
              ? t("seo.saved")
              : ""}
      </p>
    </div>
  );
}
