import { brandInvitation, simpleFooter } from "../sections/closers.js";
import { gallery, steps, story } from "../sections/features.js";
import { bannerHero, pageHeader } from "../sections/heroes.js";
import { quoteCards } from "../sections/social-proof.js";
import type { StarterSite } from "./starter-site.js";

export const portfolioSite: StarterSite = {
  id: "portfolio",
  name: "Portfolio",
  description:
    "A bold site for showing your work: selected projects, how you work and how to hire you.",
  suitedTo: "Designers, illustrators, photographers and studios",
  coverIllustration: "portfolio-frame",
  theme: {
    brandColour: "#d63b1f",
    accentColour: "#1d1d1f",
    fontPairing: "geometric",
    cornerStyle: "square",
  },
  pages: [
    {
      slug: "home",
      title: "Home",
      summary: "Brand identities and illustration for people who make things.",
      sections: [
        bannerHero({
          heading: "Identities with a bit of nerve",
          text: "I’m Jules, an independent designer making logos, type and illustration for small brands with big opinions.",
          primary: { label: "See the work", href: "/work" },
        }),
        gallery({
          label: "Selected work",
          heading: "A few recent favourites",
          items: [
            {
              picture: "portfolio-frame",
              alt: "Poster with a red circle and black block",
              title: "Northside Cinema",
              text: "A new identity and a season of posters.",
            },
            {
              picture: "portfolio-shapes",
              alt: "Black, red and yellow shapes",
              title: "Kiln & Co.",
              text: "Packaging for a ceramics studio.",
            },
            {
              picture: "portfolio-type",
              alt: "Large serif letters on yellow",
              title: "Field Notes Festival",
              text: "A typeface and signage system.",
            },
          ],
        }),
        brandInvitation({
          heading: "Got a project?",
          text: "I take on four new projects a season. Tell me about yours.",
          button: { label: "Start a conversation", href: "/contact" },
        }),
      ],
    },
    {
      slug: "work",
      title: "Work",
      summary: "Projects from the last few years.",
      sections: [
        pageHeader({
          label: "Work",
          heading: "Projects",
          text: "Each one started with a conversation and a blank page.",
        }),
        story({
          heading: "Northside Cinema",
          text: "A neighbourhood cinema reopening after twenty years needed a look that felt new but familiar. We built a flexible poster system around a single red dot: the projector light.",
          points: ["Identity and signage", "Forty-two posters", "Website art direction"],
          picture: { name: "portfolio-frame", alt: "A cinema poster" },
        }),
        story({
          heading: "Kiln & Co.",
          text: "Packaging for handmade ceramics that had to survive the post and still feel special when opened. Recycled card, one colour of ink and a lot of folding tests.",
          points: ["Packaging", "Illustration", "Shop photography styling"],
          picture: { name: "portfolio-shapes", alt: "Packaging shapes" },
          pictureFirst: true,
          tone: "panel",
        }),
        story({
          heading: "Field Notes Festival",
          text: "A typeface drawn for a three-day festival of nature writing, used on everything from wristbands to a forty-metre banner.",
          picture: { name: "portfolio-type", alt: "Lettering on a yellow background" },
        }),
      ],
    },
    {
      slug: "about",
      title: "About",
      summary: "How I work, and what clients say.",
      sections: [
        pageHeader({
          label: "About",
          heading: "Small studio, close collaboration",
          text: "You’ll work with me directly, from the first sketch to the final files.",
        }),
        steps({
          heading: "How a project goes",
          points: [
            {
              heading: "Brief",
              text: "We talk about your audience, your rivals and what you’re proud of.",
            },
            { heading: "Sketch", text: "Three directions on paper, so we can choose together." },
            { heading: "Refine", text: "One direction, polished over two rounds of changes." },
            { heading: "Hand over", text: "Every file you need, and a short guide to using them." },
          ],
        }),
        quoteCards({
          heading: "Kind words",
          quotes: [
            {
              words: "Jules understood us faster than we understood ourselves.",
              name: "Northside Cinema",
            },
            { words: "Our boxes get photographed more than our pots now.", name: "Kiln & Co." },
            { words: "Bold, thoughtful and always on time.", name: "Field Notes Festival" },
          ],
        }),
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      summary: "Hire me or say hello.",
      sections: [
        pageHeader({
          label: "Contact",
          heading: "Say hello",
          text: "Email is best. I reply within two working days.",
        }),
        brandInvitation({
          heading: "jules@example.com",
          text: "Tell me what you’re making, when you need it and roughly what you’d like to spend.",
          button: { label: "Write an email", href: "mailto:jules@example.com" },
        }),
        simpleFooter({
          text: "Based in Bristol, working with people everywhere.",
          links: [
            { label: "Work", href: "/work" },
            { label: "About", href: "/about" },
          ],
        }),
      ],
    },
  ],
};
