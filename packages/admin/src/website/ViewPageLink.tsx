import { ExternalLink } from "lucide-react";
import { buttonClasses } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { pageAddress } from "./pageAddress.js";
import { useSiteAddress } from "./website.queries.js";

interface ViewPageLinkProps {
  /** Null for collections whose entries have no page of their own. */
  routePattern: string | null;
  entry: { slug: string; publishedAt: string | null; locale: string };
}

/** "View page": the live page on the website, in a new tab. Shown once an entry is live. */
export function ViewPageLink({ routePattern, entry }: ViewPageLinkProps) {
  const address = useSiteAddress();
  if (!routePattern || !address.data?.siteAddress) return null;

  return (
    <a
      href={pageAddress(address.data.siteAddress, routePattern, entry, address.data.defaultLocale)}
      target="_blank"
      rel="noreferrer"
      className={buttonClasses("tinted", "small")}
    >
      <span className="-ml-0.5 flex [&>svg]:size-[1.1em]">
        <ExternalLink aria-hidden="true" />
      </span>
      {t("website.viewPage")}
      <span className="sr-only"> {t("website.opensInNewTab")}</span>
    </a>
  );
}
