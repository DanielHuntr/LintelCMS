import { useId } from "react";
import { t } from "../i18n/strings.js";
import type { Site } from "./sites.types.js";

interface SiteChecklistProps {
  /** Read by screen readers, and shown as the group's heading. */
  legend: string;
  sites: readonly Site[];
  /** The chosen handles; null for every site, including any added later. */
  chosen: readonly string[] | null;
  onChange: (chosen: string[] | null) => void;
  disabled?: boolean;
}

/**
 * "Every site", or a tick for each site. Unticking the last one isn't possible: something
 * on no site at all would simply vanish.
 */
export function SiteChecklist({ legend, sites, chosen, onChange, disabled }: SiteChecklistProps) {
  const everyId = useId();
  const isEvery = chosen === null;

  function toggle(handle: string, checked: boolean) {
    const current = chosen ?? sites.map((site) => site.handle);
    const next = checked ? [...current, handle] : current.filter((other) => other !== handle);
    if (next.length === 0) return;
    onChange(next.length === sites.length ? null : next);
  }

  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      <label htmlFor={everyId} className="flex items-center gap-2 text-body text-label">
        <input
          id={everyId}
          type="checkbox"
          checked={isEvery}
          onChange={(event) =>
            onChange(event.target.checked ? null : sites.map((site) => site.handle))
          }
          className="size-4 accent-accent"
        />
        {t("sites.everySite")}
      </label>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-6">
        {sites.map((site) => {
          const checked = isEvery || chosen.includes(site.handle);
          return (
            <label key={site.handle} className="flex items-center gap-2 text-footnote text-label">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => toggle(site.handle, event.target.checked)}
                className="size-4 accent-accent"
              />
              {site.name}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
