import { ChevronsUpDown, Languages } from "lucide-react";
import { useId } from "react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import { useLocales } from "./locales.queries.js";

interface LocalePickerProps {
  /** Undefined means the site's main language. */
  value: string | undefined;
  onChange: (locale: string) => void;
}

/**
 * Which language to show, for screens that hold content in every language. Sites with only
 * one language never see it.
 */
export function LocalePicker({ value, onChange }: LocalePickerProps) {
  const locales = useLocales();
  const selectId = useId();
  const siteLocales = locales.data?.locales ?? [];
  if (!locales.data || siteLocales.length < 2) return null;

  return (
    <div className="relative flex items-center">
      <label htmlFor={selectId} className="sr-only">
        {t("locales.pickerLabel")}
      </label>
      <Languages
        aria-hidden="true"
        strokeWidth={1.75}
        className="pointer-events-none absolute inset-s-3 size-4 text-label-secondary"
      />
      <select
        id={selectId}
        value={value ?? locales.data.defaultLocale}
        onChange={(event) => onChange(event.target.value)}
        className={classNames("h-9 w-auto appearance-none pe-9 ps-9", controlClasses())}
      >
        {siteLocales.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        aria-hidden="true"
        strokeWidth={2}
        className="pointer-events-none absolute inset-e-3 size-4 text-label-secondary"
      />
    </div>
  );
}
