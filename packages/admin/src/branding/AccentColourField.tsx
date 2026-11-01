import { accentShades, normaliseHexColour } from "@lintel/core/accent-colours";
import { TriangleAlert } from "lucide-react";
import { useId, useState, type CSSProperties } from "react";
import { TextField } from "../design/TextField.js";
import { formatNumber } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";

interface AccentColourFieldProps {
  value: string;
  onChange: (colour: string) => void;
  disabled?: boolean;
}

/**
 * The accent colour, with a preview of buttons and links in light and dark mode and a
 * warning when text on it would be hard to read. Link and hover shades are worked out
 * automatically (see @lintel/core/accent-colours).
 */
export function AccentColourField({ value, onChange, disabled = false }: AccentColourFieldProps) {
  const [typed, setTyped] = useState(value);
  const pickerId = useId();
  const warningId = useId();
  const shades = accentShades(value);
  const typedIsColour = normaliseHexColour(typed) !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={pickerId} className="text-footnote font-medium text-label">
            {t("branding.accent.picker")}
          </label>
          <input
            id={pickerId}
            type="color"
            value={value}
            disabled={disabled}
            onChange={(event) => {
              setTyped(event.target.value);
              onChange(event.target.value);
            }}
            className="h-10 w-14 cursor-pointer rounded-control bg-fill p-1 focus-visible:focus-ring"
          />
        </div>
        <TextField
          label={t("branding.accent.label")}
          value={typed}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          className="w-40"
          error={typedIsColour ? undefined : t("branding.accent.invalid")}
          onChange={(event) => {
            setTyped(event.target.value);
            const colour = normaliseHexColour(event.target.value);
            if (colour) onChange(colour);
          }}
        />
      </div>

      <AccentPreview colour={value} />

      {shades.fillIsReadable ? (
        <p className="text-footnote text-label-secondary">
          {t("branding.accent.readable", { ratio: formatNumber(shades.fillContrast) })}
        </p>
      ) : (
        <p id={warningId} role="alert" className="flex gap-2 text-footnote text-warning">
          <TriangleAlert aria-hidden="true" strokeWidth={2} className="size-4 shrink-0" />
          {t("branding.accent.hardToRead", { ratio: formatNumber(shades.fillContrast) })}
        </p>
      )}
    </div>
  );
}

/** A filled button, a tinted button and a link in the colour, on light and dark surfaces. */
function AccentPreview({ colour }: { colour: string }) {
  const shades = accentShades(colour);

  return (
    <div
      role="group"
      aria-label={t("branding.accent.preview")}
      className="grid gap-3 sm:grid-cols-2"
    >
      {(["light", "dark"] as const).map((scheme) => (
        <div
          key={scheme}
          data-color-scheme={scheme}
          style={
            {
              "--color-accent": scheme === "dark" ? shades.textDark : shades.text,
              "--color-accent-fill": shades.fill,
              "--color-on-accent": shades.onFill,
            } as CSSProperties
          }
          className="flex flex-wrap items-center gap-3 rounded-card bg-background p-4 hairline-ring"
        >
          <span className="inline-flex h-9 items-center rounded-control bg-accent-fill px-4 text-body font-medium text-on-accent">
            {t("branding.accent.sampleButton")}
          </span>
          <span className="inline-flex h-9 items-center rounded-control bg-accent/12 px-4 text-body font-medium text-accent">
            {t("branding.accent.sampleTinted")}
          </span>
          <span className="text-body text-accent underline">{t("branding.accent.sampleLink")}</span>
        </div>
      ))}
    </div>
  );
}
