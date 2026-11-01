import { applyTitleTemplate } from "@lintel/core/seo-titles";
import { ArrowRightLeft, FileCode2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { apiUrl } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { controlClasses } from "../design/controlStyles.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { MediaPicker } from "../media/MediaPicker.js";
import { useCan } from "../session/SessionContext.js";
import type { SeoDefaults } from "./seo.api.js";
import { useRedirects, useSeoDefaults, useUpdateSeoDefaults } from "./seo.queries.js";

/** /settings/seo: what search engines see by default, and where the sitemap lives. */
export function SeoSettingsPage() {
  const defaults = useSeoDefaults();

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("seo.settingsTitle")} subtitle={t("seo.settingsSubtitle")} />
      {defaults.isError && (
        <LoadError error={defaults.error} onRetry={() => void defaults.refetch()} />
      )}
      {defaults.isPending && (
        <LoadingRegion label={t("seo.loading")}>
          <Skeleton className="h-80 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {defaults.data && <SeoDefaultsForm initial={defaults.data} />}
    </>
  );
}

function SeoDefaultsForm({ initial }: { initial: SeoDefaults }) {
  const [values, setValues] = useState(initial);
  const update = useUpdateSeoDefaults();
  const redirects = useRedirects();
  const canChange = useCan("settings:update");
  const suggestions =
    redirects.data?.filter((redirect) => redirect.status === "suggested").length ?? 0;
  const change = (changes: Partial<SeoDefaults>) => {
    update.reset();
    setValues({ ...values, ...changes });
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    update.mutate(values);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <form onSubmit={submit} className="flex flex-col gap-5 rounded-card bg-surface p-6">
        <TextField
          label={t("seo.siteName")}
          hint={t("seo.siteNameHint")}
          value={values.siteName}
          maxLength={100}
          disabled={!canChange}
          onChange={(event) => change({ siteName: event.target.value })}
        />
        <TextField
          label={t("seo.siteUrl")}
          hint={t("seo.siteUrlHint")}
          placeholder="https://www.example.com"
          type="url"
          inputMode="url"
          value={values.siteUrl}
          disabled={!canChange}
          onChange={(event) => change({ siteUrl: event.target.value })}
        />
        <TextField
          label={t("seo.titleTemplate")}
          hint={t("seo.titleTemplateHint", {
            example: applyTitleTemplate(
              values.titleTemplate,
              t("seo.exampleTitle"),
              values.siteName,
            ),
          })}
          value={values.titleTemplate}
          maxLength={200}
          disabled={!canChange}
          onChange={(event) => change({ titleTemplate: event.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="seo-default-description" className="text-footnote font-medium text-label">
            {t("seo.defaultDescription")}
          </label>
          <textarea
            id="seo-default-description"
            value={values.defaultDescription}
            maxLength={300}
            rows={3}
            disabled={!canChange}
            aria-describedby="seo-default-description-hint"
            onChange={(event) => change({ defaultDescription: event.target.value })}
            className={`min-h-20 resize-y py-2 ${controlClasses()}`}
          />
          <p id="seo-default-description-hint" className="text-footnote text-label-secondary">
            {t("seo.defaultDescriptionHint")}
          </p>
        </div>
        <MediaPicker
          label={t("seo.defaultSocialImage")}
          value={values.defaultSocialImageId}
          onChange={(defaultSocialImageId) => change({ defaultSocialImageId })}
        />
        <Toggle
          label={t("seo.discourage")}
          checked={values.discourageSearchEngines}
          disabled={!canChange}
          describedBy="seo-discourage-hint"
          onCheckedChange={(discourageSearchEngines) => change({ discourageSearchEngines })}
        />
        <p id="seo-discourage-hint" className="-mt-3 text-footnote text-label-secondary">
          {t("seo.discourageHint")}
        </p>
        {canChange && (
          <div className="flex items-center justify-end gap-3">
            <p role="status" className="text-footnote text-label-secondary">
              {update.isError ? (
                <span className="text-danger">{describeError(update.error)}</span>
              ) : update.isSuccess ? (
                t("seo.saved")
              ) : (
                ""
              )}
            </p>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? t("seo.saving") : t("seo.save")}
            </Button>
          </div>
        )}
      </form>

      <GroupedList header={t("seo.moreHeader")} footer={t("seo.filesFooter")}>
        <GroupedListRow
          icon={ArrowRightLeft}
          label={t("redirects.title")}
          description={t("redirects.rowDescription")}
          accessory={
            suggestions > 0 && (
              <Badge tone="warning">{t("redirects.suggestionCount", { count: suggestions })}</Badge>
            )
          }
          to="/settings/seo/redirects"
        />
        <GroupedListRow
          icon={FileCode2}
          iconTone="neutral"
          label="sitemap.xml"
          description={`${apiUrl}/sitemap.xml`}
        />
        <GroupedListRow
          icon={FileCode2}
          iconTone="neutral"
          label="robots.txt"
          description={`${apiUrl}/robots.txt`}
        />
      </GroupedList>
    </div>
  );
}
