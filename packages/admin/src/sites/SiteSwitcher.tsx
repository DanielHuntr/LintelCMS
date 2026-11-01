import { useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, Globe } from "lucide-react";
import { useId } from "react";
import { t } from "../i18n/strings.js";
import { useCurrentSite } from "./SiteContext.js";

/**
 * The top of the sidebar: which site is being worked on, and a way to switch. Hidden while
 * there is only one site, so a single-site install looks exactly as it always has.
 *
 * A native select, so it works the same with a keyboard, a screen reader or a touch screen.
 */
export function SiteSwitcher() {
  const current = useCurrentSite();
  const location = useLocation();
  const navigate = useNavigate();
  const selectId = useId();
  if (!current?.hasSeveralSites) return null;

  async function switchTo(handle: string) {
    if (!current || handle === current.site.handle) return;
    // An open entry belongs to the old site; go back to its collection on the new one.
    const editing = /^\/content\/([^/]+)\/[^/]+$/.exec(location.pathname);
    await current.switchSite(handle);
    if (editing?.[1] && !["taxonomies", "globals", "navigation"].includes(editing[1])) {
      await navigate({ to: "/content/$collection", params: { collection: editing[1] } });
    }
  }

  return (
    <div className="flex flex-col gap-1 px-2.5 pb-3">
      <label htmlFor={selectId} className="px-1 text-caption font-medium text-label-secondary">
        {t("sites.switcher.label")}
      </label>
      <div className="relative">
        <Globe
          aria-hidden="true"
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-accent"
        />
        <select
          id={selectId}
          value={current.site.handle}
          onChange={(event) => void switchTo(event.target.value)}
          className="h-9 w-full appearance-none truncate rounded-control bg-fill/70 pr-8 pl-8 text-body font-medium text-label transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
        >
          {current.sites.map((site) => (
            <option key={site.handle} value={site.handle}>
              {site.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          aria-hidden="true"
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-label-secondary"
        />
      </div>
    </div>
  );
}
