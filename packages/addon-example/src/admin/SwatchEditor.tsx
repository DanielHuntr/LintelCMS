import type { FieldEditorProps } from "@lintel/admin/plugin";
import { t } from "./strings.js";

/**
 * The Colour swatch field: the palette's colours as round buttons, chosen like radio
 * buttons; a field without a palette offers any colour with the browser's colour picker.
 */
export function SwatchEditor({ field, value, onChange, controlId, describedBy }: FieldEditorProps) {
  const chosen = typeof value === "string" ? value.toLowerCase() : "";
  const palette = readPalette(field.options);

  if (palette.length === 0) {
    return (
      <input
        id={controlId}
        type="color"
        aria-describedby={describedBy}
        value={chosen || "#000000"}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: 56, height: 36, border: 0, background: "none", padding: 0 }}
      />
    );
  }

  return (
    <div
      id={controlId}
      role="radiogroup"
      aria-describedby={describedBy}
      style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
    >
      {palette.map((hex) => (
        <label key={hex} style={{ position: "relative", cursor: "pointer" }}>
          <input
            type="radio"
            name={field.handle}
            value={hex}
            checked={chosen === hex}
            onChange={() => onChange(hex)}
            aria-label={t("swatch.choose", { hex })}
            style={{ position: "absolute", opacity: 0, inset: 0, margin: 0 }}
          />
          <span
            aria-hidden="true"
            style={{
              display: "block",
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: hex,
              boxShadow:
                chosen === hex
                  ? "0 0 0 2px var(--color-background, #fff), 0 0 0 4px var(--color-accent, #0a66d8)"
                  : "inset 0 0 0 1px rgb(0 0 0 / 0.15)",
            }}
          />
        </label>
      ))}
    </div>
  );
}

function readPalette(options: object): string[] {
  const palette = "palette" in options ? options.palette : undefined;
  return Array.isArray(palette)
    ? palette
        .filter((hex): hex is string => typeof hex === "string")
        .map((hex) => hex.toLowerCase())
    : [];
}
