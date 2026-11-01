import { describe, expect, it } from "vitest";
import { parseHelpPage, readFrontmatter, slugFromPath } from "./help-page.js";

describe("parseHelpPage", () => {
  const source = `---
title: Photos and files
description: "Uploading, alt text and focal points."
since: "0.1"
sidebar:
  label: Media
---

Your media library.
`;

  it("reads the title, description and version, and drops the frontmatter", () => {
    expect(parseHelpPage("../content/docs/using/media.md", source)).toEqual({
      slug: "using/media",
      title: "Photos and files",
      description: "Uploading, alt text and focal points.",
      since: "0.1",
      markdown: "Your media library.",
    });
  });

  it("ignores nested keys such as the sidebar label", () => {
    expect(readFrontmatter(source).fields).not.toHaveProperty("label");
  });

  it("falls back to the slug when a page has no frontmatter", () => {
    expect(parseHelpPage("content/docs/using/notes.md", "Just text")).toMatchObject({
      slug: "using/notes",
      title: "using/notes",
      markdown: "Just text",
    });
  });
});

describe("slugFromPath", () => {
  it("treats index files as their folder, like the docs site", () => {
    expect(slugFromPath("../content/docs/using/index.md")).toBe("using");
    expect(slugFromPath("/repo/packages/docs/src/content/docs/index.mdx")).toBe("");
  });
});
