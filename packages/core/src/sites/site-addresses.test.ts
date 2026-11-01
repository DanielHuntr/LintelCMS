import { describe, expect, it } from "vitest";
import {
  addPathPrefix,
  findAddressClash,
  matchSiteForAddress,
  normalizeHostname,
  normalizePathPrefix,
  removePathPrefix,
} from "./site-addresses.js";

const uk = {
  handle: "uk",
  name: "Acme UK",
  hostnames: ["acme.co.uk", "www.acme.co.uk"],
  pathPrefix: "",
};
const global = { handle: "global", name: "Acme", hostnames: ["acme.com"], pathPrefix: "" };
const france = { handle: "fr", name: "Acme France", hostnames: ["acme.com"], pathPrefix: "/fr" };
const local = { handle: "local", name: "Local", hostnames: ["localhost:3000"], pathPrefix: "" };
const sites = [uk, global, france, local];

describe("tidying addresses", () => {
  it("keeps only the domain of whatever is typed or pasted", () => {
    expect(normalizeHostname("https://www.Acme.co.uk/about?x=1")).toBe("www.acme.co.uk");
    expect(normalizeHostname("  acme.com  ")).toBe("acme.com");
    expect(normalizeHostname("localhost:3000")).toBe("localhost:3000");
    expect(normalizeHostname("https://acme.com:443")).toBe("acme.com");
    expect(normalizeHostname("not a domain")).toBeNull();
    expect(normalizeHostname("")).toBeNull();
    expect(normalizeHostname("-acme.com")).toBeNull();
  });

  it("writes path prefixes one way", () => {
    expect(normalizePathPrefix("fr/")).toBe("/fr");
    expect(normalizePathPrefix("/FR/")).toBe("/fr");
    expect(normalizePathPrefix("/en-gb/shop")).toBe("/en-gb/shop");
    expect(normalizePathPrefix("/")).toBe("");
    expect(normalizePathPrefix("")).toBe("");
    expect(normalizePathPrefix("/fr?x")).toBeNull();
    expect(normalizePathPrefix("/ä")).toBeNull();
  });
});

describe("matching an address to a site", () => {
  it("finds the site by domain, any of its domains", () => {
    expect(matchSiteForAddress(sites, { host: "www.acme.co.uk" })).toBe(uk);
    expect(matchSiteForAddress(sites, { host: "ACME.co.uk" })).toBe(uk);
    expect(matchSiteForAddress(sites, { host: "unknown.example" })).toBeUndefined();
  });

  it("ignores the port unless the site names one", () => {
    expect(matchSiteForAddress(sites, { host: "acme.co.uk:8080" })).toBe(uk);
    expect(matchSiteForAddress(sites, { host: "localhost:3000" })).toBe(local);
    expect(matchSiteForAddress(sites, { host: "localhost:4000" })).toBeUndefined();
  });

  it("uses the longest path prefix that fits, when sites share a domain", () => {
    expect(matchSiteForAddress(sites, { host: "acme.com", path: "/fr/about" })).toBe(france);
    expect(matchSiteForAddress(sites, { host: "acme.com", path: "/fr" })).toBe(france);
    expect(matchSiteForAddress(sites, { host: "acme.com", path: "/fresh-bread" })).toBe(global);
    expect(matchSiteForAddress(sites, { host: "acme.com", path: "/" })).toBe(global);
  });

  it("prefers the site without a prefix when only the domain is known", () => {
    expect(matchSiteForAddress(sites, { host: "acme.com" })).toBe(global);
    expect(matchSiteForAddress([france], { host: "acme.com" })).toBe(france);
  });
});

describe("path prefixes in addresses", () => {
  it("adds and removes the prefix", () => {
    expect(addPathPrefix("/fr", "/about")).toBe("/fr/about");
    expect(addPathPrefix("/fr", "/")).toBe("/fr");
    expect(addPathPrefix("", "/about")).toBe("/about");
    expect(addPathPrefix("/fr", null)).toBeNull();
    expect(removePathPrefix("/fr", "/fr/about")).toBe("/about");
    expect(removePathPrefix("/fr", "/fr")).toBe("/");
    expect(removePathPrefix("/fr", "/fresh")).toBe("/fresh");
  });
});

describe("address clashes", () => {
  it("refuses two sites on the same domain and prefix", () => {
    expect(findAddressClash({ hostnames: ["acme.com"], pathPrefix: "/fr" }, sites)).toEqual({
      hostname: "acme.com",
      siteName: "Acme France",
    });
    expect(findAddressClash({ hostnames: ["acme.com"], pathPrefix: "/de" }, sites)).toBeUndefined();
    expect(findAddressClash({ hostnames: [], pathPrefix: "" }, sites)).toBeUndefined();
  });
});
