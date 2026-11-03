import {
  consentLifetimeDays,
  cookieNoticeElementId,
  type CookieNoticePage,
} from "@lintel/builder-model";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lifetimeDays, noticeElementId, readChoice } from "./consent-choice.js";
import { setUpCookieNotice } from "./cookie-notice.js";
import { addressWithoutAutoplay, setUpConsentFrames } from "./media-behaviours.js";

const page: CookieNoticePage = {
  storageKey: "lintel-consent:site-1",
  version: "adobe-fonts openstreetmap youtube",
  services: [
    { id: "adobe-fonts", name: "Adobe Fonts" },
    { id: "openstreetmap", name: "OpenStreetMap" },
    { id: "youtube", name: "YouTube" },
  ],
  position: "bar",
  heading: "Cookies",
  message: "This site uses OpenStreetMap and YouTube, which may set cookies.",
  privacyUrl: "/privacy",
  fontStylesheets: ["https://use.typekit.net/abc1def.css"],
  labels: {
    acceptAll: "Accept all",
    onlyNecessary: "Only necessary",
    choose: "Choose",
    save: "Save my choices",
    privacy: "Privacy",
    servicesList: "Choose what can load",
  },
};

function frame(service: string, src: string) {
  return `<div class="lintel-consent" data-behaviour="consent-frame" data-frame-src="${src}" data-frame-title="${service}" data-consent-service="${service}"><button class="lintel-consent__load">Load</button></div>`;
}

function draw(settings: CookieNoticePage | null = page) {
  document.head.innerHTML = settings
    ? `<script type="application/json" id="${noticeElementId}">${JSON.stringify(settings)}</script>`
    : "";
  document.body.innerHTML =
    '<a class="lintel-skip-link" href="#main-content">Skip</a><main id="main-content" tabindex="-1">' +
    frame("youtube", "https://www.youtube-nocookie.com/embed/abc?autoplay=1&rel=0") +
    frame("openstreetmap", "https://www.openstreetmap.org/export/embed.html") +
    '</main><footer><button data-lintel-cookie-settings="">Cookie settings</button></footer>';
}

const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(".lintel-cookie-notice button")].find(
    (candidate) => candidate.textContent === name,
  ) as HTMLButtonElement;
const frames = () => [...document.querySelectorAll("iframe")].map((made) => made.src);

beforeEach(() => localStorage.clear());
afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("the cookie notice", () => {
  it("shares its constants with the builder model", () => {
    expect(noticeElementId).toBe(cookieNoticeElementId);
    expect(lifetimeDays).toBe(consentLifetimeDays);
  });

  it("asks a first-time visitor in a region after the skip link, without taking focus", () => {
    draw();
    setUpConsentFrames(document);
    setUpCookieNotice(document);
    const region = document.querySelector(".lintel-cookie-notice");
    expect(region?.tagName).toBe("SECTION");
    expect(region?.getAttribute("aria-labelledby")).toBe("lintel-cookie-notice-heading");
    expect(document.body.children[1]).toBe(region);
    expect(region?.textContent).toContain("OpenStreetMap and YouTube");
    expect(region?.querySelector("a")?.getAttribute("href")).toBe("/privacy");
    expect(document.activeElement).toBe(document.body);
    expect(frames()).toEqual([]);
  });

  it("loads every embed without a reload once visitors accept all, and remembers it", () => {
    draw();
    setUpConsentFrames(document);
    setUpCookieNotice(document);
    button("Accept all").click();
    expect(document.querySelector(".lintel-cookie-notice")).toBeNull();
    expect(frames()).toHaveLength(2);
    // Loaded by the choice, the video doesn't start playing by itself.
    expect(frames()[0]).not.toContain("autoplay");
    expect(
      document.querySelector('link[href="https://use.typekit.net/abc1def.css"]'),
    ).not.toBeNull();

    draw();
    setUpConsentFrames(document);
    setUpCookieNotice(document);
    expect(document.querySelector(".lintel-cookie-notice")).toBeNull();
    expect(frames()).toHaveLength(2);
  });

  it("keeps the placeholders with Only necessary, each still loading on its own", () => {
    draw();
    setUpConsentFrames(document);
    setUpCookieNotice(document);
    button("Only necessary").click();
    expect(frames()).toEqual([]);
    expect(readChoice(page)?.allowed).toEqual([]);
    expect(document.querySelector('link[href*="typekit"]')).toBeNull();
    document.querySelector<HTMLButtonElement>(".lintel-consent__load")?.click();
    expect(frames()).toEqual(["https://www.youtube-nocookie.com/embed/abc?autoplay=1&rel=0"]);
  });

  it("lets visitors choose each service, and reopens from Cookie settings", () => {
    draw();
    setUpConsentFrames(document);
    setUpCookieNotice(document);
    button("Choose").click();
    const switches = [...document.querySelectorAll<HTMLInputElement>('[role="switch"]')];
    expect(switches.map((input) => input.value)).toEqual([
      "adobe-fonts",
      "openstreetmap",
      "youtube",
    ]);
    expect(document.activeElement).toBe(switches[0]);
    switches[1]?.click();
    button("Save my choices").click();
    expect(frames()).toEqual(["https://www.openstreetmap.org/export/embed.html"]);

    const opener = document.querySelector<HTMLButtonElement>("[data-lintel-cookie-settings]");
    opener?.click();
    const again = [...document.querySelectorAll<HTMLInputElement>('[role="switch"]')];
    expect(again.map((input) => input.checked)).toEqual([false, true, false]);
    expect(document.activeElement?.id).toBe("lintel-cookie-notice-heading");
  });

  it("asks again when the site's services change, or after six months", () => {
    draw();
    setUpCookieNotice(document);
    button("Accept all").click();
    expect(readChoice(page)).not.toBeNull();
    expect(readChoice({ ...page, version: "youtube" })).toBeNull();
    expect(readChoice(page, Date.now() + (lifetimeDays + 1) * 86_400_000)).toBeNull();

    draw({ ...page, version: "adobe-fonts vimeo youtube" });
    setUpCookieNotice(document);
    expect(document.querySelector(".lintel-cookie-notice")).not.toBeNull();
  });

  it("does nothing on a site without the notice: embeds wait for their own button", () => {
    draw(null);
    setUpConsentFrames(document);
    expect(setUpCookieNotice(document)).toBeNull();
    expect(document.querySelector(".lintel-cookie-notice")).toBeNull();
    expect(frames()).toEqual([]);
  });

  it("only keeps autoplay for videos set to play muted", () => {
    expect(addressWithoutAutoplay("https://x.test/v?autoplay=1&rel=0")).toBe(
      "https://x.test/v?rel=0",
    );
    expect(addressWithoutAutoplay("https://x.test/v?autoplay=1&mute=1")).toContain("autoplay=1");
  });
});
