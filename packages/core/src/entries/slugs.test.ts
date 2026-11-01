import { describe, expect, it } from "vitest";
import { firstFreeSlug, MAX_SLUG_LENGTH, slugify } from "./slugs.js";

describe("slugify", () => {
  it("lowercases, joins words with hyphens and drops punctuation", () => {
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
    expect(slugify("Ana's 10 best tips")).toBe("anas-10-best-tips");
    expect(slugify("Fish & Chips")).toBe("fish-and-chips");
  });

  it("turns accented and special letters into plain ones", () => {
    expect(slugify("Café au lait")).toBe("cafe-au-lait");
    expect(slugify("Straße in Łódź")).toBe("strasse-in-lodz");
    expect(slugify("Smørrebrød og æbleskiver")).toBe("smorrebrod-og-aebleskiver");
    expect(slugify("Ñandú über Façade")).toBe("nandu-uber-facade");
  });

  it("gives an empty slug when nothing usable is left, and keeps slugs short", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("日本語")).toBe("");
    expect(slugify("word ".repeat(40)).length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slugify("word ".repeat(40))).not.toMatch(/-$/);
  });
});

describe("firstFreeSlug", () => {
  it("adds the first free number", () => {
    expect(firstFreeSlug("hello", new Set())).toBe("hello");
    expect(firstFreeSlug("hello", new Set(["hello"]))).toBe("hello-2");
    expect(firstFreeSlug("hello", new Set(["hello", "hello-2", "hello-3"]))).toBe("hello-4");
  });
});
