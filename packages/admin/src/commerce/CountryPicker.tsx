import { countryCodes } from "@lintel/builder-model";
import { useId, useMemo, useState } from "react";
import { SearchField } from "../design/SearchField.js";
import { t } from "../i18n/strings.js";

/**
 * Every country a shop can sell to (the ISO 3166 list in builder-model's country-codes.ts),
 * with its English name, once each.
 */
function listCountries(): Array<{ code: string; name: string }> {
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  return countryCodes
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

let cachedCountries: Array<{ code: string; name: string }> | undefined;
export function allCountries() {
  cachedCountries ??= listCountries();
  return cachedCountries;
}

interface CountryPickerProps {
  legend: string;
  hint?: string;
  value: string[];
  onChange: (countries: string[]) => void;
  error?: string;
}

/** A searchable list of countries with a tick box each; chosen ones are listed first. */
export function CountryPicker({ legend, hint, value, onChange, error }: CountryPickerProps) {
  const [search, setSearch] = useState("");
  const hintId = useId();
  const countries = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = allCountries().filter(
      (country) =>
        query === "" ||
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase() === query,
    );
    return [
      ...matching.filter((country) => value.includes(country.code)),
      ...matching.filter((country) => !value.includes(country.code)),
    ];
  }, [search, value]);

  function toggle(code: string, checked: boolean) {
    onChange(checked ? [...value, code] : value.filter((chosen) => chosen !== code));
  }

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-1.5 text-footnote font-medium text-label">
        {legend}
        <span className="ms-2 font-normal text-label-secondary">
          {t("shop.countries.chosen", { count: value.length })}
        </span>
      </legend>
      {hint && (
        <p id={hintId} className="text-footnote text-label-secondary">
          {hint}
        </p>
      )}
      <SearchField label={t("shop.countries.search")} value={search} onValueChange={setSearch} />
      <ul className="max-h-56 overflow-y-auto rounded-control bg-fill p-1">
        {countries.map((country) => (
          <li key={country.code}>
            <label className="flex cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 text-body text-label hover:bg-fill-strong">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent-fill)]"
                checked={value.includes(country.code)}
                onChange={(event) => toggle(country.code, event.target.checked)}
              />
              {country.name}
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-footnote text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
