import { describe, expect, it } from "vitest";
import type { SiteEffectSettings } from "../effects/effect-types.js";
import {
  keyframesCss,
  nearestPageTransitionSpeed,
  pageTransitionCss,
  pageTransitionLooks,
} from "./page-transition-looks.js";
import { defaultSiteEffectSettings, siteEffectSettingsSchema } from "./site-effects.js";
import { introCss, introMarkup } from "./site-intro.js";

const withTransition = (
  style: SiteEffectSettings["pageTransition"]["style"],
  duration = 500,
): SiteEffectSettings => ({ ...defaultSiteEffectSettings, pageTransition: { style, duration } });

const withIntro = (style: SiteEffectSettings["intro"]["style"], text = ""): SiteEffectSettings => ({
  ...defaultSiteEffectSettings,
  intro: { ...defaultSiteEffectSettings.intro, style, text },
});

const content = { siteName: "Rye & Crumb", logo: { url: "/media/logo.svg", alt: "Rye" } };

describe("site-wide effects", () => {
  it("are all off by default and then write nothing", () => {
    expect(pageTransitionCss(defaultSiteEffectSettings)).toBe("");
    expect(introMarkup(defaultSiteEffectSettings, { skip: "Skip" })).toBe("");
    expect(introCss(defaultSiteEffectSettings)).toBe("");
  });

  it("still reads settings saved before the logo intro and speeds existed", () => {
    const saved = siteEffectSettingsSchema.parse({
      pageTransition: { style: "wipe", duration: 450 },
      intro: { style: "curtain", text: "", background: "#111111", colour: "#ffffff" },
    });
    expect(saved.pageTransition).toEqual({ style: "wipe", duration: 450 });
    expect(saved.intro.style).toBe("curtain");
  });
});

describe("page transitions", () => {
  it("run as cross-document view transitions, only for people happy with motion", () => {
    const css = pageTransitionCss(withTransition("slide", 300));
    expect(css).toMatch(
      /^@media \(prefers-reduced-motion: no-preference\) \{\n@view-transition \{ navigation: auto; \}/,
    );
    expect(css).toContain("::view-transition-old(root) { animation: 300ms");
    expect(css).toContain(
      "@keyframes lintel-page-enter { 0% { opacity: 0; transform: translateY(6%) }",
    );
  });

  it("keep the browser's cross-fade for Fade and lay the new page over the old for the rest", () => {
    expect(pageTransitionCss(withTransition("fade"))).not.toContain("mix-blend-mode");
    for (const style of ["slide", "wipe", "zoom"] as const) {
      expect(pageTransitionCss(withTransition(style))).toContain("mix-blend-mode: normal");
    }
  });

  it("time carried elements at the same speed as the page", () => {
    expect(pageTransitionCss(withTransition("zoom", 800))).toContain(
      "::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation-duration: 800ms;",
    );
  });

  it("write keyframes as CSS with properties in CSS spelling", () => {
    expect(keyframesCss(pageTransitionLooks.wipe.enter)).toBe(
      "0% { clip-path: inset(100% 0 0 0) } 100% { clip-path: inset(0 0 0 0) }",
    );
  });

  it("show any saved length as the nearest of the three speeds", () => {
    expect(nearestPageTransitionSpeed(450)).toBe("steady");
    expect(nearestPageTransitionSpeed(150)).toBe("quick");
    expect(nearestPageTransitionSpeed(1200)).toBe("slow");
  });
});

describe("the first-visit intro", () => {
  it("shows the site's name when no words were typed, escaped", () => {
    const markup = introMarkup(withIntro("name"), { skip: "Skip intro" }, content);
    expect(markup).toContain("Rye &amp; Crumb");
    expect(introMarkup(withIntro("name", "<Acme>"), { skip: "Skip intro" }, content)).toContain(
      "&lt;Acme&gt;",
    );
  });

  it("fades the logo in, or falls back to the name when the site has no logo", () => {
    expect(introMarkup(withIntro("logo"), { skip: "Skip" }, content)).toContain(
      '<img class="lintel-intro__logo" src="/media/logo.svg" alt="">',
    );
    expect(introMarkup(withIntro("logo"), { skip: "Skip" }, { ...content, logo: null })).toContain(
      "lintel-intro__name",
    );
  });

  it("is decoration over the page: hidden from screen readers but for its Skip button", () => {
    const markup = introMarkup(withIntro("counter"), { skip: "Skip intro" }, content);
    expect(markup).toContain('<div class="lintel-intro__middle" aria-hidden="true">');
    expect(markup).toContain(
      '<button type="button" class="lintel-intro__skip">Skip intro</button>',
    );
    expect(markup).not.toContain('role="status"');
  });

  it("only ever shows with scripts on and for people happy with motion, and hides itself in time", () => {
    const css = introCss(withIntro("counter"));
    expect(css).toContain(
      "@media (scripting: enabled) and (prefers-reduced-motion: no-preference) { .lintel-intro { display: grid; animation: lintel-intro-failsafe 0s 4s forwards; } }",
    );
    expect(css).toMatch(/^\.lintel-intro \{[^}]*display: none;/);
  });
});
