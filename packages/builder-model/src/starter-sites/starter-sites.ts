import { atelierSite } from "./atelier.js";
import { bakerySite } from "./bakery.js";
import { consultantSite } from "./consultant.js";
import { folioSite } from "./folio.js";
import { halyardSite } from "./halyard.js";
import { hollisSite } from "./hollis.js";
import { lindSite } from "./lind.js";
import { localServiceSite } from "./local-service.js";
import { magazineSite } from "./magazine.js";
import { northsideSite } from "./northside.js";
import { portfolioSite } from "./portfolio.js";
import { productLaunchSite } from "./product-launch.js";
import type { StarterSite } from "./starter-site.js";
import { studioSite } from "./studio.js";
import { tollboothSite } from "./tollbooth.js";
import { verveineSite } from "./verveine.js";

/** Every starter site, in the order the template library shows them. */
export const starterSites: readonly StarterSite[] = [
  // The showcase sites first, so people see what's possible straight away.
  studioSite,
  atelierSite,
  folioSite,
  bakerySite,
  consultantSite,
  portfolioSite,
  magazineSite,
  localServiceSite,
  productLaunchSite,
  tollboothSite,
  hollisSite,
  verveineSite,
  lindSite,
  halyardSite,
  northsideSite,
];

export function findStarterSite(starterSiteId: string): StarterSite | undefined {
  return starterSites.find((site) => site.id === starterSiteId);
}
