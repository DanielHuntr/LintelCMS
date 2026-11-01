import { apiRequest } from "../api/client.js";

export interface SiteAddress {
  /** Such as "https://www.example.com", or "" when no website is connected. */
  siteAddress: string;
}

export function fetchSiteAddress(): Promise<SiteAddress> {
  return apiRequest<SiteAddress>("/site-address");
}

export function saveSiteAddress(siteAddress: string): Promise<SiteAddress> {
  return apiRequest<SiteAddress>("/site-address", { method: "PUT", body: { siteAddress } });
}
