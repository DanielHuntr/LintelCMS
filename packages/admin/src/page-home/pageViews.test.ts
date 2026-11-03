import { describe, expect, it } from "vitest";
import { pageViews, publishState, publishWords } from "./pageViews.js";

describe("a page's views", () => {
  it("offers Design and Content for a saved page that can be designed", () => {
    expect(pageViews({ canOpenDesign: true, isNarrowScreen: false, listsChildren: false })).toEqual(
      ["design", "content"],
    );
  });

  it("adds Items for a page with a list under it", () => {
    expect(pageViews({ canOpenDesign: true, isNarrowScreen: false, listsChildren: true })).toEqual([
      "design",
      "content",
      "children",
    ]);
  });

  it("leaves Design out on a phone, where the designer can't open", () => {
    expect(pageViews({ canOpenDesign: true, isNarrowScreen: true, listsChildren: true })).toEqual([
      "content",
      "children",
    ]);
  });

  it("has nothing to switch between for a plain entry", () => {
    expect(
      pageViews({ canOpenDesign: false, isNarrowScreen: false, listsChildren: false }),
    ).toEqual(["content"]);
  });
});

describe("the main button's words", () => {
  it.each([
    [{ isLive: false, hasNewerChanges: false }, "Publish"],
    [{ isLive: false, hasNewerChanges: true }, "Publish"],
    [{ isLive: true, hasNewerChanges: true }, "Publish changes"],
    [{ isLive: true, hasNewerChanges: false }, "Published"],
    [{ isLive: true, hasNewerChanges: true, isPublishing: true }, "Publishing…"],
    [{ isLive: true, hasNewerChanges: false, justPublished: true }, "Published"],
  ])("says so for %o", (facts, words) => {
    expect(publishWords(publishState(facts))).toBe(words);
  });
});
