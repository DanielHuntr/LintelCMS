import { describe, expect, it } from "vitest";
import { headingId, renderHelpMarkdown } from "./renderHelpMarkdown.js";

const options = {
  screenshots: { "media-library.png": "/assets/media-library-abc123.png" },
  docsSiteUrl: "https://docs.example.com",
};

function render(markdown: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderHelpMarkdown(markdown, options);
  return container;
}

describe("renderHelpMarkdown", () => {
  it("keeps links to other help pages inside the panel", () => {
    const link = render("See [Media](/using/media/#uploading).").querySelector("a");

    expect(link?.dataset.helpSlug).toBe("using/media");
    expect(link?.dataset.helpAnchor).toBe("uploading");
    // Still a real address, for opening in a new tab.
    expect(link?.getAttribute("href")).toBe("https://docs.example.com/using/media/#uploading");
    expect(link).not.toHaveAttribute("target");
  });

  it("sends developer pages and other sites to a new tab", () => {
    const links = render(
      "[Install](/building/install/) and [Node](https://nodejs.org)",
    ).querySelectorAll("a");

    expect(links[0]).toHaveAttribute("href", "https://docs.example.com/building/install/");
    expect(links[1]).toHaveAttribute("href", "https://nodejs.org");
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.dataset.helpSlug).toBeUndefined();
    }
  });

  it("shows the bundled screenshot, and leaves out one that isn't bundled", () => {
    const page = render(
      "![The media library](../../../assets/screens/media-library.png)\n\n![Missing](../../../assets/screens/nope.png)",
    );
    const images = page.querySelectorAll("img");

    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", "/assets/media-library-abc123.png");
    expect(images[0]).toHaveAttribute("alt", "The media library");
  });

  it("gives headings the docs site's ids, one level below the panel's title", () => {
    const heading = render("## 1. The setup code (only sometimes)").querySelector("h3");

    expect(heading).toHaveAttribute("id", "1-the-setup-code-only-sometimes");
    expect(heading).toHaveTextContent("1. The setup code (only sometimes)");
  });

  it("renders tables and keyboard keys", () => {
    const page = render(
      "Press <kbd>Tab</kbd>.\n\n| Word | Meaning |\n| --- | --- |\n| Draft | Saved |",
    );

    expect(page.querySelector("kbd")).toHaveTextContent("Tab");
    expect(page.querySelector("td")).toHaveTextContent("Draft");
  });
});

describe("headingId", () => {
  it("matches the anchors in docs links", () => {
    expect(headingId("Forgotten password")).toBe("forgotten-password");
    expect(headingId("Describing a photo (alt text)")).toBe("describing-a-photo-alt-text");
    expect(headingId("“This file is still in use”")).toBe("this-file-is-still-in-use");
  });
});
