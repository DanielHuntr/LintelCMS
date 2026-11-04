import { Check } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";

interface FontPairingChoiceProps {
  pairings: ReadonlyArray<{ id: string; name: string; description: string }>;
  value: string;
  /** Fonts of the site's own are chosen below: no pairing is in use, so none is ticked. */
  usesOwnFonts?: boolean;
  disabled: boolean;
  onChange: (pairingId: string) => void;
}

/** The curated font pairings, as a list of radio buttons. Native radios: arrow keys move. */
export function FontPairingChoice({
  pairings,
  value,
  usesOwnFonts = false,
  disabled,
  onChange,
}: FontPairingChoiceProps) {
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-footnote font-medium text-label">{t("website.fonts")}</legend>
      <div className="flex flex-col overflow-hidden rounded-control bg-fill">
        {pairings.map((pairing) => {
          const checked = !usesOwnFonts && pairing.id === value;
          return (
            <label
              key={pairing.id}
              className={classNames(
                "flex cursor-pointer items-center gap-3 px-4 py-3 not-last:hairline-bottom has-[:focus-visible]:focus-ring-inset",
                checked && "bg-accent/8",
              )}
            >
              <input
                type="radio"
                name="font-pairing"
                value={pairing.id}
                checked={checked}
                onChange={() => onChange(pairing.id)}
                className="sr-only"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body text-label">{pairing.name}</span>
                <span className="text-footnote text-label-secondary">{pairing.description}</span>
              </span>
              <Check
                aria-hidden="true"
                strokeWidth={2.25}
                className={classNames("size-4 shrink-0 text-accent", !checked && "invisible")}
              />
            </label>
          );
        })}
        {usesOwnFonts && (
          <div className="flex items-center gap-3 bg-accent/8 px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body text-label">{t("website.ownFonts")}</span>
              <span className="text-footnote text-label">{t("website.ownFontsHint")}</span>
            </span>
            <Check aria-hidden="true" strokeWidth={2.25} className="size-4 shrink-0 text-accent" />
          </div>
        )}
      </div>
    </fieldset>
  );
}
