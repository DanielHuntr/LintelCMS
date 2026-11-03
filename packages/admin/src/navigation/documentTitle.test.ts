import { describe, expect, it } from "vitest";
import { documentTitleFor } from "./documentTitle.js";

describe("documentTitleFor", () => {
  it("names the section, then the site", () => {
    expect(documentTitleFor("/", "Brightside Bakery")).toBe("Dashboard · Brightside Bakery");
    expect(documentTitleFor("/settings/site", "Brightside Bakery")).toBe(
      "Settings · Brightside Bakery",
    );
    expect(documentTitleFor("/build/features", "Brightside Bakery")).toBe(
      "Build · Brightside Bakery",
    );
  });

  it("uses the app's name before the site has one", () => {
    expect(documentTitleFor("/content", null)).toBe("Content · Lintel");
  });

  it("doesn't mistake a longer path for a section", () => {
    expect(documentTitleFor("/mediaplayer", "Brightside")).toBe("Brightside");
  });
});
