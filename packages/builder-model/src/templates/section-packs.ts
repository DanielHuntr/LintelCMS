import {
  alternatingRows,
  comparisonTable,
  dragGallery,
  featureListWithPicture,
  founderNote,
  numberedPoints,
  pictureWall,
  teamGrid,
} from "../sections/pack-features.js";
import {
  bigNumberHero,
  bigTypeHero,
  editorialHero,
  newsletterStrip,
  splitInvitation,
  videoHero,
  widePictureHero,
} from "../sections/pack-intros.js";
import {
  contactBesideForm,
  contactWithMap,
  countingNumbers,
  footerBigInvitation,
  footerQuiet,
  footerWithSignUp,
  nameRow,
  openingQuestions,
  planComparison,
  portraitQuote,
  questionsBesideTitle,
  quoteWall,
  scrollingNames,
  singlePlan,
  statBand,
} from "../sections/pack-closers.js";
import type { SectionTemplate } from "./section-templates.js";

/**
 * The section packs: more layouts for each group of the library, so a page can open,
 * explain, prove and close in more than one way. Words are plain placeholders that say
 * what goes there; pictures are the library's own abstract illustrations, ready to swap.
 */

const contact = { label: "Get in touch", href: "/contact" };
const smallPrint = "Replace this with your small print, such as your company number.";
const names = ["Northfield", "Harbour & Hale", "Copperline", "Ostra", "Westmere", "Lumen Co."];
const hills = { name: "abstract-hills", alt: "" };
const windowShape = { name: "abstract-window", alt: "" };
const circles = { name: "abstract-circles", alt: "" };

export const sectionPacks: readonly SectionTemplate[] = [
  // Intros
  {
    id: "intro-editorial",
    label: "Editorial intro",
    category: "intro",
    description: "A big title on the left and a short introduction set lower on the right.",
    keywords: ["hero", "header", "welcome", "editorial", "statement", "agency", "law firm"],
    blueprint: editorialHero({
      label: "Welcome",
      heading: "Say what you do in one confident line",
      text: "Then a sentence or two on who it’s for and what makes the way you work different.",
      more: { label: "See how we work", href: "#how-it-works" },
    }),
  },
  {
    id: "intro-big-number",
    label: "Intro with a big number",
    category: "intro",
    description: "Your welcome beside one number you’re proud of, with a caption.",
    keywords: ["hero", "header", "welcome", "statistic", "years", "proof"],
    blueprint: bigNumberHero({
      heading: "A welcome that gets to the point",
      text: "One or two sentences about what you offer and why people pick you.",
      primary: contact,
      number: "25",
      caption: "years of doing this well",
    }),
  },
  {
    id: "intro-video",
    label: "Intro with video",
    category: "intro",
    description: "A centred welcome over a wide video. Paste a YouTube or Vimeo link to show it.",
    keywords: ["hero", "video", "film", "showreel", "youtube", "vimeo", "music", "launch", "app"],
    blueprint: videoHero({
      heading: "See it for yourself",
      text: "A short film says more than a page of words. Add yours from YouTube or Vimeo.",
      primary: contact,
      videoTitle: "A short film about us",
    }),
  },
  {
    id: "intro-big-type",
    label: "Big type intro",
    category: "intro",
    description: "A few words in very big type across the page, with a line and a link under it.",
    keywords: ["hero", "header", "typography", "bold", "statement", "poster", "band", "creative"],
    blueprint: bigTypeHero({
      heading: "Make it big.",
      text: "A short line under the big words: who you are and what you do.",
      more: { label: "Find out more", href: "#more" },
    }),
  },
  {
    id: "intro-wide-picture",
    label: "Intro with a wide picture",
    category: "intro",
    description: "A short title, then a picture across the page with a small caption.",
    keywords: ["hero", "header", "image", "photo", "banner", "property", "place", "venue"],
    blueprint: widePictureHero({
      label: "Welcome",
      heading: "A title that sits above your best picture",
      picture: hills,
      caption: "A short caption: where or when the picture was taken.",
    }),
  },
  {
    id: "call-to-action-split",
    label: "Split call to action",
    category: "intro",
    description: "An invitation and a button on your brand colour, with a picture beside it.",
    keywords: ["cta", "banner", "sign up", "invitation", "book", "valuation", "trial"],
    blueprint: splitInvitation({
      heading: "Ready to start?",
      text: "Tell visitors what happens when they click, and how long it takes.",
      button: contact,
      picture: windowShape,
    }),
  },
  // Features
  {
    id: "features-alternating",
    label: "Alternating rows",
    category: "features",
    description: "A few points, each with a picture, the pictures swapping sides row by row.",
    keywords: ["features", "benefits", "services", "zigzag", "how it works", "product", "app"],
    blueprint: alternatingRows({
      heading: "What you get",
      rows: [
        {
          heading: "The first good thing",
          text: "Two sentences about it and why it matters.",
          picture: hills,
        },
        {
          heading: "The second good thing",
          text: "Two sentences about it and why it matters.",
          picture: windowShape,
        },
        {
          heading: "The third good thing",
          text: "Two sentences about it and why it matters.",
          picture: circles,
        },
      ],
    }),
  },
  {
    id: "features-list-picture",
    label: "Feature list with picture",
    category: "features",
    description: "A tall picture beside a list of points, each with a tick and a line.",
    keywords: ["features", "benefits", "checklist", "included", "services", "what's included"],
    blueprint: featureListWithPicture({
      label: "What’s included",
      heading: "Everything you need, nothing you don’t",
      picture: circles,
      features: [
        { title: "A clear first point", text: "One sentence that explains it." },
        { title: "A second point", text: "One sentence that explains it." },
        { title: "A third point", text: "One sentence that explains it." },
        { title: "And a fourth", text: "One sentence that explains it." },
      ],
    }),
  },
  {
    id: "features-comparison",
    label: "Comparison table",
    category: "features",
    description: "How you compare with the usual way, point by point, in a simple table.",
    keywords: ["compare", "versus", "vs", "table", "difference", "why us", "software"],
    blueprint: comparisonTable({
      heading: "How we compare",
      text: "Be fair and specific: people trust a comparison that admits trade-offs.",
      columns: ["", "With us", "The usual way"],
      rows: [
        ["Price", "Fixed, agreed up front", "Hourly, open-ended"],
        ["Time to start", "This week", "A month or more"],
        ["Who you talk to", "The person doing the work", "An account manager"],
        ["Changes", "Two rounds included", "Charged extra"],
      ],
    }),
  },
  {
    id: "features-numbered",
    label: "Numbered points",
    category: "features",
    description: "Four points with big numbers, two by two, divided by thin lines.",
    keywords: ["features", "principles", "values", "services", "list", "reasons"],
    blueprint: numberedPoints({
      heading: "Four things to know",
      points: [
        { heading: "The first thing", text: "A sentence or two about it." },
        { heading: "The second thing", text: "A sentence or two about it." },
        { heading: "The third thing", text: "A sentence or two about it." },
        { heading: "The fourth thing", text: "A sentence or two about it." },
      ],
    }),
  },
  // About
  {
    id: "team-grid",
    label: "Team",
    category: "about",
    description: "The people behind it, each with a photo, their name and what they do.",
    keywords: ["team", "people", "staff", "about us", "who we are", "partners", "hosts"],
    blueprint: teamGrid({
      label: "The team",
      heading: "The people you’ll work with",
      people: [
        { name: "First person", role: "What they do", picture: circles },
        { name: "Second person", role: "What they do", picture: windowShape },
        { name: "Third person", role: "What they do", picture: hills },
        { name: "Fourth person", role: "What they do", picture: circles },
      ],
    }),
  },
  {
    id: "founder-note",
    label: "Founder’s note",
    category: "about",
    description: "A short, signed letter from the person behind it all, beside their picture.",
    keywords: ["about us", "story", "letter", "owner", "welcome", "personal"],
    blueprint: founderNote({
      label: "A note from me",
      heading: "Why I started this",
      text: "Write this as you’d say it to someone across a table: how it began, what you care about and what people can expect.\n\nKeep it short. Two paragraphs are plenty.",
      signature: "Your name",
      picture: windowShape,
    }),
  },
  // Pictures
  {
    id: "picture-wall",
    label: "Picture wall",
    category: "pictures",
    description: "Pictures of different shapes in three columns, like a pinboard.",
    keywords: ["gallery", "masonry", "photos", "images", "work", "projects", "moodboard"],
    blueprint: pictureWall({
      heading: "A closer look",
      pictures: [hills, windowShape, circles, windowShape, circles, hills],
    }),
  },
  {
    id: "drag-gallery",
    label: "Drag gallery",
    category: "pictures",
    description: "A row of pictures with captions that visitors drag sideways.",
    keywords: ["gallery", "carousel", "slider", "drag", "projects", "work", "listings", "releases"],
    blueprint: dragGallery({
      heading: "Recent work",
      more: { label: "See everything", href: "#" },
      items: [
        { title: "First piece", text: "A line about it", picture: hills },
        { title: "Second piece", text: "A line about it", picture: windowShape },
        { title: "Third piece", text: "A line about it", picture: circles },
        { title: "Fourth piece", text: "A line about it", picture: hills },
        { title: "Fifth piece", text: "A line about it", picture: windowShape },
      ],
    }),
  },
  // Proof
  {
    id: "logos-names",
    label: "Names you’ve worked with",
    category: "proof",
    description: "The names of clients or partners in a quiet row, set as wordmarks.",
    keywords: ["logos", "clients", "partners", "trusted by", "brands", "as seen in"],
    blueprint: nameRow({ label: "Trusted by teams at", names: names.slice(0, 5) }),
  },
  {
    id: "logos-scrolling",
    label: "Scrolling names",
    category: "proof",
    description: "Client or partner names drifting slowly across the page.",
    keywords: ["logos", "clients", "marquee", "ticker", "partners", "sponsors", "press"],
    blueprint: scrollingNames({ label: "Some of the people we’ve worked with", names }),
  },
  {
    id: "testimonials-wall",
    label: "Wall of quotes",
    category: "proof",
    description: "Six short quotes from customers in uneven columns.",
    keywords: ["testimonials", "reviews", "quotes", "customers", "feedback", "wall of love"],
    blueprint: quoteWall({
      heading: "In their words",
      quotes: [
        { words: "Clear from the first call to the last invoice.", name: "First customer" },
        {
          words: "They did exactly what they said they would, when they said they would.",
          name: "Second customer",
        },
        { words: "Friendly, quick and no jargon.", name: "Third customer" },
        { words: "We’ve already recommended them to two friends.", name: "Fourth customer" },
        {
          words: "Thoughtful about the small things, which is what made the difference.",
          name: "Fifth customer",
        },
        { words: "Would happily work with them again.", name: "Sixth customer" },
      ],
    }),
  },
  {
    id: "testimonial-portrait",
    label: "Big quote with portrait",
    category: "proof",
    description: "One longer quote in big type, beside a portrait of who said it.",
    keywords: ["testimonial", "review", "quote", "case study", "client", "endorsement"],
    blueprint: portraitQuote({
      words:
        "Put your strongest quote here: one that names a real result, in the customer’s own words.",
      name: "Their name",
      role: "Their role, and where",
      picture: circles,
    }),
  },
  {
    id: "stats-band",
    label: "Numbers band",
    category: "proof",
    description: "Four big numbers in a row on your brand colour.",
    keywords: ["stats", "statistics", "numbers", "figures", "results", "impact"],
    blueprint: statBand([
      { value: "98%", label: "of customers come back" },
      { value: "2 days", label: "average reply time" },
      { value: "1,400", label: "projects finished" },
      { value: "12", label: "people on the team" },
    ]),
  },
  {
    id: "stats-counting",
    label: "Counting numbers",
    category: "proof",
    description: "Big numbers that count up as visitors scroll to them.",
    keywords: ["stats", "counter", "count up", "numbers", "animated", "figures"],
    blueprint: countingNumbers({
      heading: "So far",
      numbers: [
        { value: "320", label: "happy customers" },
        { value: "18", label: "years in business" },
        { value: "4.9", label: "average review" },
      ],
    }),
  },
  // Pricing
  {
    id: "pricing-single",
    label: "Single plan",
    category: "pricing",
    description: "One plan in the middle of the page: its price, what’s included and a button.",
    keywords: ["pricing", "price", "plan", "membership", "subscription", "fixed fee"],
    blueprint: singlePlan({
      heading: "One simple price",
      text: "Everything included, with no tiers to compare.",
      name: "Everything",
      price: "£29",
      per: "a month",
      includes: [
        "The first thing included",
        "The second thing",
        "The third thing",
        "Cancel any time",
      ],
      button: { label: "Get started", href: "/contact" },
      note: "Prices include VAT.",
    }),
  },
  {
    id: "pricing-comparison",
    label: "Plan comparison",
    category: "pricing",
    description: "Your plans side by side in a table, feature by feature, with buttons.",
    keywords: ["pricing", "plans", "compare plans", "tiers", "features", "software", "saas"],
    blueprint: planComparison({
      heading: "Compare plans",
      text: "Every plan includes the basics. Pick the one that fits today; you can change later.",
      plans: [
        { name: "Starter", price: "£9", button: { label: "Choose Starter", href: "/contact" } },
        { name: "Team", price: "£29", button: { label: "Choose Team", href: "/contact" } },
        { name: "Business", price: "£79", button: { label: "Choose Business", href: "/contact" } },
      ],
      rows: [
        ["People", "1", "Up to 10", "Unlimited"],
        ["Storage", "5 GB", "100 GB", "1 TB"],
        ["Support", "Email", "Email and chat", "A named contact"],
        ["Monthly or yearly", "Yes", "Yes", "Yes"],
      ],
    }),
  },
  // Questions
  {
    id: "questions-open",
    label: "Questions that open",
    category: "questions",
    description: "Questions that open to show their answer when clicked, one at a time.",
    keywords: ["faq", "accordion", "frequently asked", "help", "answers", "expand"],
    blueprint: openingQuestions({
      heading: "Questions",
      text: "The things people most often ask before getting in touch.",
      items: [
        {
          question: "How do I get started?",
          answer: "Say how someone takes the first step, and what happens next.",
        },
        {
          question: "How much does it cost?",
          answer: "Give a price or a range, and what changes it.",
        },
        {
          question: "How long does it take?",
          answer: "A typical timescale, and what can speed it up.",
        },
        { question: "Can I change my mind?", answer: "Explain how cancelling or changing works." },
      ],
    }),
  },
  {
    id: "questions-two-columns",
    label: "Questions in two columns",
    category: "questions",
    description: "A title and a way to ask on the left, the questions and answers on the right.",
    keywords: ["faq", "frequently asked", "help", "answers", "support"],
    blueprint: questionsBesideTitle({
      heading: "Good to know",
      text: "Can’t find what you’re looking for? Ask us directly.",
      ask: { label: "Ask a question", href: "/contact" },
      items: [
        { question: "Who is it for?", answer: "Describe the people it suits best." },
        {
          question: "What do I need to have ready?",
          answer: "List anything people should prepare.",
        },
        {
          question: "What happens after I get in touch?",
          answer: "Say who replies, how and when.",
        },
      ],
    }),
  },
  // Contact
  {
    id: "contact-map",
    label: "Contact with map",
    category: "contact",
    description: "Your address, phone and email beside a map of where you are.",
    keywords: ["contact", "map", "address", "find us", "directions", "office", "location"],
    blueprint: contactWithMap({
      heading: "Find us",
      text: "Visits by appointment. Call ahead and we’ll put the kettle on.",
      address: "1 High Street\nYour Town\nAB1 2CD",
      phone: "01234 567890",
      email: "hello@example.com",
      place: { name: "Our office", latitude: 51.5074, longitude: -0.1278 },
    }),
  },
  {
    id: "contact-beside-form",
    label: "Contact beside a form",
    category: "contact",
    description: "A few lines on how you reply, beside one of your forms.",
    keywords: ["contact", "form", "enquiry", "message", "quote", "valuation", "booking request"],
    blueprint: contactBesideForm({
      label: "Contact",
      heading: "Tell us what you need",
      text: "A few lines are enough to start. We’ll reply with next steps.",
      promises: ["A reply within one working day", "No obligation", "Your details stay with us"],
      email: "hello@example.com",
    }),
  },
  {
    id: "newsletter-strip",
    label: "Newsletter strip",
    category: "contact",
    description: "A slim band with a newsletter sign-up beside a line about what people get.",
    keywords: ["newsletter", "mailing list", "sign up", "email", "subscribe", "updates"],
    blueprint: newsletterStrip({
      heading: "Hear from us now and then",
      text: "Say what people get and how often. One email a month is a good start.",
      buttonLabel: "Sign up",
    }),
  },
  // Footers
  {
    id: "footer-big-invitation",
    label: "Big invitation footer",
    category: "footer",
    description: "A big invitation to get in touch, over your menu and small print.",
    keywords: ["footer", "contact", "big type", "statement", "dark", "cta"],
    blueprint: footerBigInvitation({ invitation: "Let’s talk →", href: "/contact", smallPrint }),
  },
  {
    id: "footer-sign-up",
    label: "Footer with sign-up",
    category: "footer",
    description: "Your logo and menu beside a newsletter sign-up, then the small print.",
    keywords: ["footer", "newsletter", "mailing list", "subscribe", "menu"],
    blueprint: footerWithSignUp({ signUpTitle: "Get the occasional update", smallPrint }),
  },
  {
    id: "footer-quiet",
    label: "Quiet footer",
    category: "footer",
    description: "Your name, your menu, the small print and a link back to the top, on one line.",
    keywords: ["footer", "minimal", "small print", "back to top", "simple"],
    blueprint: footerQuiet({ smallPrint }),
  },
];
