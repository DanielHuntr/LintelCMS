import { emptySiteDesign, type SharedStyle } from "@lintel/builder-model";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteDesignContext } from "./site-design-context.js";
import { SharedStylePreview } from "./SharedStylePreview.js";
import { themeTokenValues } from "./theme-token-values.js";

const button: SharedStyle = {
  id: "button",
  name: "Button",
  styles: { base: { backgroundColor: "var(--lintel-color-accent)", color: "#ffffff" } },
};

const siteTheme = `:root {
  --lintel-color-accent: #b4532a;
  --lintel-color-link: var(--lintel-color-accent);
}
@media (prefers-color-scheme: dark) {
  :root { --lintel-color-accent: #e08a5f; }
}`;

describe("themeTokenValues", () => {
  it("reads the light scheme's value of each token and follows tokens that point at another", () => {
    const values = themeTokenValues(siteTheme);
    expect(values.get("lintel-color-accent")).toBe("#b4532a");
    expect(values.get("lintel-color-link")).toBe("#b4532a");
  });
});

describe("SharedStylePreview", () => {
  it("draws theme tokens in the site's own colours, not the default theme's (LINTEL-A11Y-026)", () => {
    const { container } = render(
      <SiteDesignContext
        value={{ design: emptySiteDesign, themeValues: themeTokenValues(siteTheme) }}
      >
        <SharedStylePreview sharedStyle={button} />
      </SiteDesignContext>,
    );
    const tile = container.querySelector("span");
    expect(tile?.style.backgroundColor).toBe("rgb(180, 83, 42)");
  });

  it("falls back to the token's default without a theme", () => {
    const { container } = render(<SharedStylePreview sharedStyle={button} />);
    expect(container.querySelector("span")?.style.backgroundColor).toBe("rgb(10, 111, 214)");
  });
});
