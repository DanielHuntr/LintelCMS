import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { controlClasses } from "../design/controlStyles.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import {
  choosableInterfaceLanguages,
  closestInterfaceLanguage,
} from "../i18n/interfaceLanguages.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { InterfaceLanguageChoice } from "./interfaceLanguage.api.js";
import {
  useChoosePersonalLanguage,
  useChooseSiteDefaultLanguage,
  useInterfaceLanguageChoice,
} from "./interfaceLanguage.queries.js";

/**
 * Which picker was just used. Switching language draws the admin afresh, so this brings
 * focus back to that picker and says the change was saved.
 */
let justChanged: "personal" | "site" | null = null;

/** /settings/interface-language: your own language for the admin, and the site's default. */
export function InterfaceLanguagePage() {
  const choice = useInterfaceLanguageChoice();

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("interfaceLanguage.title")} subtitle={t("interfaceLanguage.subtitle")} />
      {choice.isError && <LoadError error={choice.error} onRetry={() => void choice.refetch()} />}
      {choice.isPending && (
        <LoadingRegion label={t("interfaceLanguage.loading")}>
          <Skeleton className="h-48 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {choice.data && <LanguageForm choice={choice.data} />}
    </>
  );
}

function LanguageForm({ choice }: { choice: InterfaceLanguageChoice }) {
  const canChangeSite = useCan("settings:update");
  const choosePersonal = useChoosePersonalLanguage();
  const chooseSite = useChooseSiteDefaultLanguage();
  const languages = choosableInterfaceLanguages();
  const siteDefaultName = closestInterfaceLanguage(choice.siteDefault).nativeName;
  const [changed] = useState(justChanged);

  useEffect(() => {
    justChanged = null;
  }, []);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <LanguagePicker
        label={t("interfaceLanguage.personal")}
        hint={t("interfaceLanguage.personalHint")}
        value={choice.personal ?? ""}
        focusOnMount={changed === "personal"}
        status={statusText(changed === "personal", choosePersonal)}
        onChange={(value) => {
          justChanged = "personal";
          choosePersonal.mutate(value === "" ? null : value);
        }}
      >
        <option value="">{t("interfaceLanguage.followSite", { language: siteDefaultName })}</option>
        {languages.map((language) => (
          <option key={language.code} value={language.code} lang={language.code}>
            {language.nativeName}
          </option>
        ))}
      </LanguagePicker>

      {canChangeSite && (
        <LanguagePicker
          label={t("interfaceLanguage.siteDefault")}
          hint={t("interfaceLanguage.siteDefaultHint")}
          value={closestInterfaceLanguage(choice.siteDefault).code}
          focusOnMount={changed === "site"}
          status={statusText(changed === "site", chooseSite)}
          onChange={(value) => {
            justChanged = "site";
            chooseSite.mutate(value);
          }}
        >
          {languages.map((language) => (
            <option key={language.code} value={language.code} lang={language.code}>
              {language.nativeName}
            </option>
          ))}
        </LanguagePicker>
      )}

      <p className="text-footnote text-label-secondary">{t("interfaceLanguage.contentNote")}</p>
    </div>
  );
}

function statusText(
  wasJustChanged: boolean,
  mutation: { isError: boolean; error: unknown; isPending: boolean; isSuccess: boolean },
): string {
  if (mutation.isError) return describeError(mutation.error);
  if (mutation.isPending) return t("interfaceLanguage.saving");
  return wasJustChanged || mutation.isSuccess ? t("interfaceLanguage.saved") : "";
}

function LanguagePicker({
  label,
  hint,
  value,
  status,
  focusOnMount,
  onChange,
  children,
}: {
  label: string;
  hint: string;
  value: string;
  status: string;
  focusOnMount: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  const select = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (focusOnMount) select.current?.focus();
  }, [focusOnMount]);

  return (
    <div className="flex flex-col gap-1.5 rounded-card bg-surface p-6">
      <label htmlFor={id} className="text-headline text-label">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-footnote text-label-secondary">
        {hint}
      </p>
      <select
        ref={select}
        id={id}
        value={value}
        aria-describedby={`${id}-hint ${id}-status`}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 ${controlClasses()}`}
      >
        {children}
      </select>
      <p
        id={`${id}-status`}
        role="status"
        className="min-h-[1.125rem] text-footnote text-label-secondary"
      >
        {status}
      </p>
    </div>
  );
}
