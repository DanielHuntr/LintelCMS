import { describe, expect, it } from "vitest";
import { elementStylesheet } from "./element-stylesheet.js";

describe("element stylesheet", () => {
  it("keeps links in a consent notice in the notice's text colour, underlined (LINTEL-A11Y-024)", () => {
    // A site's `a { color: … }` is one element selector; the notice's rule must outrank it,
    // or a dark site link colour sits on the black video notice at 2.65:1.
    const rule = /([^}\n]*\.lintel-consent__text a[^{]*)\{([^}]*)\}/.exec(elementStylesheet);
    expect(rule?.[1]).toBeDefined();
    expect(rule?.[1]).not.toContain(":where(");
    expect(rule?.[2]).toContain("color: inherit");
    expect(rule?.[2]).toContain("text-decoration: underline");
  });
});
