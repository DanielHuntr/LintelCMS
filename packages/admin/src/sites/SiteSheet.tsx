import { ChevronsUpDown } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { commonLocaleCodes, describeLanguage } from "../locales/commonLocales.js";
import { draftFromSite, emptySiteDraft, renameDraft, type SiteDraft } from "./siteForm.js";
import type { Site } from "./sites.types.js";

interface SiteSheetProps {
  /** The site to change; left out to add a new one. */
  site?: Site;
  onSave: (draft: SiteDraft) => Promise<void>;
  onClose: () => void;
}

/**
 * Adding or changing a site: its name, where it lives on the web and its languages. Only
 * the name is needed to start; everything else has a sensible default and a hint.
 */
export function SiteSheet({ site, onSave, onClose }: SiteSheetProps) {
  const [draft, setDraft] = useState<SiteDraft>(() =>
    site ? draftFromSite(site) : emptySiteDraft(),
  );
  const [problem, setProblem] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const languageId = useId();
  const extrasId = useId();
  const isNew = site === undefined;
  const languages = isNew
    ? commonLocaleCodes.map((code) => ({ code, name: describeLanguage(code) }))
    : site.locales;

  const change = (changes: Partial<SiteDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (draft.name.trim() === "") {
      setProblem(t("sites.problem.name"));
      return;
    }
    setIsSaving(true);
    setProblem(undefined);
    try {
      await onSave(draft);
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? t("sites.addTitle") : t("sites.editTitle", { name: site.name })}
      description={isNew ? t("sites.addDescription") : undefined}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={isSaving}>
            {isNew ? t("sites.add") : t("common.done")}
          </Button>
        </>
      }
    >
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5 pt-2 pb-1">
        {problem && (
          <p role="alert" className="rounded-card bg-danger/10 px-4 py-3 text-footnote text-label">
            {problem}
          </p>
        )}
        <TextField
          label={t("sites.name")}
          hint={t("sites.nameHint")}
          value={draft.name}
          data-autofocus
          onChange={(event) => setDraft((current) => renameDraft(current, event.target.value))}
        />
        {isNew && (
          <TextField
            label={t("sites.handle")}
            hint={t("sites.handleHint")}
            value={draft.handle}
            spellCheck={false}
            autoCapitalize="off"
            className="[&_input]:font-mono"
            onChange={(event) => change({ handle: event.target.value, handleEdited: true })}
          />
        )}
        <TextField
          label={t("sites.domains")}
          hint={t("sites.domainsHint")}
          value={draft.domains}
          spellCheck={false}
          autoCapitalize="off"
          placeholder="www.example.com"
          onChange={(event) => change({ domains: event.target.value })}
        />
        <TextField
          label={t("sites.pathPrefix")}
          hint={t("sites.pathPrefixHint")}
          value={draft.pathPrefix}
          spellCheck={false}
          autoCapitalize="off"
          placeholder="/fr"
          onChange={(event) => change({ pathPrefix: event.target.value })}
        />
        <TextField
          label={t("sites.siteUrl")}
          hint={t("sites.siteUrlHint")}
          value={draft.siteUrl}
          inputMode="url"
          spellCheck={false}
          autoCapitalize="off"
          placeholder="https://"
          onChange={(event) => change({ siteUrl: event.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={languageId} className="text-footnote font-medium text-label">
            {t("sites.mainLanguage")}
          </label>
          <div className="relative">
            <select
              id={languageId}
              value={draft.defaultLocale}
              onChange={(event) => change({ defaultLocale: event.target.value })}
              className={classNames("h-10 appearance-none pr-9", controlClasses())}
            >
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
            <ChevronsUpDown
              aria-hidden="true"
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-label-secondary"
            />
          </div>
          {!isNew && (
            <p className="text-footnote text-label-secondary">{t("sites.mainLanguageHint")}</p>
          )}
        </div>
        {isNew && (
          <fieldset className="flex flex-col gap-2" aria-describedby={extrasId}>
            <legend className="text-footnote font-medium text-label">
              {t("sites.extraLanguages")}
            </legend>
            <p id={extrasId} className="-mt-1 text-footnote text-label-secondary">
              {t("sites.extraLanguagesHint")}
            </p>
            <div className="grid max-h-40 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto rounded-control bg-fill/50 p-3">
              {languages
                .filter((language) => language.code !== draft.defaultLocale)
                .map((language) => (
                  <label
                    key={language.code}
                    className="flex items-center gap-2 text-body text-label"
                  >
                    <input
                      type="checkbox"
                      checked={draft.extraLocales.includes(language.code)}
                      onChange={(event) =>
                        change({
                          extraLocales: event.target.checked
                            ? [...draft.extraLocales, language.code]
                            : draft.extraLocales.filter((code) => code !== language.code),
                        })
                      }
                      className="size-4 accent-accent"
                    />
                    {language.name}
                  </label>
                ))}
            </div>
          </fieldset>
        )}
        <TextField
          label={t("sites.accentColor")}
          hint={t("sites.accentColorHint")}
          value={draft.accentColor}
          spellCheck={false}
          autoCapitalize="off"
          placeholder="#7539fd"
          className="[&_input]:font-mono"
          onChange={(event) => change({ accentColor: event.target.value })}
        />
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
