import { brandInvitation, panelInvitation } from "../sections/closers.js";
import { featureCards, gallery, steps, story } from "../sections/features.js";
import { bannerHero, centredHero, pageHeader, splitHero } from "../sections/heroes.js";
import type { SectionTemplate } from "./section-templates.js";

/** The library's first groups: intros and banners, features, about you and pictures. */

const contact = { label: "Get in touch", href: "/contact" };

export const openingSections: readonly SectionTemplate[] = [
  {
    id: "hero",
    label: "Hero",
    category: "intro",
    description: "A big welcome at the top of the page: a title, a line about you and a button.",
    keywords: ["welcome", "header", "top"],
    blueprint: centredHero({
      heading: "Good things, made well",
      text: "Say in a sentence or two what you do and who it’s for.",
      primary: contact,
    }),
  },
  {
    id: "hero-split",
    label: "Hero with picture",
    category: "intro",
    description: "Your welcome on the left and a picture on the right.",
    keywords: ["welcome", "header", "image"],
    blueprint: splitHero({
      label: "Welcome",
      heading: "A warm hello from us",
      text: "One or two sentences about what you offer and why people come back.",
      primary: contact,
      secondary: { label: "See what we do", href: "#features" },
      picture: { name: "abstract-hills", alt: "" },
    }),
  },
  {
    id: "hero-banner",
    label: "Bold banner",
    category: "intro",
    description: "A confident title on your brand colour, for launches and big news.",
    keywords: ["launch", "announcement", "news"],
    blueprint: bannerHero({
      heading: "Something new is here",
      text: "Tell visitors what changed and why it matters to them.",
      primary: { label: "Find out more", href: "#more" },
    }),
  },
  {
    id: "page-title",
    label: "Page title",
    category: "intro",
    description: "A quieter start for inner pages: a small label, the page's title and a line.",
    keywords: ["header", "inner page", "heading", "menu page", "services page"],
    blueprint: pageHeader({
      label: "About",
      heading: "A title for this page",
      text: "A sentence that tells visitors what they'll find here.",
    }),
  },
  {
    id: "call-to-action",
    label: "Call to action",
    category: "intro",
    description: "A short invitation with a button, in your brand colour.",
    keywords: ["banner", "sign up", "cta", "invitation"],
    blueprint: brandInvitation({
      heading: "Ready when you are",
      text: "Book a free call and we’ll talk it through.",
      button: { label: "Book a call", href: "/contact" },
    }),
  },
  {
    id: "call-to-action-panel",
    label: "Quiet call to action",
    category: "intro",
    description: "An invitation on a soft panel, with the button to one side.",
    keywords: ["banner", "cta", "invitation"],
    blueprint: panelInvitation({
      heading: "Have a question?",
      text: "Send us a note. We usually reply the same day.",
      button: contact,
    }),
  },
  {
    id: "features",
    label: "Three features",
    category: "features",
    description: "Three short points side by side, such as what makes you different.",
    keywords: ["benefits", "services", "why us", "cards"],
    blueprint: featureCards({
      heading: "Why people choose us",
      points: [
        { heading: "Friendly", text: "Explain the first thing people love about you." },
        { heading: "Fast", text: "And the second, in a sentence or two." },
        { heading: "Local", text: "And a third, to round it off." },
      ],
    }),
  },
  {
    id: "steps",
    label: "Numbered steps",
    category: "features",
    description: "How it works, in three or four simple steps.",
    keywords: ["how it works", "process"],
    blueprint: steps({
      heading: "How it works",
      points: [
        { heading: "Say hello", text: "Tell us what you need." },
        { heading: "We plan it", text: "You get a clear plan and price." },
        { heading: "It’s done", text: "We do the work and check in after." },
      ],
    }),
  },
  {
    id: "text-and-picture",
    label: "Text beside a picture",
    category: "about",
    description:
      "A heading and a few lines next to a picture. On phones the picture goes underneath.",
    keywords: ["story", "about us", "team"],
    blueprint: story({
      heading: "Our story",
      text: "Tell visitors how you started and what you care about.",
      more: { label: "Meet the team", href: "/about" },
      picture: { name: "abstract-window", alt: "" },
    }),
  },
  {
    id: "story-with-points",
    label: "Story with key points",
    category: "about",
    description: "A picture first, then a few lines about you and a short list of key points.",
    keywords: ["about us", "history", "team", "values", "bakery", "studio", "consultant"],
    blueprint: story({
      heading: "Where we came from",
      text: "A few lines about how you began, and what hasn't changed since.",
      points: ["A fact people like to know", "Another one", "And a third"],
      picture: { name: "abstract-circles", alt: "" },
      pictureFirst: true,
      tone: "panel",
    }),
  },
  {
    id: "gallery",
    label: "Gallery",
    category: "pictures",
    description: "Pictures with short captions, for work you’re proud of.",
    keywords: ["portfolio", "projects", "work", "images", "photos"],
    blueprint: gallery({
      heading: "Recent work",
      items: [
        { picture: "abstract-hills", alt: "", title: "First project", text: "A line about it." },
        { picture: "abstract-window", alt: "", title: "Second project", text: "A line about it." },
        { picture: "abstract-circles", alt: "", title: "Third project", text: "A line about it." },
      ],
    }),
  },
  {
    id: "pictures-with-prices",
    label: "Pictures with prices",
    category: "pictures",
    description: "A few things you offer, each with a picture, a line and its price.",
    keywords: ["menu", "price list", "bakery", "café", "cafe", "restaurant", "products", "dishes"],
    blueprint: gallery({
      label: "What we offer",
      heading: "On the menu",
      items: [
        { picture: "abstract-hills", alt: "", title: "First thing", text: "A line about it. £4" },
        { picture: "abstract-window", alt: "", title: "Second thing", text: "A line about it. £6" },
        { picture: "abstract-circles", alt: "", title: "Third thing", text: "A line about it. £8" },
      ],
    }),
  },
];
