import {
  footerBigName,
  footerCentred,
  footerOneLine,
  navigationCentred,
  navigationLogoLeft,
  navigationMinimal,
  navigationOverlay,
  navigationWithButton,
} from "../sections/site-navigation.js";
import type { SectionTemplate } from "./section-templates.js";

/**
 * The Navigation and Footer groups: sections added once for the whole site and shown on
 * every page (see site-sections/). Their links follow the site's main menu.
 */

const smallPrint = "Replace this with your small print, such as your company number.";

export const navigationSections: readonly SectionTemplate[] = [
  {
    id: "navigation-logo-left",
    label: "Logo and menu",
    category: "navigation",
    description: "Your logo on the left and your menu on the right.",
    keywords: ["header", "nav", "navbar", "menu", "top bar"],
    blueprint: navigationLogoLeft(),
  },
  {
    id: "navigation-centred",
    label: "Centred logo",
    category: "navigation",
    description: "Your logo in the middle, with the menu underneath.",
    keywords: ["header", "nav", "navbar", "menu", "centred", "centered"],
    blueprint: navigationCentred(),
  },
  {
    id: "navigation-button",
    label: "Menu and button",
    category: "navigation",
    description: "Logo, menu and one button that stands out. Stays at the top while scrolling.",
    keywords: ["header", "nav", "navbar", "call to action", "sticky", "book"],
    blueprint: navigationWithButton({ label: "Get in touch", href: "/contact" }),
  },
  {
    id: "navigation-overlay",
    label: "Over the first section",
    category: "navigation",
    description: "See-through, sitting over the top of the page. Best above a big picture.",
    keywords: ["header", "nav", "transparent", "see-through", "hero", "overlay"],
    blueprint: navigationOverlay(),
  },
  {
    id: "navigation-minimal",
    label: "Logo and Menu button",
    category: "navigation",
    description: "Just your logo and a Menu button that opens the menu, on every screen.",
    keywords: ["header", "nav", "hamburger", "drawer", "minimal", "portfolio"],
    blueprint: navigationMinimal(),
  },
];

export const extraFooterSections: readonly SectionTemplate[] = [
  {
    id: "footer-centred",
    label: "Centred footer",
    category: "footer",
    description: "Your logo, your menu and a line of small print, centred.",
    keywords: ["footer", "menu", "links", "small print"],
    blueprint: footerCentred({ smallPrint }),
  },
  {
    id: "footer-one-line",
    label: "One-line footer",
    category: "footer",
    description: "Logo and small print on the left, your menu on the right.",
    keywords: ["footer", "menu", "links", "minimal"],
    blueprint: footerOneLine({ smallPrint }),
  },
  {
    id: "footer-big-name",
    label: "Big name footer",
    category: "footer",
    description: "Your site's name, big, over your menu and small print.",
    keywords: ["footer", "statement", "dark", "menu"],
    blueprint: footerBigName({ smallPrint }),
  },
];
