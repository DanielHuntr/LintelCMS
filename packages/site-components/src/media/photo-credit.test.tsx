import { describe, expect, it } from "vitest";
import { ImageSection } from "../blocks/ImageSection.js";
import { html, photo } from "../testing.js";

const credit = {
  text: "“Bakery” by Ian Sane, CC BY 2.0",
  creator: "Ian Sane",
  sourceUrl: "https://www.flickr.com/photos/example/1",
  licenceName: "CC BY 2.0",
  licenceUrl: "https://creativecommons.org/licenses/by/2.0/",
};

describe("an image field's photo credit", () => {
  it("shows under the picture when there is one, linking creator and licence", () => {
    const output = html(<ImageSection id="i1" image={{ ...photo, credit }} caption="" />);

    expect(output).toContain(
      '<figcaption class="lintel-credit">Photo: <a href="https://www.flickr.com/photos/example/1" rel="noopener">Ian Sane</a>, <a href="https://creativecommons.org/licenses/by/2.0/" rel="license noopener">CC BY 2.0</a></figcaption>',
    );
  });

  it("follows the caption when both are there, and shows as typed when typed by hand", () => {
    const typed = {
      ...credit,
      creator: null,
      sourceUrl: null,
      licenceName: null,
      licenceUrl: null,
      text: "Photo by Sam",
    };
    const output = html(
      <ImageSection id="i1" image={{ ...photo, credit: typed }} caption="Our bakers" />,
    );

    expect(output).toContain(
      '<figcaption class="lintel-figure__caption"><span data-lintel-field="caption">Our bakers</span><span class="lintel-credit">Photo by Sam</span></figcaption>',
    );
  });

  it("is left out for a picture without one, such as a CC0 photo", () => {
    const output = html(<ImageSection id="i1" image={{ ...photo, credit: null }} caption="" />);

    expect(output).not.toContain("lintel-credit");
  });
});
