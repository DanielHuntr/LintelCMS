import { describe, expect, it } from "vitest";
import { fullDocsUrl } from "./docsLinks.js";

describe("fullDocsUrl", () => {
  it("links to the published docs when their address is set", () => {
    expect(fullDocsUrl("using/media", "https://docs.example.com/")).toBe(
      "https://docs.example.com/using/media/",
    );
    expect(fullDocsUrl("/using/users/#forgotten-password", "https://docs.example.com")).toBe(
      "https://docs.example.com/using/users/#forgotten-password",
    );
    expect(fullDocsUrl("", "https://docs.example.com")).toBe("https://docs.example.com/");
  });

  it("links to the page's Markdown on GitHub otherwise", () => {
    const github =
      "https://github.com/DanielHuntr/lintelcms/blob/main/packages/docs/src/content/docs";
    expect(fullDocsUrl("using/media", undefined)).toBe(`${github}/using/media.md`);
    expect(fullDocsUrl("using", undefined)).toBe(`${github}/using/index.md`);
    expect(fullDocsUrl("/building/install/#more-commands", undefined)).toBe(
      `${github}/building/install.md#more-commands`,
    );
  });
});
