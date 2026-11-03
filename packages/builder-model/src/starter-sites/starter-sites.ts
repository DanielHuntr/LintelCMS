import { atelierSite } from "./atelier.js";
import { bakerySite } from "./bakery.js";
import { chambersSite } from "./chambers.js";
import { consultantSite } from "./consultant.js";
import { folioSite } from "./folio.js";
import { localServiceSite } from "./local-service.js";
import { longplaySite } from "./longplay.js";
import { longwaveSite } from "./longwave.js";
import { magazineSite } from "./magazine.js";
import { portfolioSite } from "./portfolio.js";
import { productLaunchSite } from "./product-launch.js";
import { relaySite } from "./relay.js";
import type { StarterSite } from "./starter-site.js";
import { studioSite } from "./studio.js";
import { thresholdSite } from "./threshold.js";

/** Every starter site, in the order the template library shows them. */
export const starterSites: readonly StarterSite[] = [
  // The showcase sites first, so people see what's possible straight away.
  studioSite,
  atelierSite,
  folioSite,
  relaySite,
  chambersSite,
  longplaySite,
  thresholdSite,
  longwaveSite,
  bakerySite,
  consultantSite,
  portfolioSite,
  magazineSite,
  localServiceSite,
  productLaunchSite,
];

export function findStarterSite(starterSiteId: string): StarterSite | undefined {
  return starterSites.find((site) => site.id === starterSiteId);
}
