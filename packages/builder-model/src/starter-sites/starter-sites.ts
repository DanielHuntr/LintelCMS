import { bakerySite } from "./bakery.js";
import { consultantSite } from "./consultant.js";
import { folioSite } from "./folio.js";
import { localServiceSite } from "./local-service.js";
import { magazineSite } from "./magazine.js";
import { portfolioSite } from "./portfolio.js";
import { productLaunchSite } from "./product-launch.js";
import type { StarterSite } from "./starter-site.js";

/** Every starter site, in the order the template library shows them. */
export const starterSites: readonly StarterSite[] = [
  bakerySite,
  consultantSite,
  portfolioSite,
  magazineSite,
  localServiceSite,
  productLaunchSite,
  folioSite,
];

export function findStarterSite(starterSiteId: string): StarterSite | undefined {
  return starterSites.find((site) => site.id === starterSiteId);
}
