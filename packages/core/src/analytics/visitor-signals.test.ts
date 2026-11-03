import { describe, expect, it } from "vitest";
import { rollUpEvents, type EventForRollup } from "./daily-rollups.js";
import { hashVisitor } from "./visitor-hash.js";
import { VisitorLimiter } from "./visitor-limiter.js";
import {
  asksNotToBeCounted,
  cleanPath,
  countedDuration,
  countryFromLanguage,
  deviceFromWidth,
  looksLikeRobot,
  referrerDomain,
} from "./visitor-signals.js";

const chrome =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("reading a visit", () => {
  it("tells robots and scripts from browsers", () => {
    expect(looksLikeRobot(chrome)).toBe(false);
    expect(
      looksLikeRobot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"),
    ).toBe(true);
    expect(
      looksLikeRobot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/130.0 Safari/537.36"),
    ).toBe(true);
    expect(looksLikeRobot("curl/8.4.0")).toBe(true);
    expect(looksLikeRobot(undefined)).toBe(true);
  });

  it("follows Do Not Track and Global Privacy Control", () => {
    expect(asksNotToBeCounted({ dnt: "1" })).toBe(true);
    expect(asksNotToBeCounted({ "sec-gpc": "1" })).toBe(true);
    expect(asksNotToBeCounted({ dnt: "0" })).toBe(false);
  });

  it("guesses the country from the browser's language only, with no lookup", () => {
    expect(countryFromLanguage("en-GB,en;q=0.9")).toBe("GB");
    expect(countryFromLanguage("fr-ca")).toBe("CA");
    expect(countryFromLanguage("de")).toBe("");
    expect(countryFromLanguage("not a language")).toBe("");
    expect(countryFromLanguage(undefined)).toBe("");
  });

  it("sorts windows into phones, tablets and desktops", () => {
    expect(deviceFromWidth(390)).toBe("phone");
    expect(deviceFromWidth(820)).toBe("tablet");
    expect(deviceFromWidth(1440)).toBe("desktop");
    expect(deviceFromWidth(undefined)).toBeNull();
  });

  it("keeps only the referring site's domain, and nothing from the site itself", () => {
    expect(referrerDomain("https://www.google.com/search?q=bread", "bakery.test")).toBe(
      "google.com",
    );
    expect(referrerDomain("https://www.bakery.test/about", "bakery.test")).toBe("");
    expect(referrerDomain("javascript:alert(1)", "bakery.test")).toBe("");
    expect(referrerDomain("", "bakery.test")).toBe("");
    expect(referrerDomain("http://localhost:4261/shop", "localhost:4261")).toBe("");
  });

  it("drops queries and anchors from paths, which can hold names and tokens", () => {
    expect(cleanPath("/thanks?email=sam@example.com#top")).toBe("/thanks");
    expect(cleanPath("about")).toBe("/about");
  });

  it("caps time on page at half an hour", () => {
    expect(countedDuration(5_000)).toBe(5_000);
    expect(countedDuration(10 * 60 * 60 * 1000)).toBe(30 * 60 * 1000);
    expect(countedDuration(-1)).toBeNull();
  });
});

describe("visitor hashes", () => {
  const visitor = { siteId: "site", ipAddress: "203.0.113.9", userAgent: chrome };

  it("are the same for one visitor on one day, and unrelated with another day's salt", () => {
    expect(hashVisitor("monday", visitor)).toBe(hashVisitor("monday", visitor));
    expect(hashVisitor("tuesday", visitor)).not.toBe(hashVisitor("monday", visitor));
    expect(hashVisitor("monday", { ...visitor, siteId: "other" })).not.toBe(
      hashVisitor("monday", visitor),
    );
  });

  it("never contain the address or the browser", () => {
    const hash = hashVisitor("monday", visitor);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("203");
  });
});

describe("the per-visitor limits", () => {
  it("counts a reloaded page once every few seconds", () => {
    const limiter = new VisitorLimiter();
    expect(limiter.allows("a", "view", "/", 0)).toBe(true);
    expect(limiter.allows("a", "view", "/", 2_000)).toBe(false);
    expect(limiter.allows("a", "view", "/about", 2_000)).toBe(true);
    expect(limiter.allows("a", "view", "/", 15_000)).toBe(true);
  });

  it("stops one visitor sending hundreds of events an hour", () => {
    const limiter = new VisitorLimiter();
    let allowed = 0;
    for (let index = 0; index < 400; index += 1) {
      if (limiter.allows("a", "custom", "/", index)) allowed += 1;
    }
    expect(allowed).toBe(300);
    expect(limiter.allows("b", "custom", "/", 500)).toBe(true);
  });
});

describe("daily figures", () => {
  const base: EventForRollup = {
    kind: "view",
    visitorHash: "a",
    path: "/",
    source: "",
    campaign: "",
    device: "desktop",
    country: "GB",
    durationMs: null,
    name: "",
    value: 0,
  };

  it("counts visitors once however many pages they open, with time on page and goals", () => {
    const figures = rollUpEvents([
      base,
      { ...base, path: "/about" },
      { ...base, visitorHash: "b", source: "google.com", device: "phone", country: "FR" },
      { ...base, kind: "leave", durationMs: 30_000 },
      { ...base, kind: "leave", durationMs: 10_000, visitorHash: "b" },
      { ...base, kind: "goal", visitorHash: null, name: "form:contact", path: "/" },
      { ...base, kind: "goal", visitorHash: null, name: "order", path: "", value: 2_500 },
      { ...base, kind: "outbound", name: "instagram.com" },
    ]);
    const find = (dimension: string, key: string) =>
      figures.find((row) => row.dimension === dimension && row.key === key);

    expect(find("total", "")).toMatchObject({
      visitors: 2,
      views: 3,
      durationMs: 40_000,
      durationCount: 2,
      conversions: 2,
      value: 2_500,
    });
    expect(find("page", "/")).toMatchObject({ visitors: 2, views: 2, conversions: 1 });
    expect(find("source", "")).toMatchObject({ visitors: 1, views: 2 });
    expect(find("source", "google.com")).toMatchObject({ visitors: 1 });
    expect(find("device", "phone")).toMatchObject({ visitors: 1 });
    expect(find("goal", "order")).toMatchObject({ conversions: 1, value: 2_500 });
    expect(find("outbound", "instagram.com")).toMatchObject({ visitors: 1, views: 1 });
  });
});
