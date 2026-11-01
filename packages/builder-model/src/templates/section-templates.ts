import type { NodeBlueprint } from "../components/component-definition.js";
import {
  columnsFooter,
  contactDetails,
  brandInvitation,
  panelInvitation,
  questions,
  simpleFooter,
} from "../sections/closers.js";
import { featureCards, gallery, steps, story } from "../sections/features.js";
import { bannerHero, centredHero, splitHero } from "../sections/heroes.js";
import { facts, pricing, quoteCards, singleQuote } from "../sections/social-proof.js";

/**
 * The section library: ready-made sections for the Insert panel and the empty-page start,
 * grouped by what they are for. Each is made of ordinary elements, so everything in it can
 * be changed like anything else on the page, and each comes with gentle animations that
 * anyone can change or remove in the Animate panel.
 *
 * The same section builders (src/sections) make the starter sites, with their own words.
 */

export const sectionCategories = [
  "hero",
  "features",
  "story",
  "testimonials",
  "pricing",
  "questions",
  "callToAction",
  "contact",
  "footer",
] as const;
export type SectionCategory = (typeof sectionCategories)[number];

export interface SectionTemplate {
  id: string;
  label: string;
  /** One plain sentence: what the section is good for. */
  description: string;
  category: SectionCategory;
  blueprint: NodeBlueprint;
}

const contact = { label: "Get in touch", href: "/contact" };

export const sectionTemplates: readonly SectionTemplate[] = [
  {
    id: "hero",
    label: "Hero",
    category: "hero",
    description: "A big welcome at the top of the page: a title, a line about you and a button.",
    blueprint: centredHero({
      heading: "Good things, made well",
      text: "Say in a sentence or two what you do and who it’s for.",
      primary: contact,
    }),
  },
  {
    id: "hero-split",
    label: "Hero with picture",
    category: "hero",
    description: "Your welcome on the left and a picture on the right.",
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
    category: "hero",
    description: "A confident title on your brand colour, for launches and big news.",
    blueprint: bannerHero({
      heading: "Something new is here",
      text: "Tell visitors what changed and why it matters to them.",
      primary: { label: "Find out more", href: "#more" },
    }),
  },
  {
    id: "features",
    label: "Three features",
    category: "features",
    description: "Three short points side by side, such as what makes you different.",
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
    id: "facts",
    label: "Facts and figures",
    category: "features",
    description: "A row of big numbers that show what you’ve done.",
    blueprint: facts([
      { value: "12", label: "years in business" },
      { value: "400+", label: "happy customers" },
      { value: "4.9", label: "average rating" },
    ]),
  },
  {
    id: "text-and-picture",
    label: "Text beside a picture",
    category: "story",
    description:
      "A heading and a few lines next to a picture. On phones the picture goes underneath.",
    blueprint: story({
      heading: "Our story",
      text: "Tell visitors how you started and what you care about.",
      more: { label: "Meet the team", href: "/about" },
      picture: { name: "abstract-window", alt: "" },
    }),
  },
  {
    id: "gallery",
    label: "Gallery",
    category: "story",
    description: "Pictures with short captions, for work you’re proud of.",
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
    id: "testimonial",
    label: "Customer quote",
    category: "testimonials",
    description: "A kind word from a customer, big and centred.",
    blueprint: singleQuote({
      words: "They were a joy to work with, and the results speak for themselves.",
      name: "Alex, a happy customer",
    }),
  },
  {
    id: "testimonials",
    label: "Three quotes",
    category: "testimonials",
    description: "Kind words from three customers, in cards.",
    blueprint: quoteCards({
      heading: "What people say",
      quotes: [
        { words: "Quick, kind and careful. Exactly what we hoped for.", name: "Sam" },
        { words: "We’ve recommended them to everyone we know.", name: "Priya" },
        { words: "Clear prices, no surprises, lovely people.", name: "Jordan" },
      ],
    }),
  },
  {
    id: "pricing",
    label: "Prices",
    category: "pricing",
    description: "Up to three plans or packages side by side, with what each includes.",
    blueprint: pricing({
      heading: "Simple prices",
      text: "Pick what suits you. You can change at any time.",
      plans: [
        {
          name: "Starter",
          price: "£19",
          description: "For trying it out.",
          includes: ["One thing", "Another thing"],
          button: contact,
        },
        {
          name: "Standard",
          price: "£49",
          description: "Most people pick this.",
          includes: ["Everything in Starter", "Something more"],
          button: contact,
          highlighted: true,
        },
        {
          name: "Complete",
          price: "£99",
          description: "For when you want it all.",
          includes: ["Everything in Standard", "Our full attention"],
          button: contact,
        },
      ],
    }),
  },
  {
    id: "questions",
    label: "Questions and answers",
    category: "questions",
    description: "Common questions with short answers, so visitors don’t have to ask.",
    blueprint: questions({
      heading: "Questions people ask",
      items: [
        {
          question: "How long does it take?",
          answer: "Most projects take two to four weeks from the first call.",
        },
        {
          question: "What does it cost?",
          answer: "Prices start at a fixed fee; we’ll agree it before we start.",
        },
      ],
    }),
  },
  {
    id: "call-to-action",
    label: "Call to action",
    category: "callToAction",
    description: "A short invitation with a button, in your brand colour.",
    blueprint: brandInvitation({
      heading: "Ready when you are",
      text: "Book a free call and we’ll talk it through.",
      button: { label: "Book a call", href: "/contact" },
    }),
  },
  {
    id: "call-to-action-panel",
    label: "Quiet call to action",
    category: "callToAction",
    description: "An invitation on a soft panel, with the button to one side.",
    blueprint: panelInvitation({
      heading: "Have a question?",
      text: "Send us a note. We usually reply the same day.",
      button: contact,
    }),
  },
  {
    id: "contact",
    label: "Contact details",
    category: "contact",
    description: "Phone, email, address and opening hours, with buttons to call or write.",
    blueprint: contactDetails({
      heading: "Come and say hello",
      text: "Call, email or drop in. We’d love to hear from you.",
      phone: "01234 567890",
      email: "hello@example.com",
      address: "1 High Street, Your Town",
      hours: ["Monday to Friday, 9am to 5pm", "Saturday, 10am to 2pm"],
    }),
  },
  {
    id: "footer-simple",
    label: "Simple footer",
    category: "footer",
    description: "A closing line and a few links at the very end of the page.",
    blueprint: simpleFooter({
      text: "Thanks for stopping by.",
      links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
      ],
    }),
  },
  {
    id: "footer-columns",
    label: "Footer with columns",
    category: "footer",
    description: "A dark closing band with a line about you and columns of links.",
    blueprint: columnsFooter({
      about: "A sentence about who you are and where you are.",
      columns: [
        {
          heading: "Explore",
          links: [
            { label: "About", href: "/about" },
            { label: "Contact", href: "/contact" },
          ],
        },
        { heading: "Follow", links: [{ label: "Newsletter", href: "/newsletter" }] },
      ],
    }),
  },
];

export function findSectionTemplate(templateId: string): SectionTemplate | undefined {
  return sectionTemplates.find((template) => template.id === templateId);
}
