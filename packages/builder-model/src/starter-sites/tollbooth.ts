import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import type { DesignVariable } from "../site-design/design-variables.js";
import type { StarterSite } from "./starter-site.js";
import { at, type PriceItem, starterParts, withStyles } from "./starter-parts.js";

/**
 * Tollbooth: a small restaurant cooking over wood in an old toll house in Leith, Edinburgh.
 * Cream paper and brown-black ink (the other way round in dark mode), Fraunces for the
 * headings and the menu, Work Sans for everything else, and one claret accent. The menu
 * reads like the card on the table: courses down the page, prices on the right.
 */

export const claretVariable = {
  id: "claret",
  name: "Claret",
  kind: "colour",
  value: "#8a2c2c",
  darkValue: "#e8968c",
} satisfies DesignVariable;
const claret = `var(--lintel-var-${claretVariable.id})`;
const onClaret = "light-dark(#fbf6ee, #1d1814)";

const paper = "light-dark(#f4efe6, #16130f)";
const ink = "light-dark(#1d1a16, #efe8dc)";

const parts = starterParts({
  paper,
  ink,
  quiet: "light-dark(#5f574d, #b3aa9c)",
  rule: "light-dark(#d9cfbf, #3a332b)",
  detail: {
    fontSize: "0.75rem",
    fontWeight: "500",
    lineHeight: "1.5",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
});
const { band, gridBand, words, heading, label, link, action, image, group, priceList } = parts;

const serif: StyleDeclarations = { fontFamily: "var(--lintel-font-heading)" };
const phone = "0131 555 0192";
const phoneHref = "tel:+441315550192";
const email = "tables@tollbooth.example";
const address = "2 Leith Walk\nEdinburgh EH6 8RF";

const hours = [
  { cells: ["Monday and Tuesday", "Closed"] },
  { cells: ["Wednesday and Thursday", "5pm to 10pm"] },
  { cells: ["Friday and Saturday", "12 noon to 3pm, 5pm to 11pm"] },
  { cells: ["Sunday", "12 noon to 6pm"] },
];

function hoursTable(): NodeBlueprint {
  return {
    type: "table",
    name: "Opening hours",
    props: {
      caption: "",
      headings: ["Day", "Open"],
      rows: hours,
      firstColumnIsHeading: true,
      striped: false,
    },
    styles: { base: { width: "100%" } },
  };
}

/** The big title at the top of an inner page, with a line under it. */
function pageTop(copy: { label: string; title: string; text: string }): NodeBlueprint {
  return gridBand(
    "Page title",
    [
      withStyles(label(copy.label), at(1, 12, 1, { textAlign: "center" })),
      heading(
        "Page title",
        copy.title,
        1,
        at(2, 10, 2, {
          ...serif,
          fontSize: "clamp(2.75rem, 7vw, 6.5rem)",
          fontWeight: "400",
          lineHeight: "1",
          letterSpacing: "-0.02em",
          textAlign: "center",
        }),
        animate("words-rise"),
      ),
      words(
        "Introduction",
        copy.text,
        at(4, 6, 3, { fontSize: "1.125rem", lineHeight: "1.6", textAlign: "center" }),
        animate("fade-in", { delay: 300 }),
      ),
    ],
    { top: 9, bottom: 6 },
  );
}

/** One course of the menu: its name on the left, the dishes and prices on the right. */
function course(name: string, note: string, dishes: readonly PriceItem[]): NodeBlueprint {
  return gridBand(
    name,
    [
      group(
        "Course title",
        [
          heading("Course", name, 2, {
            base: { ...serif, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: "400" },
          }),
          words("Note", note, { base: { color: parts.look.quiet, fontSize: "0.9375rem" } }),
        ],
        at(1, 4, 1, { gap: space(2), paddingTop: space(3) }),
      ),
      priceList("Dishes", dishes, {
        styles: at(6, 7, 1),
        nameStyles: { ...serif, fontSize: "1.25rem" },
        animation: animate("stagger-up", { stagger: 50 }),
      }),
    ],
    { top: 4, bottom: 4 },
  );
}

function navigation(): NodeBlueprint {
  return parts.navigation({
    logo: { ...serif, fontSize: "1.5rem", fontWeight: "400", letterSpacing: "-0.01em" },
    extra: [
      action(
        "Book button",
        "Book a table",
        "/visit",
        { background: claret, text: onClaret },
        { fontSize: "0.9375rem", paddingTop: space(2), paddingBottom: space(2) },
      ),
    ],
  });
}

function footer(): NodeBlueprint {
  return gridBand(
    "Footer",
    [
      words(
        "Restaurant name",
        "Tollbooth",
        at(1, 6, 1, {
          ...serif,
          fontSize: "clamp(3rem, 8vw, 7rem)",
          lineHeight: "0.9",
          letterSpacing: "-0.03em",
        }),
      ),
      words("Address", address, at(7, 3, 1, { whiteSpace: "pre-line", lineHeight: "1.6" })),
      words(
        "Hours in short",
        "Wednesday to Sunday\nKitchen closes an hour before we do",
        at(10, 3, 1, { whiteSpace: "pre-line", lineHeight: "1.6" }),
      ),
      label("© 2026 Tollbooth Restaurant Ltd", "Small print", at(1, 6, 2)),
      group(
        "Footer links",
        [
          link("Phone", phone, phoneHref),
          link("Instagram", "Instagram", "https://www.instagram.com/"),
          parts.cookieSettings(),
        ],
        at(7, 3, 2, { gap: space(2) }),
      ),
      {
        type: "clock",
        name: "Time in Edinburgh",
        props: { zone: "Europe/London", hours: "24", label: "Edinburgh" },
        styles: at(10, 3, 2, { ...parts.look.detail, color: parts.look.quiet }),
      },
    ],
    {
      element: "footer",
      top: 7,
      bottom: 6,
      styles: {
        base: { borderStyle: "solid", borderColor: parts.look.rule, borderWidth: "1px 0 0 0" },
      },
    },
  );
}

const homePage = {
  slug: "home",
  title: "Home",
  summary:
    "Tollbooth cooks over wood in Leith's old toll house: Scottish fish, vegetables from the Lothians and natural wine.",
  sections: [
    gridBand(
      "Opening",
      [
        withStyles(label("Restaurant and wine bar, Leith"), at(1, 6, 1)),
        withStyles(label("Open Wednesday to Sunday"), {
          ...at(7, 6, 1, { textAlign: "right" }),
          phone: { textAlign: "left" },
        }),
        heading(
          "Main title",
          "Wood smoke, Scottish fish and one long table in the old toll house.",
          1,
          {
            ...at(1, 11, 2, {
              ...serif,
              fontSize: "clamp(2.5rem, 6.6vw, 6.25rem)",
              fontWeight: "400",
              lineHeight: "1",
              letterSpacing: "-0.025em",
              marginTop: space(5),
            }),
            phone: { marginTop: space(3) },
          },
          animate("words-rise"),
        ),
        group(
          "Welcome",
          [
            words(
              "Welcome",
              "We cook what the boats and the Lothian growers bring in, over oak and birch, in a six-sided stone house that once took the toll on Leith Walk. Twenty-eight seats, a short list of natural wine and a pudding worth staying for.",
              { base: { fontSize: "1.125rem", lineHeight: "1.6", maxWidth: "30rem" } },
            ),
            group(
              "Buttons",
              [
                action("Book button", "Book a table", "/visit", {
                  background: claret,
                  text: onClaret,
                }),
                link("Menu link", "See this week’s menu", "/menu", {
                  textDecoration: "underline",
                  alignSelf: "center",
                }),
              ],
              { base: { flexDirection: "row", flexWrap: "wrap", gap: space(5) } },
            ),
          ],
          at(1, 5, 3, { gap: space(6), alignSelf: "end" }),
          animate("fade-up", { delay: 300 }),
        ),
        image(
          "The toll house",
          "tollbooth-house",
          "Drawing of a small six-sided stone house with a chimney and a red arched door",
          at(7, 6, 3),
          animate("mask-reveal-up", { delay: 150 }),
        ),
      ],
      { top: 7, bottom: 9 },
    ),
    gridBand(
      "This week",
      [
        image(
          "Plate",
          "tollbooth-plate",
          "A plate seen from above: two scallops in their shells on dressed leaves",
          at(1, 5, "1 / span 3"),
          animate("mask-reveal-up"),
        ),
        withStyles(label("From this week’s menu"), at(7, 6, 1, { alignSelf: "end" })),
        heading(
          "Section title",
          "Cooked over the fire",
          2,
          at(7, 6, 2, {
            ...serif,
            fontSize: "clamp(2rem, 4vw, 3.5rem)",
            fontWeight: "400",
            lineHeight: "1.05",
          }),
        ),
        group(
          "Dishes and link",
          [
            priceList(
              "Dishes",
              [
                {
                  name: "Orkney scallops",
                  detail: "In the shell, wild garlic butter",
                  price: "£16",
                },
                {
                  name: "Leeks from Dunbar",
                  detail: "Charred, hazelnut, sheep’s curd",
                  price: "£11",
                },
                {
                  name: "Hake for two",
                  detail: "Whole, on the bone, brown butter and capers",
                  price: "£48",
                },
              ],
              {
                nameStyles: { ...serif, fontSize: "1.25rem" },
                animation: animate("stagger-up", { stagger: 60 }),
              },
            ),
            link("Menu link", "The whole menu", "/menu", {
              ...parts.look.detail,
              textDecoration: "underline",
            }),
          ],
          at(7, 6, 3, { gap: space(5) }),
        ),
      ],
      { top: 8, bottom: 9 },
    ),
    band(
      "What people say",
      [
        words(
          "Quote",
          "“The kind of room where you book the next visit before the pudding arrives.”",
          {
            base: {
              ...serif,
              fontSize: "clamp(1.75rem, 4.4vw, 3.75rem)",
              lineHeight: "1.1",
              letterSpacing: "-0.015em",
              fontStyle: "italic",
              maxWidth: "52rem",
              marginLeft: "auto",
              marginRight: "auto",
              textAlign: "center",
            },
          },
          animate("fade-up"),
        ),
        withStyles(label("The Northern Table, spring guide 2026", "Who said it"), {
          base: { textAlign: "center", color: "inherit", opacity: "0.75" },
        }),
      ],
      {
        top: 10,
        bottom: 10,
        colours: { background: ink, text: paper },
        styles: { base: { display: "flex", flexDirection: "column", gap: space(5) } },
      },
    ),
    gridBand(
      "Hours and address",
      [
        heading(
          "Hours title",
          "Opening hours",
          2,
          at(1, 5, 1, { ...serif, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: "400" }),
        ),
        withStyles(hoursTable(), at(1, 5, 2)),
        heading(
          "Address title",
          "Finding us",
          2,
          at(7, 6, 1, { ...serif, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: "400" }),
        ),
        group(
          "Address and directions",
          [
            words("Address", address, { base: { whiteSpace: "pre-line", fontSize: "1.125rem" } }),
            words(
              "Directions",
              "At the foot of Leith Walk, where it meets Great Junction Street. The tram stops at the door; there is no parking, but plenty of bike racks.",
              { base: { color: parts.look.quiet } },
            ),
            link("Phone", `Call ${phone}`, phoneHref, { textDecoration: "underline" }),
          ],
          at(7, 5, 2, { gap: space(4) }),
          animate("fade-up"),
        ),
      ],
      { top: 8, bottom: 9 },
    ),
  ],
};

const menuPage = {
  slug: "menu",
  title: "Menu",
  summary: "This week's menu at Tollbooth: snacks, small plates, the fire, sides and puddings.",
  sections: [
    pageTop({
      label: "Week of 2 November",
      title: "Menu",
      text: "It changes most weeks with what comes in. Tell us about allergies when you book and we’ll cook around them.",
    }),
    course("Snacks", "While you choose.", [
      { name: "Sourdough and cultured butter", price: "£5" },
      { name: "Smoked mussels on toast", detail: "Pickled shallot", price: "£7" },
      { name: "Fried Jerusalem artichokes", detail: "Bay salt", price: "£6" },
    ]),
    course("Small plates", "Two or three each, to share.", [
      { name: "Orkney scallops", detail: "In the shell, wild garlic butter", price: "£16" },
      { name: "Leeks from Dunbar", detail: "Charred, hazelnut, sheep’s curd", price: "£11" },
      { name: "Beef tartare", detail: "Smoked egg yolk, rye crumbs", price: "£14" },
      { name: "Beetroot from the embers", detail: "Horseradish, dill", price: "£10" },
    ]),
    course("From the fire", "For the table to share.", [
      { name: "Hake for two", detail: "Whole, on the bone, brown butter and capers", price: "£48" },
      { name: "Hogget shoulder", detail: "Anchovy, salsa verde, for two or three", price: "£56" },
      { name: "Hen of the woods", detail: "Barley, kale, pickled walnut", price: "£19" },
    ]),
    course("Puddings", "Worth staying for.", [
      { name: "Burnt honey tart", detail: "Crème fraîche", price: "£8" },
      { name: "Rhubarb from the forcing pots", detail: "Oat crumble, custard", price: "£8" },
      { name: "Isle of Mull cheddar", detail: "Oatcakes, quince", price: "£9" },
    ]),
    gridBand(
      "Wine",
      [
        image(
          "Wine",
          "tollbooth-glass",
          "A glass of red wine beside a dark bottle with a plain label",
          at(1, 4, 1),
          animate("mask-reveal-up"),
        ),
        group(
          "About the wine",
          [
            heading("Wine title", "Wine", 2, {
              base: { ...serif, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: "400" },
            }),
            words(
              "Wine",
              "Forty bottles from small growers who farm without chemicals, most of them from France, Spain and Slovenia. Every one is also sold by the glass on the night it’s opened. Ask us; we like talking about it.",
              { base: { fontSize: "1.125rem", lineHeight: "1.6" } },
            ),
          ],
          at(6, 6, 1, { alignSelf: "center", gap: space(4) }),
          animate("fade-up"),
        ),
      ],
      { top: 8, bottom: 9 },
    ),
  ],
};

const storyPage = {
  slug: "story",
  title: "Our story",
  summary: "How a stone toll house on Leith Walk became a restaurant.",
  sections: [
    pageTop({
      label: "Our story",
      title: "A toll house, a sweet shop, then us.",
      text: "Mairi and Tom Lennox opened Tollbooth in 2019 with a second-hand grill and twelve chairs.",
    }),
    gridBand(
      "The room",
      [
        image(
          "The room",
          "tollbooth-room",
          "Drawing of a long table lit by three candles under a tall round-headed window",
          at(1, 7, 1),
          animate("mask-reveal-up"),
        ),
        words(
          "About the room",
          "The house was built in 1820 to take tolls from carts coming up from the docks. After the tolls stopped it was a sweet shop for ninety years, then empty for ten. We kept the stone, the shutters and the bend in the floor, put a wood grill where the counter was, and built one long oak table down the middle.\n\nMairi runs the kitchen; Tom runs the room and the wine. Most nights you’ll meet both of us.",
          at(9, 4, 1, { whiteSpace: "pre-line", lineHeight: "1.65", alignSelf: "end" }),
          animate("fade-up", { delay: 150 }),
        ),
      ],
      { top: 4, bottom: 8 },
    ),
    band(
      "Over the years",
      [
        heading("Timeline title", "Over the years", 2, {
          base: { ...serif, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: "400" },
        }),
        {
          type: "timeline",
          name: "Our years",
          props: {
            numbered: false,
            items: [
              { when: "1820", title: "The toll house", text: "Built at the foot of Leith Walk." },
              {
                when: "1883",
                title: "Lennie’s sweet shop",
                text: "Boiled sweets and tablet for ninety years.",
              },
              {
                when: "2019",
                title: "Tollbooth opens",
                text: "Twelve chairs, a second-hand grill and a lot of borrowed plates.",
              },
              {
                when: "Today",
                title: "Twenty-eight seats",
                text: "And a waiting list for Friday nights.",
              },
            ],
          },
          animation: animate("stagger-up", { stagger: 80 }),
        },
      ],
      {
        top: 6,
        bottom: 9,
        styles: {
          base: {
            display: "flex",
            flexDirection: "column",
            gap: space(6),
          },
        },
        measure: "52rem",
      },
    ),
  ],
};

const visitPage = {
  slug: "visit",
  title: "Visit",
  summary: "Book a table at Tollbooth, find us on Leith Walk and see when we're open.",
  sections: [
    pageTop({
      label: "Tables for one to six",
      title: "Book a table",
      text: "Phone us between 2pm and 10pm, Wednesday to Sunday. We keep four seats at the counter for walk-ins every night.",
    }),
    gridBand(
      "How to book",
      [
        group(
          "Phone",
          [
            label("Phone"),
            link("Phone number", phone, phoneHref, {
              ...serif,
              fontSize: "clamp(2rem, 5vw, 4rem)",
              lineHeight: "1",
              letterSpacing: "-0.02em",
            }),
            words("When", "2pm to 10pm, Wednesday to Sunday", {
              base: { color: parts.look.quiet },
            }),
          ],
          at(1, 6, 1),
          animate("fade-up"),
        ),
        group(
          "Email",
          [
            label("Email"),
            link("Email address", email, `mailto:${email}`, {
              ...serif,
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              lineHeight: "1.1",
            }),
            words(
              "Bigger tables",
              "For seven or more, the whole room (up to twenty-eight) or a cancellation, write to us with the date, the time and how many of you there’ll be.",
              { base: { color: parts.look.quiet } },
            ),
          ],
          at(8, 5, 1),
          animate("fade-up", { delay: 120 }),
        ),
      ],
      { top: 2, bottom: 8 },
    ),
    band(
      "Booking request",
      [
        heading("Form title", "Ask about a bigger table", 2, {
          base: { ...serif, fontSize: "clamp(1.5rem, 2.6vw, 2.25rem)", fontWeight: "400" },
        }),
        { type: "formEmbed", name: "Form", props: { form: "contact", showTitle: false } },
      ],
      {
        top: 6,
        bottom: 8,
        styles: {
          base: {
            display: "flex",
            flexDirection: "column",
            gap: space(5),
          },
        },
        measure: "40rem",
      },
    ),
    gridBand(
      "Hours and address",
      [
        group(
          "Hours",
          [
            heading("Hours title", "When we’re open", 2, {
              base: { ...serif, fontSize: "clamp(1.5rem, 2.6vw, 2.25rem)", fontWeight: "400" },
            }),
            hoursTable(),
          ],
          at(1, 5, 1, { gap: space(5) }),
        ),
        image(
          "The grill",
          "tollbooth-grill",
          "Flames rising through the bars of a wood-fired grill",
          at(7, 6, 1),
          animate("mask-reveal-up"),
        ),
      ],
      { top: 6, bottom: 9 },
    ),
  ],
};

export const tollboothSite: StarterSite = {
  id: "tollbooth",
  name: "Tollbooth",
  description:
    "A warm restaurant site with a menu that reads like the card on the table, opening hours and a way to book.",
  suitedTo: "Restaurants, wine bars and cafés",
  coverIllustration: "tollbooth-cover",
  theme: {
    brandColour: "#8a2c2c",
    accentColour: "#e2c48f",
    fontPairing: "classic",
    cornerStyle: "square",
    headingFont: "Fraunces",
    bodyFont: "Work Sans",
  },
  designVariables: [claretVariable],
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "none" },
    pageTransition: { style: "fade", duration: 450 },
    intro: { style: "name", text: "Tollbooth", background: "#16130f", colour: "#efe8dc" },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  pages: [homePage, menuPage, storyPage, visitPage],
};
