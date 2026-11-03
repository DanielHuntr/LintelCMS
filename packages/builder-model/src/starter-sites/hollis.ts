import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import type { DesignVariable } from "../site-design/design-variables.js";
import type { StarterSite } from "./starter-site.js";
import { at, type PriceItem, starterParts, withStyles } from "./starter-parts.js";

/**
 * Hollis: a hair and skin salon on Gertrude Street, Fitzroy, in Melbourne. Plaster pink and
 * warm near-black (deep brown in dark mode), Syne's wide letters for the headings with DM Sans
 * for reading, arched pictures like the salon's mirrors, round buttons and one rosewood
 * accent. Prices are set out plainly, and "Book online" is never more than a click away.
 */

export const rosewoodVariable = {
  id: "rosewood",
  name: "Rosewood",
  kind: "colour",
  value: "#9c3d54",
  darkValue: "#f0a0b2",
} satisfies DesignVariable;
const rosewood = `var(--lintel-var-${rosewoodVariable.id})`;
const onRosewood = "light-dark(#fff7f4, #241a19)";

const paper = "light-dark(#f5ebe5, #1b1514)";
const ink = "light-dark(#2a1f1d, #f3e7e1)";

const parts = starterParts({
  paper,
  ink,
  quiet: "light-dark(#6b5651, #bba7a0)",
  rule: "light-dark(#e0cbc2, #3a2e2b)",
  detail: { fontSize: "0.8125rem", fontWeight: "500", lineHeight: "1.5", letterSpacing: "0.02em" },
  buttonCorners: "999px",
});
const { band, gridBand, words, heading, label, link, action, image, group, priceList } = parts;

const wide: StyleDeclarations = {
  fontFamily: "var(--lintel-font-heading)",
  fontWeight: "700",
  letterSpacing: "-0.03em",
};
const arch: StyleDeclarations = { borderRadius: "999px 999px 0 0" };
const bookingHref = "https://hollis.example/book";
const phone = "(03) 9555 0148";
const phoneHref = "tel:+61395550148";
const address = "212 Gertrude Street\nFitzroy VIC 3065";

const sectionTitle: StyleDeclarations = {
  ...wide,
  fontSize: "clamp(2rem, 4.4vw, 3.75rem)",
  lineHeight: "1",
};

function bookButton(text = "Book online", styles: StyleDeclarations = {}): NodeBlueprint {
  return action(
    "Book button",
    text,
    bookingHref,
    { background: rosewood, text: onRosewood },
    styles,
  );
}

interface Stylist {
  name: string;
  role: string;
  bio: string;
  illustration: string;
  alt: string;
}

const team: readonly Stylist[] = [
  {
    name: "Ana Reyes",
    role: "Owner and senior stylist",
    bio: "Opened Hollis in 2014 after ten years in salons in Manila and London. Precision bobs and cuts that grow out well.",
    illustration: "hollis-team-ana",
    alt: "Drawing of a woman with a long black bob and a rose-coloured collar, in an arch",
  },
  {
    name: "Kofi Mensah",
    role: "Colourist",
    bio: "Lived-in colour, blondes and corrective work. Will tell you honestly what your hair can take.",
    illustration: "hollis-team-kofi",
    alt: "Drawing of a man with short dark hair and a cream collar, in an arch",
  },
  {
    name: "Mei Tanaka",
    role: "Skin therapist",
    bio: "Facials, brows and lashes in the quiet room at the back. Trained in Osaka; ten years at Hollis.",
    illustration: "hollis-team-mei",
    alt: "Drawing of a woman with her hair in a high bun, in an arch",
  },
  {
    name: "Jo Whitlam",
    role: "Stylist, curls",
    bio: "Dry cuts for curls and coils, shaped curl by curl. Bring your hair as you usually wear it.",
    illustration: "hollis-team-jo",
    alt: "Drawing of a person with big round curls in rosewood, in an arch",
  },
];

/** One person: their portrait in an arch, then their name and what they do. */
function person(stylist: Stylist, withBio: boolean): NodeBlueprint {
  return group(
    "Person",
    [
      image("Portrait", stylist.illustration, stylist.alt, { base: arch }),
      withBio
        ? heading("Name", stylist.name, 2, {
            base: { ...wide, fontSize: "1.5rem", marginTop: space(2) },
          })
        : words("Name", stylist.name, {
            base: { ...wide, fontSize: "1.25rem", marginTop: space(2) },
          }),
      label(stylist.role, "Role"),
      ...(withBio ? [words("About them", stylist.bio, { base: { lineHeight: "1.6" } })] : []),
    ],
    { base: { gap: space(2) } },
  );
}

function teamRow(withBio: boolean): NodeBlueprint {
  return group(
    "Team",
    team.map((stylist) => person(stylist, withBio)),
    {
      base: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        columnGap: "clamp(1rem, 2vw, 2rem)",
        rowGap: space(7),
      },
      tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
      phone: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", rowGap: space(5) },
    },
    animate("stagger-up", { stagger: 90 }),
  );
}

function pageTop(copy: { label: string; title: string; text: string }): NodeBlueprint {
  return gridBand(
    "Page title",
    [
      withStyles(label(copy.label), at(1, 6, 1)),
      heading(
        "Page title",
        copy.title,
        1,
        at(1, 10, 2, { ...wide, fontSize: "clamp(3rem, 9vw, 8rem)", lineHeight: "0.95" }),
        animate("words-rise"),
      ),
      words(
        "Introduction",
        copy.text,
        at(7, 5, 3, { fontSize: "1.125rem", lineHeight: "1.6" }),
        animate("fade-in", { delay: 300 }),
      ),
    ],
    { top: 8, bottom: 6 },
  );
}

/** A group of treatments: the title on the left, the prices on the right. */
function treatments(name: string, note: string, items: readonly PriceItem[]): NodeBlueprint {
  return gridBand(
    name,
    [
      heading("Group title", name, 2, at(1, 5, 1, sectionTitle)),
      words("Note", note, at(1, 4, 2, { color: parts.look.quiet })),
      priceList("Prices", items, {
        styles: { base: { gridColumn: "6 / span 7", gridRow: "1 / span 2" } },
        nameStyles: { fontWeight: "500" },
        animation: animate("stagger-up", { stagger: 50 }),
      }),
    ],
    {
      top: 6,
      bottom: 6,
      styles: {
        base: { borderStyle: "solid", borderColor: parts.look.rule, borderWidth: "1px 0 0 0" },
      },
    },
  );
}

function navigation(): NodeBlueprint {
  return parts.navigation({
    logo: { ...wide, fontSize: "1.375rem", textTransform: "lowercase" },
    extra: [bookButton("Book", { paddingTop: space(2), paddingBottom: space(2) })],
  });
}

function footer(): NodeBlueprint {
  return gridBand(
    "Footer",
    [
      words(
        "Salon name",
        "hollis",
        at(1, 6, 1, { ...wide, fontSize: "clamp(4rem, 12vw, 10rem)", lineHeight: "0.85" }),
      ),
      words("Address", address, at(7, 3, 1, { whiteSpace: "pre-line", lineHeight: "1.6" })),
      group(
        "Footer links",
        [
          link("Phone", phone, phoneHref),
          link("Instagram", "Instagram", "https://www.instagram.com/"),
          link("Book online", "Book online", bookingHref),
          parts.cookieSettings(),
        ],
        at(10, 3, 1, { gap: space(2) }),
      ),
      label("© 2026 Hollis Hair & Skin Pty Ltd", "Small print", at(1, 6, 2)),
      {
        type: "clock",
        name: "Time in Melbourne",
        props: { zone: "Australia/Sydney", hours: "12", label: "Fitzroy" },
        styles: at(7, 3, 2, { ...parts.look.detail, color: parts.look.quiet }),
      },
    ],
    { element: "footer", top: 8, bottom: 6 },
  );
}

const homePage = {
  slug: "home",
  title: "Home",
  summary:
    "Hollis is a hair and skin salon in Fitzroy, Melbourne: cuts, colour, curls, facials and brows.",
  sections: [
    gridBand(
      "Opening",
      [
        withStyles(label("Hair and skin, Fitzroy"), at(1, 6, 1)),
        heading(
          "Main title",
          "Cuts, colour and skin, done slowly on Gertrude Street.",
          1,
          {
            ...at(1, 8, 2, {
              ...wide,
              fontSize: "clamp(2.75rem, 6.8vw, 6.5rem)",
              lineHeight: "0.95",
              letterSpacing: "-0.045em",
            }),
          },
          animate("words-rise"),
        ),
        image(
          "Mirror",
          "hollis-mirror",
          "An arched mirror with a rosewood plant reflected in it",
          at(9, 4, "1 / span 3", arch),
          animate("mask-reveal-up", { delay: 200 }),
        ),
        group(
          "Welcome",
          [
            words(
              "Welcome",
              "Four chairs, one quiet treatment room and no rush. Every first visit starts with a proper chat about your hair, what you do with it in the morning and what you’d like to change.",
              { base: { fontSize: "1.125rem", lineHeight: "1.6", maxWidth: "32rem" } },
            ),
            group(
              "Buttons",
              [
                bookButton(),
                link("Prices link", "Services and prices", "/services", {
                  textDecoration: "underline",
                  alignSelf: "center",
                }),
              ],
              { base: { flexDirection: "row", flexWrap: "wrap", gap: space(5) } },
            ),
          ],
          at(1, 6, 3, { gap: space(6), alignSelf: "end" }),
          animate("fade-up", { delay: 350 }),
        ),
      ],
      { top: 6, bottom: 8 },
    ),
    band(
      "What we do",
      [
        {
          type: "marquee",
          name: "Services ticker",
          props: {
            items: ["Cuts", "Colour", "Balayage", "Curls", "Facials", "Brows", "Lashes"],
            speed: "slow",
            direction: "left",
          },
          styles: { base: { ...wide, fontSize: "clamp(1.75rem, 4vw, 3rem)" } },
        },
      ],
      { top: 5, bottom: 5, colours: { background: ink, text: paper } },
    ),
    gridBand(
      "Popular",
      [
        image(
          "Scissors",
          "hollis-scissors",
          "Rosewood scissors open across a black comb",
          { base: { gridColumn: "1 / span 5", gridRow: "1 / span 3", borderRadius: "1.5rem" } },
          animate("mask-reveal-up"),
        ),
        heading("Section title", "Most booked", 2, at(7, 6, 1, sectionTitle)),
        priceList(
          "Prices",
          [
            { name: "Cut and finish", detail: "Any length, with a wash", price: "from $95" },
            {
              name: "Lived-in colour",
              detail: "Balayage or babylights, toner",
              price: "from $260",
            },
            { name: "Curl cut", detail: "Dry cut, curl by curl", price: "$140" },
            { name: "Brow shape and tint", price: "$55" },
          ],
          {
            styles: at(7, 6, 2),
            nameStyles: { fontWeight: "500" },
            animation: animate("stagger-up", { stagger: 60 }),
          },
        ),
        withStyles(
          link("Prices link", "Every service and price", "/services", {
            textDecoration: "underline",
          }),
          at(7, 6, 3),
        ),
      ],
      { top: 8, bottom: 8 },
    ),
    band(
      "The team",
      [
        group(
          "Team title",
          [
            heading("Section title", "Who’ll look after you", 2, { base: sectionTitle }),
            link("Team link", "Meet the team", "/team", { textDecoration: "underline" }),
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
        teamRow(false),
      ],
      {
        top: 6,
        bottom: 9,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(7) } },
      },
    ),
    band(
      "First visit",
      [
        heading(
          "Call to book",
          "New to Hollis? Your first visit comes with a free fifteen-minute consultation.",
          2,
          {
            base: {
              ...wide,
              fontSize: "clamp(1.75rem, 3.6vw, 3rem)",
              lineHeight: "1.05",
              maxWidth: "48rem",
            },
          },
          animate("fade-up"),
        ),
        action("Book button", "Book your first visit", bookingHref, {
          background: paper,
          text: ink,
        }),
      ],
      {
        top: 9,
        bottom: 9,
        colours: { background: rosewood, text: onRosewood },
        styles: { base: { display: "flex", flexDirection: "column", gap: space(6) } },
      },
    ),
  ],
};

const servicesPage = {
  slug: "services",
  title: "Services",
  summary: "Hair, colour and skin treatments at Hollis, with prices.",
  sections: [
    pageTop({
      label: "Services and prices",
      title: "What we do",
      text: "Prices start from the time a short cut takes; longer or thicker hair takes longer. We’ll always tell you the price before we start.",
    }),
    treatments("Cuts", "Every cut includes a wash and a finish.", [
      { name: "Cut and finish", detail: "Any length", price: "from $95" },
      { name: "Short cut", detail: "Clippers and scissors, under 30 minutes", price: "$65" },
      { name: "Curl cut", detail: "Dry cut, curl by curl, with a curl routine", price: "$140" },
      { name: "Fringe tidy", detail: "Between cuts, ten minutes", price: "$20" },
    ]),
    treatments("Colour", "Patch test 48 hours before your first colour.", [
      { name: "Roots", detail: "Up to 2cm of regrowth", price: "from $120" },
      { name: "Lived-in colour", detail: "Balayage or babylights, toner", price: "from $260" },
      { name: "Gloss", detail: "Shine and tone, 30 minutes", price: "$75" },
      { name: "Colour correction", detail: "By consultation", price: "Ask us" },
    ]),
    treatments("Skin, brows and lashes", "In the treatment room with Mei.", [
      { name: "Hollis facial", detail: "Cleanse, massage, mask, 60 minutes", price: "$150" },
      { name: "Brow shape and tint", price: "$55" },
      { name: "Lash lift and tint", price: "$95" },
    ]),
    gridBand(
      "Products",
      [
        image(
          "Shelf",
          "hollis-shelf",
          "A shelf of hair products: a tall rosewood bottle, a round jar and a dark pump bottle",
          { base: { gridColumn: "1 / span 6", gridRow: "1", borderRadius: "1.5rem" } },
          animate("mask-reveal-up"),
        ),
        group(
          "About products",
          [
            heading("Section title", "What we use", 2, { base: sectionTitle }),
            words(
              "Products",
              "Australian-made, refillable and gentle on colour. Bring your empty bottles back and we’ll fill them at the counter for less.",
              { base: { fontSize: "1.125rem", lineHeight: "1.6" } },
            ),
          ],
          at(8, 5, 1, { alignSelf: "center", gap: space(4) }),
          animate("fade-up"),
        ),
      ],
      { top: 7, bottom: 9 },
    ),
  ],
};

const teamPage = {
  slug: "team",
  title: "Team",
  summary: "The four people who look after you at Hollis.",
  sections: [
    pageTop({
      label: "The team",
      title: "Four chairs, four of us",
      text: "Book with whoever you like; if you’re not sure, tell us what you’re after and we’ll suggest someone.",
    }),
    band("Team", [teamRow(true)], { top: 4, bottom: 9 }),
  ],
};

const bookPage = {
  slug: "book",
  title: "Book",
  summary: "Book an appointment at Hollis, see our hours and find the salon in Fitzroy.",
  sections: [
    pageTop({
      label: "Appointments",
      title: "Book a visit",
      text: "Book online any time, or call the salon during opening hours. Please give us a day’s notice if you can’t make it.",
    }),
    gridBand(
      "How to book",
      [
        group(
          "Online",
          [
            heading("Online title", "Online", 2, { base: { ...wide, fontSize: "1.5rem" } }),
            words("Online", "See every free appointment and choose who you’d like to see.", {
              base: { color: parts.look.quiet },
            }),
            bookButton("Book online", { fontSize: "1.125rem" }),
          ],
          at(1, 4, 1, { gap: space(4) }),
          animate("fade-up"),
        ),
        group(
          "By phone",
          [
            heading("Phone title", "By phone", 2, { base: { ...wide, fontSize: "1.5rem" } }),
            words("Phone", "We answer between appointments, so leave a message if we miss you.", {
              base: { color: parts.look.quiet },
            }),
            link("Phone number", phone, phoneHref, { ...wide, fontSize: "1.75rem" }),
          ],
          at(5, 4, 1, { gap: space(4) }),
          animate("fade-up", { delay: 100 }),
        ),
        group(
          "Finding us",
          [
            heading("Address title", "The salon", 2, { base: { ...wide, fontSize: "1.5rem" } }),
            words("Address", address, { base: { whiteSpace: "pre-line", lineHeight: "1.6" } }),
            words(
              "Getting here",
              "Tram 86 stops outside. Step-free, with a lift to the treatment room.",
              {
                base: { color: parts.look.quiet },
              },
            ),
          ],
          at(9, 4, 1, { gap: space(4) }),
          animate("fade-up", { delay: 200 }),
        ),
      ],
      { top: 3, bottom: 7 },
    ),
    gridBand(
      "Opening hours",
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
                { cells: ["Tuesday and Wednesday", "9am to 6pm"] },
                { cells: ["Thursday and Friday", "9am to 8pm"] },
                { cells: ["Saturday", "8am to 4pm"] },
                { cells: ["Sunday", "Closed"] },
              ],
              firstColumnIsHeading: true,
              striped: false,
            },
          },
          at(6, 7, 1, { width: "100%" }),
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

export const hollisSite: StarterSite = {
  id: "hollis",
  name: "Hollis",
  description:
    "A soft, confident salon site with services and prices, the team and a booking button on every page.",
  suitedTo: "Hair salons, barbers, beauty and nail studios",
  coverIllustration: "hollis-cover",
  theme: {
    brandColour: "#9c3d54",
    accentColour: "#e2c3b6",
    fontPairing: "geometric",
    cornerStyle: "round",
    headingFont: "Syne",
    bodyFont: "DM Sans",
  },
  designVariables: [rosewoodVariable],
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "ring", colour: "text", size: 32 },
    pageTransition: { style: "slide", duration: 500 },
    intro: { style: "none" },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  pages: [homePage, servicesPage, teamPage, bookPage],
};
