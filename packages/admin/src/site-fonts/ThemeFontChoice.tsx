import { fontCatalogue } from "@lintel/builder-model";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useId } from "react";
import { controlClasses } from "../design/controlStyles.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { useSiteFonts } from "./siteFonts.queries.js";

interface ThemeFontChoiceProps {
  headingFont: string | null;
  bodyFont: string | null;
  disabled: boolean;
  onChange: (changes: { headingFont?: string | null; bodyFont?: string | null }) => void;
}

/**
 * Under the font pairings: a font of the site's own (or an included one) for headings and
 * for body text, in place of the pairing's. Left as "As the pairing above", nothing changes.
 * A link leads to the site's fonts, to add one.
 */
export function ThemeFontChoice({
  headingFont,
  bodyFont,
  disabled,
  onChange,
}: ThemeFontChoiceProps) {
  const siteFonts = useSiteFonts();
  const own = siteFonts.data?.fonts.map((font) => font.family) ?? [];
  const included = fontCatalogue
    .map((font) => font.family)
    .filter((family) => !own.includes(family));
  const options = { own, included };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <FontSelect
          label={t("siteFonts.theme.heading")}
          value={headingFont}
          disabled={disabled}
          options={options}
          onChange={(family) => onChange({ headingFont: family })}
        />
        <FontSelect
          label={t("siteFonts.theme.body")}
          value={bodyFont}
          disabled={disabled}
          options={options}
          onChange={(family) => onChange({ bodyFont: family })}
        />
      </div>
      <Link
        to="/settings/site/fonts"
        className="flex items-center gap-0.5 self-start rounded-control text-footnote font-medium text-accent hover:underline focus-visible:focus-ring"
      >
        {t("siteFonts.manage")}
        <ChevronRight aria-hidden="true" className="size-3.5" />
      </Link>
    </div>
  );
}

function FontSelect({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  disabled: boolean;
  options: { own: string[]; included: string[] };
  onChange: (family: string | null) => void;
}) {
  const id = useId();
  const known = value === null || options.own.includes(value) || options.included.includes(value);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-footnote font-medium text-label">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className={classNames("h-10", controlClasses())}
      >
        <option value="">{t("siteFonts.theme.fromPairing")}</option>
        {!known && value && <option value={value}>{value}</option>}
        {options.own.length > 0 && (
          <optgroup label={t("siteFonts.theme.siteFonts")}>
            {options.own.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label={t("siteFonts.theme.included")}>
          {options.included.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
