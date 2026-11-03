import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import type { DesignVariable } from "../site-design/design-variables.js";
import type { StarterSite } from "./starter-site.js";
import { at, starterParts, withStyles } from "./starter-parts.js";

/**
 * Lind: an independent homewares and stationery shop on Mejlgade in Aarhus, Denmark.
 * Off-white and black with one signal yellow, Unbounded's round, wide letters for headings
 * and Inter for everything else, square corners and pictures stepped across the grid.
 *
 * With the Shop plugin on, the home and Shop pages show the shop's products; without it
 * those sections are left out and the lookbook (the season's things with their prices and
 * a line about visiting or emailing) does the job on its own.
 */

export const signalVariable = {
  id: "signal",
  name: "Signal yellow",
  kind: "colour",
  value: "#f2c230",
  darkValue: "#f2c230",
} satisfies DesignVariable;
const signal = `var(--lintel-var-${signalVariable.id})`;
/** Text on the yellow: always black, 11:1. */
const onSignal = "#151515";

const paper = "light-dark(#f4f3ee, #121212)";
const ink = "light-dark(#151515, #f1f0ea)";

const parts = starterParts({
  paper,
  ink,
  quiet: "light-dark(#55544f, #b0afa8)",
  rule: "light-dark(#d6d4cc, #2f2f2c)",
  detail: {
    fontSize: "0.75rem",
    fontWeight: "700",
    lineHeight: "1.5",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
});
const { band, gridBand, words, heading, label, link, action, image, group } = parts;

const round: StyleDeclarations = {
  fontFamily: "var(--lintel-font-heading)",
  fontWeight: "700",
  letterSpacing: "-0.03em",
};
const email = "hej@lind.example";
const address = "Mejlgade 41\n8000 Aarhus C, Denmark";

const sectionTitle: StyleDeclarations = {
  ...round,
  fontSize: "clamp(1.75rem, 3.6vw, 3rem)",
  lineHeight: "1",
};

/** A small yellow tag, like the shop's price labels. */
function tag(text: string, name = "Tag"): NodeBlueprint {
  return words(name, text, {
    base: {
      alignSelf: "start",
      justifySelf: "start",
      ...parts.look.detail,
      backgroundColor: signal,
      color: onSignal,
      paddingTop: space(1),
      paddingBottom: space(1),
      paddingLeft: space(2),
      paddingRight: space(2),
      width: "fit-content",
    },
  });
}

interface Thing {
  name: string;
  maker: string;
  price: string;
  illustration: string;
  alt: string;
}

const things: readonly Thing[] = [
  {
    name: "Fjord mug",
    maker: "Stoneware by Kamma Holst, Ebeltoft",
    price: "245 kr",
    illustration: "lind-mug",
    alt: "A black stoneware mug with a yellow glaze inside, steam rising",
  },
  {
    name: "Tall vase, chalk",
    maker: "Thrown by Studio Vig, Aarhus",
    price: "620 kr",
    illustration: "lind-vase",
    alt: "A tall white vase holding one bare branch, on a yellow background",
  },
  {
    name: "Lamp no. 3",
    maker: "Designed by Ove Brask",
    price: "1,450 kr",
    illustration: "lind-lamp",
    alt: "A table lamp with a yellow dome shade, switched on in the dark",
  },
  {
    name: "Dot-grid notebooks",
    maker: "Bound by hand in Copenhagen",
    price: "95 kr each",
    illustration: "lind-notebooks",
    alt: "A stack of three notebooks, the top one yellow with a ribbon marker",
  },
  {
    name: "Lambswool throw",
    maker: "Woven in Herning",
    price: "890 kr",
    illustration: "lind-throw",
    alt: "A folded white wool throw with a yellow stripe and a fringed edge",
  },
  {
    name: "Beeswax candle",
    maker: "Poured on Samsø",
    price: "60 kr",
    illustration: "lind-candle",
    alt: "A tall white candle burning in a black holder, on a yellow background",
  },
];

/** One thing: its picture, then name and price on a line, then who made it. */
function thing(item: Thing, level: number | null): NodeBlueprint {
  return group(
    "Thing",
    [
      image("Picture", item.illustration, item.alt, { base: { aspectRatio: "4 / 5" } }),
      group(
        "Name and price",
        [
          level === null
            ? words("Name", item.name, { base: { fontWeight: "600" } })
            : heading("Name", item.name, level, { base: { fontWeight: "600", fontSize: "1rem" } }),
          words("Price", item.price, { base: { whiteSpace: "nowrap" } }),
        ],
        {
          base: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: space(3),
            marginTop: space(2),
          },
        },
      ),
      words("Maker", item.maker, { base: { color: parts.look.quiet, fontSize: "0.875rem" } }),
    ],
    { base: { gap: space(1) } },
  );
}

/** The shop's products, from Shop; left out when the Shop plugin is off. */
function products(name: string, limit: number): NodeBlueprint {
  return {
    type: "productGrid",
    name,
    props: {
      collection: "",
      sort: "featured",
      limit,
      paginate: limit > 8,
      showSort: limit > 8,
      columns: 4,
      tabletColumns: 2,
      phoneColumns: 2,
      emptyText: "New things arrive every Thursday.",
    },
  };
}

function pageTop(copy: { label: string; title: string; text: string }): NodeBlueprint {
  return gridBand(
    "Page title",
    [
      withStyles(tag(copy.label, "Label"), at(1, 6, 1)),
      heading(
        "Page title",
        copy.title,
        1,
        at(1, 10, 2, { ...round, fontSize: "clamp(2.75rem, 8vw, 7.5rem)", lineHeight: "0.95" }),
        animate("letters-fade"),
      ),
      words(
        "Introduction",
        copy.text,
        at(7, 5, 3, { fontSize: "1.125rem", lineHeight: "1.55" }),
        animate("fade-in", { delay: 300 }),
      ),
    ],
    { top: 8, bottom: 6 },
  );
}

function navigation(): NodeBlueprint {
  return parts.navigation({
    logo: { ...round, fontSize: "1.375rem", letterSpacing: "0.04em", textTransform: "uppercase" },
    menu: { fontWeight: "500" },
    styles: { borderStyle: "solid", borderColor: ink, borderWidth: "0 0 2px 0" },
  });
}

function footer(): NodeBlueprint {
  return gridBand(
    "Footer",
    [
      words(
        "Shop name",
        "LIND",
        at(1, 6, 1, {
          ...round,
          fontSize: "clamp(4rem, 14vw, 12rem)",
          lineHeight: "0.85",
          letterSpacing: "0.02em",
        }),
      ),
      words("Address", address, at(7, 3, 1, { whiteSpace: "pre-line", lineHeight: "1.6" })),
      group(
        "Footer links",
        [
          link("Email", email, `mailto:${email}`),
          link("Instagram", "Instagram", "https://www.instagram.com/"),
          link("Delivery", "Delivery and returns", "/visit"),
          parts.cookieSettings(),
        ],
        at(10, 3, 1, { gap: space(2) }),
      ),
      label("© 2026 Lind ApS · CVR 12 34 56 78", "Small print", at(1, 6, 2)),
      {
        type: "clock",
        name: "Time in Aarhus",
        props: { zone: "Europe/Berlin", hours: "24", label: "Aarhus" },
        styles: at(7, 3, 2, { ...parts.look.detail, color: parts.look.quiet }),
      },
    ],
    {
      element: "footer",
      top: 8,
      bottom: 6,
      styles: { base: { borderStyle: "solid", borderColor: ink, borderWidth: "2px 0 0 0" } },
    },
  );
}

const homePage = {
  slug: "home",
  title: "Home",
  summary:
    "Lind is a small shop for useful, lovely things for the home, on Mejlgade in Aarhus: ceramics, lamps, paper and wool.",
  sections: [
    gridBand(
      "Opening",
      [
        heading(
          "Main title",
          "Useful, lovely things for the home.",
          1,
          at(1, 9, 1, {
            ...round,
            fontSize: "clamp(2.75rem, 7.6vw, 7.75rem)",
            lineHeight: "0.92",
            letterSpacing: "-0.045em",
          }),
          animate("letters-fade"),
        ),
        withStyles(tag("Mejlgade 41, Aarhus", "Where"), {
          ...at(10, 3, 1, { justifySelf: "end", alignSelf: "start" }),
          phone: { justifySelf: "start" },
        }),
        image(
          "Vase",
          "lind-vase",
          "A tall white vase holding one bare branch, on a yellow background",
          at(1, 4, 2),
          animate("mask-reveal-up"),
        ),
        image(
          "Mug",
          "lind-mug",
          "A black stoneware mug with a yellow glaze inside, steam rising",
          { ...at(5, 4, 2, { marginTop: space(9) }), phone: { display: "none" } },
          animate("mask-reveal-up", { delay: 120 }),
        ),
        group(
          "Welcome",
          [
            words(
              "Welcome",
              "Ceramics, lamps, paper and wool from forty small Nordic makers, picked by Freja and Anders Lind and sold from a corner shop in the Latin Quarter. Everything is in the shop; most of it ships in two days.",
              { base: { fontSize: "1.125rem", lineHeight: "1.55" } },
            ),
            group(
              "Buttons",
              [
                action("Shop button", "Shop now", "/shop", { background: ink, text: paper }),
                link("Visit link", "Visit the shop", "/visit", {
                  textDecoration: "underline",
                  alignSelf: "center",
                }),
              ],
              { base: { flexDirection: "row", flexWrap: "wrap", gap: space(5) } },
            ),
          ],
          at(9, 4, 2, { gap: space(6), alignSelf: "end" }),
          animate("fade-up", { delay: 300 }),
        ),
      ],
      { top: 6, bottom: 8 },
    ),
    band(
      "Good to know",
      [
        {
          type: "marquee",
          name: "Good to know",
          props: {
            items: [
              "Free delivery in Denmark over 500 kr",
              "Gift wrapping on everything",
              "Open Tuesday to Saturday",
              "New things every Thursday",
            ],
            speed: "slow",
            direction: "left",
          },
          styles: { base: { ...round, fontSize: "clamp(1.125rem, 2.2vw, 1.75rem)" } },
        },
      ],
      { top: 4, bottom: 4, colours: { background: signal, text: onSignal } },
    ),
    band(
      "New in",
      [
        heading("Section title", "New in", 2, { base: sectionTitle }),
        products("New products", 4),
        link("Shop link", "See everything", "/shop", { textDecoration: "underline" }),
      ],
      {
        top: 8,
        bottom: 4,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(6) } },
      },
    ),
    band(
      "Lookbook",
      [
        group(
          "Lookbook title",
          [
            heading("Section title", "The autumn lookbook", 2, { base: sectionTitle }),
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
            label: "The autumn lookbook",
            perView: 4,
            autoplay: false,
            autoplaySeconds: 6,
            loop: false,
            showDots: false,
            freeDrag: true,
          },
          effects: [{ effect: "cursor-word", params: { text: "Drag" } }],
          animation: animate("fade-up", { delay: 100 }),
          children: things.map((item) => ({
            type: "slide",
            props: { label: item.name },
            children: [thing(item, null)],
          })),
        },
      ],
      {
        top: 8,
        bottom: 8,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(6) } },
      },
    ),
    gridBand(
      "The shop",
      [
        image(
          "Shop front",
          "lind-shopfront",
          "Drawing of a corner shop with LIND in yellow over a window full of vases and a grey door",
          at(1, 7, 1),
          animate("mask-reveal-up"),
        ),
        group(
          "About the shop",
          [
            heading("Section title", "A corner shop on Mejlgade", 2, { base: sectionTitle }),
            words(
              "About the shop",
              "We opened in 2017 in an old bicycle repair shop. Come in for a look, a coffee and a chat about who made what; we know every one of them.",
              { base: { fontSize: "1.125rem", lineHeight: "1.55" } },
            ),
            link("Visit link", "Opening hours and directions", "/visit", {
              textDecoration: "underline",
            }),
          ],
          at(9, 4, 1, { alignSelf: "center", gap: space(5) }),
          animate("fade-up"),
        ),
      ],
      { top: 8, bottom: 9 },
    ),
  ],
};

const shopPage = {
  slug: "shop",
  title: "Shop",
  summary: "Everything in the Lind shop: ceramics, lamps, paper and wool from Nordic makers.",
  sections: [
    pageTop({
      label: "The shop",
      title: "Everything",
      text: "Ordered by 2pm, posted the same day. Can’t find something you saw in the shop? Email us and we’ll put it aside.",
    }),
    band("Products", [products("Products", 24)], { top: 2, bottom: 6 }),
    band(
      "In the shop this season",
      [
        heading("Section title", "In the shop this season", 2, { base: sectionTitle }),
        words(
          "How to buy",
          `All of these are on the shelves on Mejlgade. To have one posted, email ${email} with what you’d like and your address; we’ll send a payment link.`,
          { base: { maxWidth: "40rem", color: parts.look.quiet } },
        ),
        group(
          "Things",
          things.map((item) => thing(item, 3)),
          {
            base: {
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              columnGap: "clamp(0.75rem, 2vw, 2rem)",
              rowGap: space(7),
            },
            phone: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", rowGap: space(5) },
          },
          animate("stagger-up", { stagger: 70 }),
        ),
      ],
      {
        top: 6,
        bottom: 9,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(5) } },
      },
    ),
  ],
};

const visitPage = {
  slug: "visit",
  title: "Visit",
  summary: "Find the Lind shop in Aarhus, see when it's open and read about delivery and returns.",
  sections: [
    pageTop({
      label: "Visit",
      title: "Come in for a look",
      text: "Five minutes’ walk from Aarhus Cathedral, on the corner of Mejlgade and Graven. Step-free, with room for a pushchair.",
    }),
    gridBand(
      "Hours and address",
      [
        heading("Hours title", "Opening hours", 2, at(1, 5, 1, sectionTitle)),
        withStyles(
          {
            type: "table",
            name: "Opening hours",
            props: {
              caption: "",
              headings: ["Day", "Open"],
              rows: [
                { cells: ["Monday", "Closed"] },
                { cells: ["Tuesday to Friday", "10 to 17.30"] },
                { cells: ["Saturday", "10 to 15"] },
                { cells: ["Sunday", "Closed, except in December"] },
              ],
              firstColumnIsHeading: true,
              striped: false,
            },
          },
          at(1, 5, 2, { width: "100%" }),
        ),
        heading("Address title", "Where we are", 2, at(7, 6, 1, sectionTitle)),
        group(
          "Address",
          [
            words("Address", address, { base: { whiteSpace: "pre-line", fontSize: "1.25rem" } }),
            link("Email", email, `mailto:${email}`, { textDecoration: "underline" }),
          ],
          at(7, 6, 2, { gap: space(4) }),
          animate("fade-up"),
        ),
      ],
      { top: 4, bottom: 8 },
    ),
    gridBand(
      "Delivery and returns",
      [
        heading("Delivery title", "Delivery and returns", 2, at(1, 5, 1, sectionTitle)),
        words(
          "Delivery",
          "Delivery in Denmark is 49 kr, and free over 500 kr. We post to the rest of the EU from 120 kr. Changed your mind? Send it back unused within 30 days for a full refund.",
          at(7, 6, 1, { fontSize: "1.125rem", lineHeight: "1.55" }),
          animate("fade-up"),
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

export const lindSite: StarterSite = {
  id: "lind",
  name: "Lind",
  description:
    "A bold, friendly shop site: the shop's products when Shop is on, a lookbook to drag through and everything about visiting.",
  suitedTo: "Independent shops, makers and concept stores",
  coverIllustration: "lind-cover",
  theme: {
    brandColour: "#151515",
    accentColour: "#f2c230",
    fontPairing: "geometric",
    cornerStyle: "square",
    headingFont: "Unbounded",
    bodyFont: "Inter",
  },
  designVariables: [signalVariable],
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "dot", colour: "text", size: 14 },
    pageTransition: { style: "wipe", duration: 500 },
    intro: { style: "counter", text: "Lind", background: "#151515", colour: "#f2c230" },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  pages: [homePage, shopPage, visitPage],
};
