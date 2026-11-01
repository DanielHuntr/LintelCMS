import { describe, expect, it } from "vitest";
import { cleanTypedSlug, entryUrlPreview, slugFromTitle } from "./slug.js";

describe("slugFromTitle", () => {
  it("makes a readable address from a title", () => {
    expect(slugFromTitle("My First Post!")).toBe("my-first-post");
    expect(slugFromTitle("  What’s new in October?  ")).toBe("whats-new-in-october");
    expect(slugFromTitle("Fish & chips")).toBe("fish-and-chips");
  });

  it("keeps the letters of accented words", () => {
    expect(slugFromTitle("Café crème brûlée")).toBe("cafe-creme-brulee");
  });

  it("is empty for a title with nothing to use", () => {
    expect(slugFromTitle("!!!")).toBe("");
  });

  it("stays a sensible length without ending in a hyphen", () => {
    const slug = slugFromTitle("word ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("cleanTypedSlug", () => {
  it("lets someone type a hyphen at the end while they're still typing", () => {
    expect(cleanTypedSlug("my post ")).toBe("my-post-");
    expect(cleanTypedSlug("My Post")).toBe("my-post");
  });
});

describe("entryUrlPreview", () => {
  it("shows where the entry will live", () => {
    expect(entryUrlPreview("/blog/{slug}", "my-post")).toBe("/blog/my-post");
    expect(entryUrlPreview("/{slug}", "about")).toBe("/about");
  });
});
