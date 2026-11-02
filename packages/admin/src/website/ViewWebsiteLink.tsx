import { SquareArrowOutUpRight } from "lucide-react";
import { t } from "../i18n/strings.js";
import { useSiteAddress } from "./website.queries.js";

/**
 * "View website", under the site's name in the sidebar: the quickest way from the admin to
 * the site it makes. Nothing shows until the website has an address.
 */
export function ViewWebsiteLink() {
  const address = useSiteAddress();
  const siteAddress = address.data?.siteAddress;
  if (!siteAddress) return null;
  return (
    <a
      href={siteAddress}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1 rounded-control text-footnote font-medium text-accent hover:underline focus-visible:focus-ring"
    >
      {t("nav.viewWebsite")}
      <SquareArrowOutUpRight aria-hidden="true" className="size-3" />
      <span className="sr-only"> {t("help.newTab")}</span>
    </a>
  );
}
