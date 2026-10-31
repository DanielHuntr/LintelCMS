import { describe, expect, it } from "vitest";
import { sections, visibleSections } from "./sections.js";

const allPlugins = ["blog", "commerce", "forms", "seo"];

function labelsFor(permissions: string[], enabledPlugins: string[]) {
  return visibleSections(permissions, enabledPlugins).map((section) => section.label);
}

describe("visibleSections", () => {
  it("shows a client editor only the sections they work in", () => {
    const editor = ["entries:*", "media:*"];

    expect(labelsFor(editor, allPlugins)).toEqual([
      "nav.dashboard",
      "nav.content",
      "nav.media",
      "nav.help",
    ]);
  });

  it("shows a super admin every section when every plugin is on", () => {
    expect(visibleSections(["*"], allPlugins)).toHaveLength(sections.length);
  });

  it("hides Commerce and Forms on a blog", () => {
    expect(labelsFor(["*"], ["blog", "seo"])).toEqual([
      "nav.dashboard",
      "nav.content",
      "nav.design",
      "nav.media",
      "nav.users",
      "nav.settings",
      "nav.help",
    ]);
  });

  it("shows each plugin's section only once it is switched on", () => {
    expect(labelsFor(["*"], ["commerce"])).toContain("nav.commerce");
    expect(labelsFor(["*"], ["commerce"])).not.toContain("nav.forms");
    expect(labelsFor(["*"], ["forms"])).toContain("nav.forms");
  });

  it("still needs permission for a plugin's section", () => {
    expect(labelsFor(["entries:*"], allPlugins)).not.toContain("nav.commerce");
  });
});
