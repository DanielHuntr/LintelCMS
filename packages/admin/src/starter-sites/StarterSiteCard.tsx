import { BlueprintSketch } from "@lintel/builder";
import type { StarterSite } from "@lintel/builder-model";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";

interface StarterSiteCardProps {
  site: StarterSite;
  /** Where the website serves its illustrations from; without it, a sketch of the home page. */
  siteAddress: string | null;
  onUse: () => void;
}

/** One template in the library: its picture, who it suits, its pages and colours. */
export function StarterSiteCard({ site, siteAddress, onUse }: StarterSiteCardProps) {
  const home = site.pages[0];
  const headingId = `template-${site.id}`;
  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col overflow-hidden rounded-card bg-surface shadow-float hairline-ring"
    >
      {siteAddress ? (
        <img
          src={`${siteAddress}/_lintel/illustrations/${site.coverIllustration}.svg`}
          alt=""
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        home && (
          <div className="p-3">
            <BlueprintSketch blueprint={{ type: "page", children: home.sections.slice(0, 3) }} />
          </div>
        )
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 id={headingId} className="text-headline text-label">
          {site.name}
        </h2>
        <p className="text-footnote text-label-secondary">{site.description}</p>
        <p className="text-caption text-label-secondary">
          {t("templates.suitedTo", { who: site.suitedTo.toLowerCase() })}
        </p>
        <p className="text-caption text-label-secondary">
          {t("templates.pages", { pages: site.pages.map((page) => page.title).join(" · ") })}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-caption text-label-secondary">{t("templates.colours")}</span>
          {[site.theme.brandColour, site.theme.accentColour].map((colour) => (
            <span
              key={colour}
              aria-hidden="true"
              className="size-4 rounded-full hairline-ring"
              style={{ backgroundColor: colour }}
            />
          ))}
        </div>
        <div className="mt-auto pt-2">
          <Button variant="tinted" onClick={onUse} aria-describedby={headingId}>
            {t("templates.use")}
          </Button>
        </div>
      </div>
    </article>
  );
}
