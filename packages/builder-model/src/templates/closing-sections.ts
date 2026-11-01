import {
  columnsFooter,
  contactDetails,
  contactForm,
  questions,
  simpleFooter,
} from "../sections/closers.js";
import { productShowcase } from "../sections/shop.js";
import { facts, pricing, quoteCards, singleQuote } from "../sections/social-proof.js";
import { booking, openingTimes } from "../sections/visits.js";
import type { SectionTemplate } from "./section-templates.js";

/** The library's later groups: proof, prices, questions, contact and booking, shop, footers. */

const contact = { label: "Get in touch", href: "/contact" };

export const closingSections: readonly SectionTemplate[] = [
  {
    id: "testimonial",
    label: "Customer quote",
    category: "proof",
    description: "A kind word from a customer, big and centred.",
    keywords: ["testimonial", "review"],
    blueprint: singleQuote({
      words: "They were a joy to work with, and the results speak for themselves.",
      name: "Alex, a happy customer",
    }),
  },
  {
    id: "testimonials",
    label: "Three quotes",
    category: "proof",
    description: "Kind words from three customers, in cards.",
    keywords: ["testimonials", "reviews"],
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
    id: "facts",
    label: "Facts and figures",
    category: "proof",
    description: "A row of big numbers that show what you’ve done.",
    keywords: ["numbers", "statistics", "stats"],
    blueprint: facts([
      { value: "12", label: "years in business" },
      { value: "400+", label: "happy customers" },
      { value: "4.9", label: "average rating" },
    ]),
  },
  {
    id: "pricing",
    label: "Prices",
    category: "pricing",
    description: "Up to three plans or packages side by side, with what each includes.",
    keywords: ["plans", "packages", "pricing", "services", "consultant"],
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
    keywords: ["faq", "frequently asked"],
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
    id: "contact",
    label: "Contact details",
    category: "contact",
    description: "Phone, email, address and opening hours, with buttons to call or write.",
    keywords: ["phone", "email", "address", "find us"],
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
    id: "opening-times",
    label: "Opening times",
    category: "contact",
    description: "When you're open, day by day, beside where to find you.",
    keywords: [
      "opening hours",
      "hours",
      "visit",
      "bakery",
      "café",
      "cafe",
      "shop",
      "restaurant",
      "salon",
    ],
    blueprint: openingTimes({
      heading: "When we're open",
      text: "Drop in any time during these hours. No need to book.",
      days: [
        { day: "Monday to Friday", hours: "8am to 5pm" },
        { day: "Saturday", hours: "9am to 3pm" },
        { day: "Sunday", hours: "Closed" },
      ],
      address: "1 High Street, Your Town",
      directions: "Five minutes' walk from the station, with parking round the back.",
    }),
  },
  {
    id: "booking",
    label: "Booking",
    category: "contact",
    description: "How to book a time with you, in three short steps, with a button to book.",
    keywords: [
      "appointment",
      "book a call",
      "consultation",
      "consultant",
      "reservation",
      "salon",
      "schedule",
    ],
    blueprint: booking({
      heading: "Book a time that suits you",
      text: "It takes a minute, and you'll hear back the same day.",
      steps: [
        { heading: "Pick a time", text: "Choose a day and time that works for you." },
        { heading: "Tell us a little", text: "A line or two about what you need." },
        { heading: "We confirm", text: "You get a confirmation and a reminder." },
      ],
      button: { label: "Book now", href: "/contact" },
    }),
  },
  {
    id: "contact-form",
    label: "Contact form",
    category: "contact",
    description: "A heading, a line and one of your forms, so visitors can write to you.",
    keywords: ["form", "message", "enquiry", "enquiries", "get in touch"],
    blueprint: contactForm({
      heading: "Send us a message",
      text: "We'll reply within a working day.",
      formHandle: "",
    }),
  },
  {
    id: "featured-products",
    label: "Featured products",
    category: "shop",
    description: "A few products from your shop, in a row.",
    keywords: ["store", "products", "best sellers", "ecommerce"],
    blueprint: productShowcase({
      heading: "Our favourites",
      text: "A few things people love right now.",
      limit: 4,
      columns: 4,
      browsable: false,
    }),
  },
  {
    id: "product-range",
    label: "All products",
    category: "shop",
    description: "Every product, or one collection, that visitors can sort and page through.",
    keywords: ["store", "catalogue", "catalog", "ecommerce"],
    blueprint: productShowcase({
      heading: "Shop",
      limit: 12,
      columns: 3,
      browsable: true,
    }),
  },
  {
    id: "footer-simple",
    label: "Simple footer",
    category: "footer",
    description: "A closing line and a few links at the very end of the page.",
    keywords: ["footer", "links"],
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
    keywords: ["footer", "links", "sitemap"],
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
