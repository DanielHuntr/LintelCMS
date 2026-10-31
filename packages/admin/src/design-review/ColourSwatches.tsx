import { classNames } from "../design/classNames.js";

/*
 * The names shown here are the token names from styles.css: code, not words for editors,
 * so they are not translated.
 */
const swatches = [
  { token: "background", className: "bg-background" },
  { token: "surface", className: "bg-surface" },
  { token: "fill", className: "bg-fill" },
  { token: "separator", className: "bg-separator" },
  { token: "label", className: "bg-label" },
  { token: "label-secondary", className: "bg-label-secondary" },
  { token: "accent", className: "bg-accent" },
  { token: "accent-fill", className: "bg-accent-fill" },
  { token: "success", className: "bg-success" },
  { token: "warning", className: "bg-warning" },
  { token: "danger", className: "bg-danger" },
] as const;

export function ColourSwatches() {
  return (
    <ul className="grid grid-cols-4 gap-3">
      {swatches.map((swatch) => (
        <li key={swatch.token} className="flex flex-col gap-1.5">
          <span className={classNames("h-11 rounded-control hairline-ring", swatch.className)} />
          <code className="truncate text-caption text-label-secondary">{swatch.token}</code>
        </li>
      ))}
    </ul>
  );
}
