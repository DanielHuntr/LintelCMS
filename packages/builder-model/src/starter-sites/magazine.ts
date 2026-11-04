import { brandInvitation, columnsFooter } from "../sections/closers.js";
import { gallery, story } from "../sections/features.js";
import { pageHeader, splitHero } from "../sections/heroes.js";
import { facts, singleQuote } from "../sections/social-proof.js";
import type { StarterSite } from "./starter-site.js";

export const magazineSite: StarterSite = {
  id: "magazine",
  name: "Blog and magazine",
  description:
    "A readable, editorial site for writing: a front page of stories, sections, an about page and a newsletter invitation.",
  suitedTo: "Writers, journals, newsletters and community magazines",
  features: ["blog"],
  coverIllustration: "magazine-pages",
  theme: {
    brandColour: "#4f6f45",
    accentColour: "#9a4a2b",
    fontPairing: "editorial",
    cornerStyle: "soft",
  },
  pages: [
    {
      slug: "home",
      title: "Home",
      summary: "Stories about growing, cooking and living with the seasons.",
      sections: [
        splitHero({
          label: "This week",
          heading: "The quiet pleasure of a winter garden",
          text: "Frost, bare branches and the surprising amount there is to do. Our longest read this month, with planting notes for the cold weeks.",
          primary: { label: "Read the story", href: "/blog" },
          secondary: { label: "Subscribe", href: "/newsletter" },
          picture: { name: "magazine-leaf", alt: "A green leaf on its stem" },
        }),
        gallery({
          label: "Latest",
          heading: "New this month",
          items: [
            {
              picture: "magazine-pages",
              alt: "An open notebook",
              title: "Keeping a garden diary",
              text: "Why ten minutes of notes now saves a season of guessing.",
            },
            {
              picture: "magazine-lamp",
              alt: "A warm reading lamp",
              title: "Long evenings, good books",
              text: "Twelve readers share what they’re reading by the fire.",
            },
            {
              picture: "magazine-leaf",
              alt: "A green leaf on its stem",
              title: "Soup from the last of the veg",
              text: "Three recipes for whatever is left in the crate.",
            },
          ],
        }),
        singleQuote({
          words: "The one newsletter I read the moment it arrives.",
          name: "A reader in Shropshire",
        }),
        brandInvitation({
          heading: "A letter every Sunday",
          text: "One email a week with our newest stories and a seasonal to-do list. Free, and easy to leave.",
          button: { label: "Subscribe", href: "/newsletter" },
        }),
      ],
    },
    {
      slug: "sections",
      title: "Sections",
      summary: "Stories by subject: growing, cooking and making.",
      sections: [
        pageHeader({
          label: "Sections",
          heading: "Find your corner",
          text: "Every story belongs to one of three sections. Start wherever you like.",
        }),
        story({
          heading: "Growing",
          text: "Practical notes from allotments, window boxes and back gardens, month by month.",
          more: { label: "Read growing stories", href: "/blog" },
          picture: { name: "magazine-leaf", alt: "A green leaf on its stem" },
        }),
        story({
          heading: "Cooking",
          text: "Simple, seasonal recipes that make the most of what’s around right now.",
          more: { label: "Read cooking stories", href: "/blog" },
          picture: { name: "magazine-lamp", alt: "A warm reading lamp" },
          pictureFirst: true,
          tone: "panel",
        }),
        story({
          heading: "Making",
          text: "Mending, building and crafting with what you have, from readers who love to tinker.",
          more: { label: "Read making stories", href: "/blog" },
          picture: { name: "magazine-pages", alt: "An open notebook" },
        }),
      ],
    },
    {
      slug: "about",
      title: "About",
      summary: "Who writes the magazine, and how to write for us.",
      sections: [
        pageHeader({
          label: "About",
          heading: "Written by people who do it",
          text: "No experts, no sponsors: just readers sharing what they’ve learned.",
        }),
        facts([
          { value: "6", label: "years of stories" },
          { value: "140", label: "contributors" },
          { value: "9,000", label: "Sunday readers" },
        ]),
        story({
          heading: "Write for us",
          text: "Have something to share? Send us a paragraph about your idea. We pay every contributor and help with editing.",
          more: { label: "Email the editors", href: "mailto:editors@example.com" },
          picture: { name: "magazine-pages", alt: "An open notebook" },
        }),
      ],
    },
    {
      slug: "newsletter",
      title: "Newsletter",
      summary: "Get our newest stories every Sunday.",
      sections: [
        pageHeader({
          label: "Newsletter",
          heading: "Sunday letters",
          text: "A short, friendly email each week. We never share your address.",
        }),
        brandInvitation({
          heading: "Join 9,000 readers",
          text: "Send an email with the word ‘subscribe’ and we’ll add you to the list.",
          button: {
            label: "Subscribe by email",
            href: "mailto:letters@example.com?subject=subscribe",
          },
        }),
      ],
    },
  ],
  siteSections: {
    footer: columnsFooter({
      about:
        "An independent magazine about living with the seasons, written by readers and friends.",
      columns: [
        {
          heading: "Read",
          links: [
            { label: "All stories", href: "/blog" },
            { label: "Sections", href: "/sections" },
          ],
        },
        {
          heading: "Join in",
          links: [
            { label: "Newsletter", href: "/newsletter" },
            { label: "About us", href: "/about" },
          ],
        },
      ],
    }),
  },
};
