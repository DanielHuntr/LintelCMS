import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Info, Shapes } from "lucide-react";
import { useState } from "react";
import { ApiError, type FieldMessages } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { isSameValue } from "../content/sameValue.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { FieldEditor } from "../fields/FieldEditor.js";
import type { EntryData } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { LocalePicker } from "../locales/LocalePicker.js";
import { useLocaleName, useLocales } from "../locales/locales.queries.js";
import { useCan } from "../session/SessionContext.js";
import { saveGlobalValues } from "./globals.api.js";
import { globalKeys, useGlobalSet } from "./globals.queries.js";
import type { GlobalSet } from "./globals.types.js";

/** /content/globals/:handle: one global set's values, in each of the site's languages. */
export function GlobalSetPage({ handle }: { handle: string }) {
  const [locale, setLocale] = useState<string | undefined>(undefined);
  const globalSet = useGlobalSet(handle, locale);

  if (globalSet.isError) {
    return <LoadError error={globalSet.error} onRetry={() => void globalSet.refetch()} />;
  }
  if (!globalSet.data) {
    return (
      <LoadingRegion label={t("globals.loading")}>
        <Skeleton className="mb-8 h-10 w-56" />
        <Skeleton className="h-64 rounded-panel" />
      </LoadingRegion>
    );
  }
  return (
    <GlobalValuesForm
      // A fresh form for each language, so one language's typing never leaks into another.
      key={`${globalSet.data.handle}:${globalSet.data.locale}`}
      globalSet={globalSet.data}
      onLocaleChange={setLocale}
    />
  );
}

function GlobalValuesForm({
  globalSet,
  onLocaleChange,
}: {
  globalSet: GlobalSet;
  onLocaleChange: (locale: string) => void;
}) {
  const queryClient = useQueryClient();
  const canSave = useCan("globals:update");
  const canEditFields = useCan("blueprints:update");
  const localeName = useLocaleName();
  const locales = useLocales();
  const [saved, setSaved] = useState<EntryData>(globalSet.data);
  const [data, setData] = useState<EntryData>(globalSet.data);
  const [errors, setErrors] = useState<FieldMessages>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasOwnValues, setHasOwnValues] = useState(globalSet.hasOwnValues);
  const isUnsaved = !isSameValue(saved, data);
  const leaveWarning = useLeaveWarning(isUnsaved);
  const defaultLocale = locales.data?.defaultLocale;
  const isFallingBack =
    !hasOwnValues && defaultLocale !== undefined && globalSet.locale !== defaultLocale;

  async function save() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await saveGlobalValues(globalSet.handle, globalSet.locale, data);
      queryClient.setQueryData(globalKeys.globalSet(globalSet.handle, globalSet.locale), updated);
      setSaved(updated.data);
      setData(updated.data);
      setHasOwnValues(true);
      setErrors({});
    } catch (error) {
      setErrors(error instanceof ApiError ? (error.fields ?? {}) : {});
      setSaveError(describeError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <BackLink to="/content/globals">{t("globals.title")}</BackLink>
      <LargeTitle
        title={globalSet.name}
        subtitle={t("globals.setSubtitle")}
        actions={
          <>
            <LocalePicker value={globalSet.locale} onChange={onLocaleChange} />
            {canEditFields && (
              <LinkButton
                to="/content/globals/$handle/fields"
                params={{ handle: globalSet.handle }}
                variant="tinted"
              >
                {t("globals.editFields")}
              </LinkButton>
            )}
            {canSave && globalSet.fields.length > 0 && (
              <Button onClick={() => void save()} disabled={isSaving || !isUnsaved}>
                {isSaving ? t("builder.saving") : t("globals.save")}
              </Button>
            )}
          </>
        }
      />

      {saveError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
        >
          <CircleAlert
            aria-hidden="true"
            strokeWidth={2}
            className="mt-px size-4 shrink-0 text-danger"
          />
          <p>{saveError}</p>
        </div>
      )}
      {isFallingBack && defaultLocale && (
        <div className="mb-6 flex items-start gap-2.5 rounded-card bg-accent/10 px-4 py-3 text-footnote text-label">
          <Info aria-hidden="true" strokeWidth={2} className="mt-px size-4 shrink-0 text-accent" />
          <p>
            {t("globals.fallbackNotice", {
              language: localeName(globalSet.locale),
              main: localeName(defaultLocale),
            })}
          </p>
        </div>
      )}

      {globalSet.fields.length === 0 ? (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={Shapes}
            title={t("globals.noFieldsTitle")}
            description={t("globals.noFieldsDescription")}
            action={
              canEditFields && (
                <LinkButton
                  to="/content/globals/$handle/fields"
                  params={{ handle: globalSet.handle }}
                >
                  {t("globals.editFields")}
                </LinkButton>
              )
            }
          />
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="flex max-w-[46rem] flex-col gap-7 rounded-panel bg-surface px-9 pt-8 pb-10"
        >
          <fieldset disabled={!canSave} className="contents">
            {globalSet.fields.map((field) => (
              <FieldEditor
                key={field.handle}
                field={field}
                value={data[field.handle]}
                error={errors[field.handle]}
                onChange={(fieldHandle, value) =>
                  setData((current) => ({ ...current, [fieldHandle]: value }))
                }
              />
            ))}
          </fieldset>
        </form>
      )}

      <ConfirmDialog
        open={leaveWarning.isAsking}
        title={t("editor.leaveTitle")}
        message={t("globals.leaveMessage")}
        confirmLabel={t("editor.leave")}
        cancelLabel={t("editor.stay")}
        isDestructive
        onCancel={leaveWarning.stay}
        onConfirm={leaveWarning.leave}
      />
    </>
  );
}
