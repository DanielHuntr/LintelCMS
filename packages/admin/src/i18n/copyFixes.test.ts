import { describe, expect, it } from "vitest";
import { t } from "./strings.js";

describe("wording that depends on what's put into it", () => {
  // The import summary said "1 posts", and a white-labelled admin "Import a Acme Studio export".
  it("counts one thing in the singular and names a brand without an article", () => {
    expect(
      t("wordpress.found", {
        posts: 1,
        pages: 2,
        attachments: 1,
        authors: 1,
        categories: 0,
        tags: 3,
      }),
    ).toBe("1 post, 2 pages, 1 file, 1 author, 0 categories and 3 tags");
    expect(t("import.lintelTitle", { product: "Acme Studio" })).toBe(
      "Import an export from Acme Studio",
    );
  });
});

describe("the site fonts' words (QA sweep)", () => {
  // They said "Lintel" even in an admin white-labelled with another name.
  it("name the product the agency chose, never Lintel itself", async () => {
    const { siteFontsStrings } = await import("../site-fonts/siteFontsStrings.js");
    for (const text of Object.values(siteFontsStrings)) expect(text).not.toMatch(/Lintel/);
    expect(t("siteFonts.included", { count: 23, product: "Acme Studio" })).toBe(
      "Acme Studio also includes 23 fonts, such as Inter, Lora and Bebas Neue.",
    );
    expect(t("siteFonts.google.included", { product: "Acme Studio" })).toBe(
      "Comes with Acme Studio",
    );
  });
});
