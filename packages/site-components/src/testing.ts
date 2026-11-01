import type { ReactElement } from "react";
import { renderComponentHtml } from "./document/render-html.js";
import type { SiteChrome, SiteImage } from "./site.types.js";

/** Shared examples for the tests: a component's HTML, and plain props to render with. */

export function html(element: ReactElement): string {
  return renderComponentHtml(element);
}

export const photo: SiteImage = {
  url: "http://localhost:4000/media/6f1c2a8e/file?v=abc",
  alt: "Loaves cooling on a rack",
  width: 2000,
  height: 1500,
  focalPoint: { x: 0.3, y: 0.6 },
};

export const chrome: SiteChrome = {
  siteName: "Corner Bakery",
  logo: null,
  homeUrl: "/",
  menu: [
    { label: "Home", url: "/", newTab: false, current: true, children: [] },
    {
      label: "Menu",
      url: "/menu",
      newTab: false,
      current: false,
      children: [{ label: "Cakes", url: "/cakes", newTab: false, current: false, children: [] }],
    },
  ],
  footerText: "Fresh bread every morning.",
  contactEmail: "hello@cornerbakery.example",
  socialLinks: ["https://www.instagram.com/cornerbakery"],
  languages: [],
  locale: "en-GB",
};
