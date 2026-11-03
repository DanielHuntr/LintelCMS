import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import type { DesignVariable } from "../site-design/design-variables.js";
import type { StarterSite } from "./starter-site.js";
import { at, starterParts, withStyles } from "./starter-parts.js";

/**
 * Verveine: a wedding and events planner in Aix-en-Provence. Ivory and warm ink, Playfair
 * Display in italics for the headings, Manrope for reading, small spaced capitals for the
 * labels and one sage green. Calm and symmetrical, like an invitation: centred titles, wide
 * margins, a gallery visitors drag through and an enquiry form.
 */

export const sageVariable = {
  id: "sage",
  name: "Sage",
  kind: "colour",
  value: "#5d6b4a",
  darkValue: "#b9c79c",
} satisfies DesignVariable;
const sage = `var(--lintel-var-${sageVariable.id})`;
const onSage = "light-dark(#f8f5ee, #171812)";

const paper = "light-dark(#f6f2ea, #14130f)";
const ink = "light-dark(#2b2620, #efe9de)";

const parts = starterParts({
  paper,
  ink,
  quiet: "light-dark(#625a4f, #b2aa9c)",
  rule: "light-dark(#ddd4c4, #35322b)",
  detail: {
    fontSize: "0.6875rem",
    fontWeight: "600",
    lineHeight: "1.6",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
  },
  margin: "clamp(1.25rem, 6vw, 6rem)",
});
const { band, gridBand, words, heading, label, link, action, image, group } = parts;

const serif: StyleDeclarations = {
  fontFamily: "var(--lintel-font-heading)",
  fontWeight: "400",
  fontStyle: "italic",
};
const centred: StyleDeclarations = { textAlign: "center", marginLeft: "auto", marginRight: "auto" };
const email = "bonjour@verveine.example";
const phone = "+33 4 42 55 01 37";
const phoneHref = "tel:+33442550137";

const sectionTitle: StyleDeclarations = {
  ...serif,
  fontSize: "clamp(2rem, 4vw, 3.5rem)",
  lineHeight: "1.05",
};

function primary(text: string, href: string): NodeBlueprint {
  return action(
    "Main button",
    text,
    href,
    { background: sage, text: onSage },
    {
      ...parts.look.detail,
      paddingTop: space(4),
      paddingBottom: space(4),
      paddingLeft: space(6),
      paddingRight: space(6),
    },
  );
}

interface Celebration {
  couple: string;
  place: string;
  illustration: string;
  alt: string;
}

const celebrations: readonly Celebration[] = [
  {
    couple: "Inès & Malo",
    place: "Lourmarin, June",
    illustration: "verveine-table",
    alt: "A place setting from above: plate, napkin, two glasses and a sprig of olive",
  },
  {
    couple: "Hannah & Lewis",
    place: "Ménerbes, September",
    illustration: "verveine-arch",
    alt: "A ceremony arch of olive leaves and white flowers over a short aisle",
  },
  {
    couple: "Sofia & Daniel",
    place: "Aix-en-Provence, May",
    illustration: "verveine-cake",
    alt: "A three-tier white cake with a sprig of olive on top",
  },
  {
    couple: "Léa & Camille",
    place: "Cassis, July",
    illustration: "verveine-lanterns",
    alt: "Paper lanterns glowing from an olive branch at night",
  },
  {
    couple: "Priya & Tom",
    place: "Gordes, August",
    illustration: "verveine-chairs",
    alt: "Two wooden chairs with sage ribbons tied to their backs",
  },
];

function celebrationFrame(celebration: Celebration, level: number | null): NodeBlueprint {
  return group(
    "Celebration",
    [
      image("Picture", celebration.illustration, celebration.alt, {
        base: { aspectRatio: "4 / 5" },
      }),
      level === null
        ? words("Couple", celebration.couple, { base: { ...serif, fontSize: "1.375rem" } })
        : heading("Couple", celebration.couple, level, { base: { ...serif, fontSize: "1.5rem" } }),
      label(celebration.place, "Where and when"),
    ],
    { base: { gap: space(2) } },
  );
}

function pageTop(copy: { label: string; title: string; text: string }): NodeBlueprint {
  return band(
    "Page title",
    [
      withStyles(label(copy.label), { base: { textAlign: "center" } }),
      heading(
        "Page title",
        copy.title,
        1,
        {
          base: {
            ...serif,
            ...centred,
            fontSize: "clamp(2.75rem, 7vw, 6rem)",
            lineHeight: "1",
            maxWidth: "60rem",
          },
        },
        animate("words-rise"),
      ),
      words(
        "Introduction",
        copy.text,
        { base: { ...centred, fontSize: "1.125rem", lineHeight: "1.7", maxWidth: "36rem" } },
        animate("fade-in", { delay: 300 }),
      ),
    ],
    {
      top: 9,
      bottom: 7,
      styles: { base: { display: "flex", flexDirection: "column", gap: space(5) } },
    },
  );
}

/** A quotation from a couple, centred in italics. */
function kindWords(quote: string, who: string): NodeBlueprint {
  return band(
    "Kind words",
    [
      words(
        "Quote",
        quote,
        {
          base: {
            ...serif,
            ...centred,
            fontSize: "clamp(1.5rem, 3.4vw, 2.75rem)",
            lineHeight: "1.25",
            maxWidth: "50rem",
          },
        },
        animate("fade-up"),
      ),
      withStyles(label(who, "Who said it"), { base: { textAlign: "center" } }),
    ],
    {
      top: 9,
      bottom: 9,
      styles: { base: { display: "flex", flexDirection: "column", gap: space(5) } },
    },
  );
}

function navigation(): NodeBlueprint {
  return parts.navigation({
    logo: { ...serif, fontSize: "1.625rem" },
    menu: { ...parts.look.detail },
  });
}

function footer(): NodeBlueprint {
  return band(
    "Footer",
    [
      words("Planner name", "Verveine", {
        base: { ...serif, ...centred, fontSize: "clamp(3.5rem, 10vw, 8rem)", lineHeight: "1" },
      }),
      withStyles(label("Weddings and celebrations in Provence", "What we do"), {
        base: { textAlign: "center", color: "inherit" },
      }),
      group(
        "Footer links",
        [
          link("Email", email, `mailto:${email}`),
          link("Phone", phone, phoneHref),
          link("Instagram", "Instagram", "https://www.instagram.com/"),
          link("Pinterest", "Pinterest", "https://www.pinterest.com/"),
          parts.cookieSettings(),
        ],
        {
          base: {
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: space(6),
            rowGap: space(2),
            marginTop: space(5),
          },
        },
      ),
      group(
        "Small print",
        [
          label("12 rue Cardinale, 13100 Aix-en-Provence", "Address"),
          {
            type: "clock",
            name: "Time in Aix",
            props: { zone: "Europe/Paris", hours: "24", label: "Aix" },
            styles: { base: { ...parts.look.detail, color: parts.look.quiet } },
          },
          label("© 2026 Verveine Événements", "Copyright"),
        ],
        {
          base: {
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: space(6),
            rowGap: space(2),
          },
        },
      ),
    ],
    {
      element: "footer",
      top: 9,
      bottom: 6,
      styles: {
        base: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: space(4),
          borderStyle: "solid",
          borderColor: parts.look.rule,
          borderWidth: "1px 0 0 0",
        },
      },
    },
  );
}

const steps = [
  {
    title: "A long first conversation",
    text: "Over coffee in Aix or a video call: who you are, who’s coming and what kind of day you’d enjoy.",
  },
  {
    title: "The place and the people",
    text: "We show you three or four venues that suit you, then book the caterer, florist, musicians and photographer we trust.",
  },
  {
    title: "How it all looks",
    text: "Tables, flowers, paper and light, drawn up into one plan you can hold, and a timetable for the day.",
  },
  {
    title: "The day itself",
    text: "Two of us from the first delivery to the last taxi, so you never have to look at your phone.",
  },
];

const homePage = {
  slug: "home",
  title: "Home",
  summary:
    "Verveine plans weddings and celebrations across Provence from a small studio in Aix-en-Provence.",
  sections: [
    band(
      "Opening",
      [
        withStyles(label("Weddings and celebrations in Provence"), {
          base: { textAlign: "center" },
        }),
        heading(
          "Main title",
          "Weddings in Provence, planned like a long lunch with friends.",
          1,
          {
            base: {
              ...serif,
              ...centred,
              fontSize: "clamp(2.75rem, 7.2vw, 6.75rem)",
              lineHeight: "1",
              letterSpacing: "-0.01em",
              maxWidth: "64rem",
            },
          },
          animate("words-rise"),
        ),
        group(
          "Buttons",
          [
            primary("Start planning", "/enquire"),
            link("Weddings link", "See our weddings", "/stories", {
              ...parts.look.detail,
              textDecoration: "underline",
              alignSelf: "center",
            }),
          ],
          {
            base: {
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: space(6),
              marginTop: space(3),
            },
          },
          animate("fade-up", { delay: 400 }),
        ),
        image(
          "Farmhouse",
          "verveine-mas",
          "Line drawing of a stone farmhouse in the hills, with cypress trees either side",
          {
            base: {
              maxWidth: "72rem",
              marginLeft: "auto",
              marginRight: "auto",
              marginTop: space(7),
            },
          },
          animate("mask-reveal-up", { delay: 200 }),
        ),
      ],
      {
        top: 9,
        bottom: 8,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(5) } },
      },
    ),
    gridBand(
      "About us",
      [
        withStyles(label("Since 2012"), at(2, 2, 1, { paddingTop: space(3) })),
        words(
          "About us",
          "Claire Aubert and a team of three plan around twenty weddings a year, most of them for couples who live somewhere else. We speak French and English, know every mas and vineyard from Avignon to the sea, and keep things simple: good food, good light, and time to talk to everyone you invited.",
          at(4, 8, 1, {
            ...serif,
            fontStyle: "normal",
            fontSize: "clamp(1.375rem, 2.6vw, 2.125rem)",
            lineHeight: "1.35",
          }),
          animate("fade-up"),
        ),
      ],
      { top: 6, bottom: 8 },
    ),
    band(
      "Recent celebrations",
      [
        group(
          "Gallery title",
          [
            heading("Section title", "Recent celebrations", 2, { base: sectionTitle }),
            label("Drag to look through", "Hint"),
          ],
          {
            base: {
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: space(4),
            },
          },
        ),
        {
          type: "carousel",
          name: "Drag gallery",
          props: {
            label: "Recent celebrations",
            perView: 3,
            autoplay: false,
            autoplaySeconds: 6,
            loop: false,
            showDots: false,
            freeDrag: true,
          },
          effects: [{ effect: "cursor-word", params: { text: "Drag" } }],
          animation: animate("fade-up", { delay: 100 }),
          children: celebrations.map((celebration) => ({
            type: "slide",
            props: { label: celebration.couple },
            children: [celebrationFrame(celebration, null)],
          })),
        },
      ],
      {
        top: 7,
        bottom: 9,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(6) } },
      },
    ),
    band(
      "How we work",
      [
        heading("Section title", "How we work", 2, { base: { ...sectionTitle, ...centred } }),
        group(
          "Steps",
          steps.map((step, index) =>
            group(
              "Step",
              [
                words("Number", String(index + 1).padStart(2, "0"), {
                  base: { ...serif, fontSize: "2.5rem", color: sage },
                }),
                heading("Step title", step.title, 3, {
                  base: { ...serif, fontStyle: "normal", fontSize: "1.375rem" },
                }),
                words("About it", step.text, {
                  base: { color: parts.look.quiet, lineHeight: "1.6" },
                }),
              ],
              {
                base: {
                  gap: space(3),
                  paddingTop: space(5),
                  borderStyle: "solid",
                  borderColor: parts.look.rule,
                  borderWidth: "1px 0 0 0",
                },
              },
            ),
          ),
          {
            base: {
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              columnGap: "clamp(1rem, 2.4vw, 2.5rem)",
              rowGap: space(6),
            },
            tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
            phone: { gridTemplateColumns: "minmax(0, 1fr)" },
          },
          animate("stagger-up", { stagger: 90 }),
        ),
      ],
      {
        top: 8,
        bottom: 8,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(7) } },
      },
    ),
    kindWords(
      "“Claire found us a farmhouse we’d never have found, fed eighty people under the olive trees and somehow made it feel like nobody was working at all.”",
      "Hannah & Lewis, Ménerbes",
    ),
    band(
      "Start planning",
      [
        heading(
          "Call to plan",
          "Tell us about the day you have in mind.",
          2,
          { base: { ...sectionTitle, ...centred, maxWidth: "40rem" } },
          animate("fade-up"),
        ),
        group(
          "Button",
          [
            action(
              "Main button",
              "Start planning",
              "/enquire",
              { background: paper, text: ink },
              {
                ...parts.look.detail,
                paddingTop: space(4),
                paddingBottom: space(4),
                paddingLeft: space(6),
                paddingRight: space(6),
              },
            ),
          ],
          { base: { alignItems: "center" } },
        ),
      ],
      {
        top: 9,
        bottom: 9,
        colours: { background: sage, text: onSage },
        styles: { base: { display: "flex", flexDirection: "column", gap: space(6) } },
      },
    ),
  ],
};

interface Offer {
  name: string;
  price: string;
  text: string;
  includes: string;
}

const offers: readonly Offer[] = [
  {
    name: "Full planning",
    price: "From €9,500",
    text: "Everything from the first venue visit to the last guest home, for couples who’d like to arrive and enjoy it.",
    includes:
      "Venue search and visits\nEvery supplier booked and briefed\nDesign, flowers and stationery\nGuest travel and rooms\nTwo planners on the day",
  },
  {
    name: "Partial planning",
    price: "From €5,200",
    text: "You’ve found the place; we bring the rest together and look after the details you’d rather not.",
    includes:
      "Suppliers we know and trust\nA design plan and timetable\nMonthly meetings or calls\nTwo planners on the day",
  },
  {
    name: "On the day",
    price: "€2,400",
    text: "You’ve planned it all. We take over a month before, so on the day you can be a guest at your own wedding.",
    includes:
      "Two meetings beforehand\nThe timetable, checked with every supplier\nOne planner on the day",
  },
];

const weddingsPage = {
  slug: "weddings",
  title: "Weddings",
  summary: "How Verveine can help: full planning, partial planning or on the day, with prices.",
  sections: [
    pageTop({
      label: "What we do",
      title: "Three ways we can help",
      text: "Prices include our fees only. Venues, food and flowers are paid to each supplier directly, with nothing added.",
    }),
    ...offers.map((offer, index) =>
      gridBand(
        offer.name,
        [
          words(
            "Number",
            String(index + 1).padStart(2, "0"),
            at(1, 1, 1, { ...serif, fontSize: "1.5rem", color: sage }),
          ),
          heading("Offer", offer.name, 2, at(2, 5, 1, sectionTitle)),
          words("Price", offer.price, at(2, 5, 2, { ...parts.look.detail, fontSize: "0.8125rem" })),
          words("About it", offer.text, at(8, 5, 1, { fontSize: "1.125rem", lineHeight: "1.6" })),
          words(
            "What it includes",
            offer.includes,
            at(8, 5, 2, { whiteSpace: "pre-line", lineHeight: "2", color: parts.look.quiet }),
            animate("fade-up"),
          ),
        ],
        {
          top: 7,
          bottom: 7,
          styles: {
            base: { borderStyle: "solid", borderColor: parts.look.rule, borderWidth: "1px 0 0 0" },
          },
        },
      ),
    ),
    gridBand(
      "Other celebrations",
      [
        image(
          "Lanterns",
          "verveine-lanterns",
          "Paper lanterns glowing from an olive branch at night",
          at(1, 5, 1),
          animate("mask-reveal-up"),
        ),
        group(
          "About other celebrations",
          [
            heading("Section title", "Not a wedding?", 2, { base: sectionTitle }),
            words(
              "Other celebrations",
              "We also plan anniversaries, big birthdays, family reunions and company dinners for up to 150 people. Same care, same suppliers, usually a shorter timetable.",
              { base: { fontSize: "1.125rem", lineHeight: "1.6" } },
            ),
            primary("Ask us", "/enquire"),
          ],
          at(7, 5, 1, { alignSelf: "center", gap: space(5) }),
          animate("fade-up"),
        ),
      ],
      { top: 8, bottom: 9 },
    ),
  ],
};

const storiesPage = {
  slug: "stories",
  title: "Stories",
  summary: "Weddings and celebrations Verveine has planned across Provence.",
  sections: [
    pageTop({
      label: "Our weddings",
      title: "Stories",
      text: "A few of the days we’ve been lucky enough to plan, shared with the couples’ blessing.",
    }),
    band(
      "Gallery",
      [
        group(
          "Celebrations",
          celebrations.map((celebration) => celebrationFrame(celebration, 2)),
          {
            base: {
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              columnGap: "clamp(1rem, 2.4vw, 2.5rem)",
              rowGap: space(8),
            },
            tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
            phone: { gridTemplateColumns: "minmax(0, 1fr)", rowGap: space(6) },
          },
          animate("stagger-up", { stagger: 80 }),
        ),
      ],
      { top: 4, bottom: 8 },
    ),
    kindWords(
      "“We planned the whole thing from Toronto and met Claire twice. On the day it was exactly what we’d imagined, only better.”",
      "Priya & Tom, Gordes",
    ),
  ],
};

const enquirePage = {
  slug: "enquire",
  title: "Enquire",
  summary: "Tell Verveine about your wedding or celebration in Provence.",
  sections: [
    pageTop({
      label: "Enquiries",
      title: "Let’s talk",
      text: "Tell us your rough date, how many guests and where you’re dreaming of. We reply within two working days, in French or English.",
    }),
    band(
      "Enquiry form",
      [{ type: "formEmbed", name: "Form", props: { form: "contact", showTitle: false } }],
      {
        top: 2,
        bottom: 7,
        measure: "40rem",
      },
    ),
    gridBand(
      "Other ways",
      [
        group(
          "Email",
          [
            label("Email"),
            link("Email address", email, `mailto:${email}`, { ...serif, fontSize: "1.5rem" }),
          ],
          at(1, 4, 1, { alignItems: "center", textAlign: "center" }),
          animate("fade-up"),
        ),
        group(
          "Phone",
          [
            label("Phone"),
            link("Phone number", phone, phoneHref, { ...serif, fontSize: "1.5rem" }),
          ],
          at(5, 4, 1, { alignItems: "center", textAlign: "center" }),
          animate("fade-up", { delay: 100 }),
        ),
        group(
          "Studio",
          [
            label("The studio"),
            words("Address", "12 rue Cardinale\n13100 Aix-en-Provence", {
              base: { ...serif, fontSize: "1.25rem", whiteSpace: "pre-line" },
            }),
          ],
          at(9, 4, 1, { alignItems: "center", textAlign: "center" }),
          animate("fade-up", { delay: 200 }),
        ),
      ],
      {
        top: 7,
        bottom: 9,
        styles: {
          base: { borderStyle: "solid", borderColor: parts.look.rule, borderWidth: "1px 0 0 0" },
        },
      },
    ),
  ],
};

export const verveineSite: StarterSite = {
  id: "verveine",
  name: "Verveine",
  description:
    "An elegant, airy site for planners: what you offer and what it costs, past celebrations to drag through and an enquiry form.",
  suitedTo: "Wedding planners, event planners and venues",
  coverIllustration: "verveine-cover",
  theme: {
    brandColour: "#5d6b4a",
    accentColour: "#e6dccb",
    fontPairing: "editorial",
    cornerStyle: "soft",
    headingFont: "Playfair Display",
    bodyFont: "Manrope",
  },
  designVariables: [sageVariable],
  siteMotion: {
    smoothScroll: { strength: "strong" },
    cursor: { style: "ring", colour: "text", size: 40 },
    pageTransition: { style: "fade", duration: 600 },
    intro: { style: "curtain", text: "", background: "#f6f2ea", colour: "#5d6b4a" },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  pages: [homePage, weddingsPage, storiesPage, enquirePage],
};
