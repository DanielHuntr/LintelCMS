import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { englishLabels } from "../site.types.js";
import { chrome, html, photo } from "../testing.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { socialLinkName } from "./social-links.js";

describe("the page itself", () => {
  it("never scrolls sideways for something waiting to slide in (LINTEL-FUNC-031)", () => {
    const css = readFileSync(new URL("../styles/base.css", import.meta.url), "utf8");
    expect(css).toMatch(/body.lintel-site {[^}]*overflow-x: clip;/);
  });
});

describe("the header", () => {
  it("lines up with designed pages and keeps one row on a phone (LINTEL-A11Y-033)", () => {
    const css = readFileSync(new URL("../styles/header.css", import.meta.url), "utf8");
    expect(css).toMatch(
      /body:has\(\[data-lintel-component="page_design"\]\) \.lintel-header--bar \.lintel-container \{[^}]*padding-inline: var\(--lintel-site-gutter\)/,
    );
    const phone = css.slice(css.indexOf("@media (max-width: 40rem)"));
    expect(phone).toMatch(
      /\.lintel-header__inner:not\(:has\(\.lintel-menu__submenu\)\) \{\s*flex-wrap: nowrap;/,
    );
  });

  it("links the site name home and marks the current page in the main menu", () => {
    const output = html(<Header chrome={chrome} labels={englishLabels} />);
    expect(output).toContain(
      '<a class="lintel-header__brand" href="/" data-lintel-field="site_name">Corner Bakery</a>',
    );
    expect(output).toContain('<nav class="lintel-menu-bar" aria-label="Main menu">');
    expect(output).toContain('href="/" aria-current="page">Home</a>');
  });

  it("opens sub-menus with a disclosure, with the parent page as the first link", () => {
    const output = html(<Header chrome={chrome} labels={englishLabels} />);
    expect(output).toContain(
      '<details class="lintel-menu__group"><summary class="lintel-menu__link">Menu</summary><ul class="lintel-menu__submenu"><li><a class="lintel-menu__sublink" href="/menu">Menu</a></li><li><a class="lintel-menu__sublink" href="/cakes">Cakes</a></li></ul></details>',
    );
  });

  it("shows the logo named after the site", () => {
    const output = html(<Header chrome={{ ...chrome, logo: photo }} labels={englishLabels} />);
    expect(output).toContain('alt="Corner Bakery"');
    expect(output).toContain('class="lintel-header__logo"');
  });
});

describe("the footer", () => {
  it("shows the site settings, social links by name, and languages only when there are several", () => {
    const output = html(<Footer chrome={chrome} labels={englishLabels} year={2026} />);
    expect(output).toContain("Fresh bread every morning.");
    expect(output).toContain('href="mailto:hello@cornerbakery.example"');
    expect(output).toContain(">Instagram</a>");
    expect(output).toContain("© 2026 Corner Bakery");
    expect(output).not.toContain("Languages");

    const multilingual = html(
      <Footer
        chrome={{
          ...chrome,
          languages: [
            { code: "en-GB", name: "English", url: "/", current: true },
            { code: "fr", name: "Français", url: "/fr", current: false },
          ],
        }}
        labels={englishLabels}
        year={2026}
      />,
    );
    expect(multilingual).toContain(
      '<a class="lintel-footer__link" href="/fr" lang="fr" hreflang="fr">Français</a>',
    );
  });

  it("names well-known social sites", () => {
    expect(socialLinkName("https://x.com/bakery")).toBe("X");
    expect(socialLinkName("https://linkedin.com/company/bakery")).toBe("LinkedIn");
    expect(socialLinkName("not a url")).toBe("not a url");
  });
});
