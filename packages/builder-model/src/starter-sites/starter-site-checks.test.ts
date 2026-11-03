import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { checkStarterSite, hasRepeatedAttribute } from "./starter-site-checks.js";
import type { StarterSite } from "./starter-site.js";

const broken: StarterSite = {
  id: "broken",
  name: "Broken",
  description: "",
  suitedTo: "",
  coverIllustration: "no-such-picture",
  theme: {
    brandColour: "#000000",
    accentColour: "#ffffff",
    fontPairing: "system",
    cornerStyle: "square",
  },
  pages: [
    {
      slug: "home",
      title: "Home",
      summary: "",
      sections: [
        {
          type: "section",
          props: { element: "header" },
          children: [
            { type: "heading", props: { text: "One", level: 1 } },
            { type: "heading", props: { text: "Three", level: 3 } },
            {
              type: "image",
              name: "Photo",
              props: { src: "/_lintel/illustrations/nope.svg", alt: "" },
            },
          ],
        },
      ],
    },
  ],
};

describe("the starter-site checks", () => {
  it("say plainly what is wrong with a template", () => {
    expect(checkStarterSite(broken, standardCatalogue)).toEqual([
      "broken: no cover illustration called no-such-picture that draws",
      "broken/home: “Three” skips a heading level",
      "broken/home: nothing on the page moves",
      "broken/home: the navigation and footer belong in the site's shared sections",
      "broken/home: the picture “Photo” needs alt text that says what it shows",
      "broken/home: no illustration at /_lintel/illustrations/nope.svg",
    ]);
  });

  it("find a tag that sets an attribute twice, which browsers won't draw", () => {
    expect(hasRepeatedAttribute('<svg><rect fill="none" stroke="#000" fill="#fff"/></svg>')).toBe(
      true,
    );
    expect(hasRepeatedAttribute('<svg><rect fill="#fff"/><rect fill="#000"/></svg>')).toBe(false);
  });
});
