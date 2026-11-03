import { describe, expect, it } from "vitest";
import type { VersionKey } from "./experiments.schema.js";
import {
  chooseVersion,
  isAutomatedVisitor,
  readVisitor,
  type Visitor,
  versionForBucket,
} from "./visitor-assignment.js";

const firefox = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";

function person(address: string, userAgent = firefox): Visitor {
  return { address, userAgent, acceptLanguage: "en-GB,en;q=0.8", optedOut: false };
}

const test = { secret: "a-test-secret", split: [50, 50], keys: ["original", "b"] as VersionKey[] };

function shareOfB(split: number[], visitors = 10_000): number {
  let seenB = 0;
  for (let index = 0; index < visitors; index += 1) {
    const visitor = person(`10.${(index >> 16) & 255}.${(index >> 8) & 255}.${index & 255}`);
    if (chooseVersion(visitor, { ...test, split }) === "b") seenB += 1;
  }
  return seenB / visitors;
}

describe("which version a visitor sees", () => {
  it("is the same on every visit from the same browser and network", () => {
    const visitor = person("203.0.113.7");
    const first = chooseVersion(visitor, test);
    for (let visit = 0; visit < 20; visit += 1) {
      expect(chooseVersion({ ...visitor }, test)).toBe(first);
    }
  });

  it("splits visitors evenly by default", () => {
    expect(shareOfB([50, 50])).toBeGreaterThan(0.48);
    expect(shareOfB([50, 50])).toBeLessThan(0.52);
  });

  it("follows an uneven split", () => {
    const share = shareOfB([80, 20]);
    expect(share).toBeGreaterThan(0.18);
    expect(share).toBeLessThan(0.22);
  });

  it("shares three versions out by their stretch of the split", () => {
    const keys: VersionKey[] = ["original", "b", "c"];
    expect(versionForBucket(0, [34, 33, 33], keys)).toBe("original");
    expect(versionForBucket(3399, [34, 33, 33], keys)).toBe("original");
    expect(versionForBucket(3400, [34, 33, 33], keys)).toBe("b");
    expect(versionForBucket(6700, [34, 33, 33], keys)).toBe("c");
    expect(versionForBucket(9999, [34, 33, 33], keys)).toBe("c");
  });

  it("splits each test afresh: another secret gives another split", () => {
    let differences = 0;
    for (let index = 0; index < 200; index += 1) {
      const visitor = person(`192.0.2.${index}`);
      if (chooseVersion(visitor, test) !== chooseVersion(visitor, { ...test, secret: "other" }))
        differences += 1;
    }
    expect(differences).toBeGreaterThan(50);
  });

  it("always shows search engines, previews and tools the original", () => {
    const automated = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "facebookexternalhit/1.1",
      "Slackbot-LinkExpanding 1.0",
      "curl/8.4.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0 Safari/537.36",
      "",
    ];
    for (const userAgent of automated) {
      expect(isAutomatedVisitor({ userAgent }), userAgent).toBe(true);
      for (let index = 0; index < 30; index += 1) {
        expect(chooseVersion(person(`198.51.100.${index}`, userAgent), test)).toBe("original");
      }
    }
    expect(isAutomatedVisitor({ userAgent: firefox })).toBe(false);
  });

  it("always shows people who ask not to be tracked the original", () => {
    for (const headers of [{ dnt: "1" }, { "sec-gpc": "1" }]) {
      for (let index = 0; index < 30; index += 1) {
        const visitor = readVisitor({ "user-agent": firefox, ...headers }, `198.51.100.${index}`);
        expect(visitor.optedOut).toBe(true);
        expect(chooseVersion(visitor, test)).toBe("original");
      }
    }
    expect(readVisitor({ "user-agent": firefox, dnt: "0" }, "198.51.100.1").optedOut).toBe(false);
  });
});
