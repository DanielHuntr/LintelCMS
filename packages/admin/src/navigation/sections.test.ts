import { describe, expect, it } from "vitest";
import { sections, visibleSections } from "./sections.js";

describe("visibleSections", () => {
  it("shows a client editor only the sections they work in", () => {
    const editor = ["entries:*", "media:*"];

    const labels = visibleSections(editor).map((section) => section.label);

    expect(labels).toEqual(["nav.dashboard", "nav.content", "nav.media", "nav.help"]);
  });

  it("shows a super admin every section", () => {
    expect(visibleSections(["*"])).toHaveLength(sections.length);
  });
});
