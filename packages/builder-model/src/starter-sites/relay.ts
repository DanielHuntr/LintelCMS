import type { NodeBlueprint } from "../components/component-definition.js";
import type { NodeStyles, StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import { menuDrawer, siteLogo, siteMenuRow } from "../sections/site-navigation.js";
import type { StarterPage, StarterSite } from "./starter-site.js";

/**
 * Relay: the site of a small software company in Glasgow that makes a crew-scheduling app
 * for trades and events teams. One sans-serif (Manrope) set large and tight, a monospace
 * (Space Mono) for dates, versions and labels, warm off-white paper and near-black ink, and
 * one signal green, lighter in dark mode so it keeps its contrast. Features step across a
 * twelve-column grid beside drawings of the app rather than sitting in a row of cards, and
 * the updates page reads like a release log.
 */

// Colours follow the visitor's light or dark setting (CSS light-dark), so they are only set here.
const paper = "light-dark(#f4f3ee, #111312)";
const panel = "light-dark(#e9e8e1, #1a1d1b)";
const ink = "light-dark(#141615, #ecebe5)";
const quiet = "light-dark(#585b57, #a4a7a1)";
const rule = "light-dark(#d6d4cc, #2d302e)";
/** The one accent: 5.1:1 on the paper in light mode, 10:1 on it in dark mode. */
const green = "light-dark(#1d754a, #5fcf95)";
const onGreen = "light-dark(#ffffff, #0c1410)";
const mono = "'Space Mono', ui-monospace, monospace";

const email = "hello@relayrota.example";
const phone = "0141 496 0000";

/** Small capitals in the monospace, for labels, dates and versions. */
const detail: StyleDeclarations = {
  fontFamily: mono,
  fontSize: "0.75rem",
  lineHeight: "1.5",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const flush: StyleDeclarations = { marginTop: "0", marginBottom: "0" };

const ruleAbove: StyleDeclarations = {
  borderStyle: "solid",
  borderColor: rule,
  borderWidth: "1px 0 0 0",
};

/** A band of the page with the same side margins everywhere. */
function band(
  bandName: string,
  children: NodeBlueprint[],
  options: { element?: string; top?: number; bottom?: number; styles?: NodeStyles } = {},
): NodeBlueprint {
  const top = options.top ?? 9;
  const bottom = options.bottom ?? 9;
  return {
    type: "section",
    name: bandName,
    props: { element: options.element ?? "section", anchor: "" },
    styles: {
      ...options.styles,
      base: {
        backgroundColor: paper,
        color: ink,
        paddingTop: space(top),
        paddingBottom: space(bottom),
        paddingLeft: "clamp(1.25rem, 4vw, 3.5rem)",
        paddingRight: "clamp(1.25rem, 4vw, 3.5rem)",
        ...options.styles?.base,
      },
      phone: {
        paddingTop: space(Math.max(top - 2, 4)),
        paddingBottom: space(Math.max(bottom - 2, 4)),
        ...options.styles?.phone,
      },
    },
    children,
  };
}

/** A band laid out on the twelve-column grid; on phones it goes back to one under another. */
function gridBand(
  bandName: string,
  children: NodeBlueprint[],
  options: { element?: string; top?: number; bottom?: number; styles?: NodeStyles } = {},
): NodeBlueprint {
  return {
    ...band(bandName, children, {
      ...options,
      styles: {
        ...options.styles,
        base: {
          columnGap: "clamp(0.75rem, 1.8vw, 1.75rem)",
          rowGap: space(5),
          ...options.styles?.base,
        },
      },
    }),
    placedGrid: { columns: 12, stackOnPhone: true },
  };
}

/** Where an element sits on the grid: columns `column` to `column + span - 1`, from `row`. */
function at(
  column: number,
  span: number,
  row: number,
  extra: StyleDeclarations = {},
  rowSpan = 1,
): StyleDeclarations {
  return {
    gridColumn: `${column} / span ${span}`,
    gridRow: rowSpan > 1 ? `${row} / span ${rowSpan}` : String(row),
    ...extra,
  };
}

function label(words: string, labelName = "Label", styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "text",
    name: labelName,
    props: { text: words },
    styles: { base: { ...detail, color: quiet, ...flush, ...styles } },
  };
}

function words(textName: string, text: string, styles: NodeStyles): NodeBlueprint {
  return { type: "text", name: textName, props: { text }, styles };
}

function title(name: string, text: string, level: number, styles: NodeStyles): NodeBlueprint {
  return { type: "heading", name, props: { text, level }, styles };
}

function picture(name: string, illustration: string, alt: string, styles: NodeStyles) {
  return {
    type: "image",
    name,
    props: { src: `/_lintel/illustrations/${illustration}.svg`, alt, assetId: null, caption: "" },
    styles: {
      ...styles,
      base: { width: "100%", height: "auto", borderRadius: "0.75rem", ...styles.base },
    },
  } satisfies NodeBlueprint;
}

function link(words: string, href: string, styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "link",
    props: { label: words, href, openInNewTab: false },
    styles: {
      base: { color: "inherit", textDecoration: "none", width: "fit-content", ...styles },
      hover: { color: green },
    },
  };
}

/** A pill-shaped button: green, or outlined in the text colour. */
function pill(
  words: string,
  href: string,
  look: "green" | "outline" | "paper" = "green",
): NodeBlueprint {
  const looks: Record<string, StyleDeclarations> = {
    green: { backgroundColor: green, color: onGreen },
    outline: {
      backgroundColor: "transparent",
      color: ink,
      borderStyle: "solid",
      borderWidth: "1px",
      borderColor: ink,
    },
    paper: { backgroundColor: paper, color: ink },
  };
  return {
    type: "button",
    props: { label: words, href, openInNewTab: false },
    styles: {
      base: {
        display: "inline-block",
        width: "fit-content",
        paddingTop: "0.8rem",
        paddingBottom: "0.8rem",
        paddingLeft: "1.4rem",
        paddingRight: "1.4rem",
        borderRadius: "999px",
        fontWeight: "700",
        textDecoration: "none",
        ...looks[look],
      },
      hover: { opacity: "0.85" },
    },
    animation: animate("press"),
  };
}

function row(name: string, children: NodeBlueprint[], styles: StyleDeclarations = {}) {
  return {
    type: "box",
    name,
    styles: {
      base: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: space(3),
        ...styles,
      },
    },
    children,
  } satisfies NodeBlueprint;
}

function stack(name: string, children: NodeBlueprint[], styles: NodeStyles = { base: {} }) {
  return {
    type: "box",
    name,
    styles: {
      ...styles,
      base: { display: "flex", flexDirection: "column", gap: space(3), ...styles.base },
    },
    children,
  } satisfies NodeBlueprint;
}

/** The site's navigation, on every page: the name, the menu and a way to start. */
function navigation(): NodeBlueprint {
  return band(
    "Navigation",
    [
      siteLogo("name", {
        color: ink,
        textDecoration: "none",
        fontFamily: "inherit",
        fontSize: "1.25rem",
        fontWeight: "800",
        letterSpacing: "-0.04em",
        minHeight: "0",
      }),
      row(
        "Menu and button",
        [
          siteMenuRow({ styles: { fontWeight: "500", color: ink } }),
          {
            ...pill("Start free", "/start"),
            name: "Start button",
            styles: {
              base: {
                display: "inline-block",
                width: "fit-content",
                paddingTop: "0.55rem",
                paddingBottom: "0.55rem",
                paddingLeft: "1.1rem",
                paddingRight: "1.1rem",
                borderRadius: "999px",
                fontWeight: "700",
                fontSize: "0.9375rem",
                textDecoration: "none",
                backgroundColor: green,
                color: onGreen,
              },
              hover: { opacity: "0.85" },
              phone: { display: "none" },
            },
          },
          menuDrawer(),
        ],
        { gap: space(5) },
      ),
    ],
    {
      element: "header",
      top: 4,
      bottom: 4,
      styles: {
        base: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space(4),
          borderStyle: "solid",
          borderColor: rule,
          borderWidth: "0 0 1px 0",
        },
        phone: { paddingTop: space(3), paddingBottom: space(3) },
      },
    },
  );
}

/** The site's footer, on every page: what Relay is, its pages, how to reach the team. */
function footer(): NodeBlueprint {
  return gridBand(
    "Footer",
    [
      words("Footer line", "Rotas that sort themselves out, from a small team in Glasgow.", {
        base: at(1, 5, 1, {
          fontSize: "clamp(1.5rem, 2.6vw, 2.25rem)",
          fontWeight: "700",
          lineHeight: "1.1",
          letterSpacing: "-0.03em",
          ...flush,
        }),
      }),
      stack(
        "Footer links",
        [
          link("Pricing", "/pricing"),
          link("Updates", "/updates"),
          link("Start free", "/start"),
          // Shows only once the site asks visitors about cookies.
          {
            type: "cookieSettings",
            styles: {
              base: { color: "inherit", textDecoration: "none", width: "fit-content" },
              hover: { color: green },
            },
          },
        ],
        { base: at(7, 3, 1, { gap: space(2) }) },
      ),
      stack(
        "Contact",
        [
          link(email, `mailto:${email}`),
          link(phone, `tel:${phone.replaceAll(" ", "")}`),
          words("Address", "Unit 4, 62 Templeton Street\nGlasgow G40 1DA", {
            base: { color: quiet, whiteSpace: "pre-line", ...flush },
          }),
        ],
        { base: at(10, 3, 1, { gap: space(2) }) },
      ),
      label("© 2026 Relay Rotas Ltd. Registered in Scotland.", "Small print", {
        ...at(1, 6, 2),
        paddingTop: space(5),
        ...ruleAbove,
      }),
      {
        ...label("Status: all running", "Status"),
        styles: {
          base: {
            ...detail,
            color: quiet,
            ...flush,
            ...at(7, 6, 2),
            paddingTop: space(5),
            textAlign: "right",
            ...ruleAbove,
          },
          phone: { textAlign: "left", paddingTop: "0", borderWidth: "0" },
        },
      },
    ],
    {
      element: "footer",
      top: 8,
      bottom: 6,
      styles: { base: { ...ruleAbove }, phone: { rowGap: space(5) } },
    },
  );
}

/** The green band near the end of each page: one sentence and one button. */
function startBand(heading: string, text: string): NodeBlueprint {
  return gridBand(
    "Start free",
    [
      title("Invitation", heading, 2, {
        base: at(1, 8, 1, {
          fontSize: "clamp(2.25rem, 5.5vw, 5rem)",
          fontWeight: "800",
          lineHeight: "0.95",
          letterSpacing: "-0.045em",
          color: "inherit",
          ...flush,
        }),
      }),
      words("Invitation text", text, {
        base: at(1, 5, 2, { fontSize: "1.125rem", lineHeight: "1.5", maxWidth: "32rem", ...flush }),
      }),
      {
        ...pill("Start a free month", "/start", "paper"),
        name: "Start button",
        styles: {
          base: {
            ...at(9, 4, 2, { alignSelf: "end", justifySelf: "end" }),
            display: "inline-block",
            width: "fit-content",
            paddingTop: "1rem",
            paddingBottom: "1rem",
            paddingLeft: "1.75rem",
            paddingRight: "1.75rem",
            borderRadius: "999px",
            fontWeight: "700",
            fontSize: "1.0625rem",
            textDecoration: "none",
            backgroundColor: paper,
            color: ink,
          },
          hover: { opacity: "0.88" },
          phone: { justifySelf: "start" },
        },
        effects: [{ effect: "cursor-word", params: { text: "Start" } }],
      },
    ],
    {
      top: 9,
      bottom: 9,
      styles: { base: { backgroundColor: green, color: onGreen } },
    },
  );
}

/** The top of an inner page: a label, a large title and a sentence, stepped across the grid. */
function pageTop(copy: { label: string; title: string; text: string }): NodeBlueprint {
  return gridBand(
    "Page title",
    [
      label(copy.label, "Label", { ...at(1, 3, 1), color: green }),
      {
        ...title("Page title", copy.title, 1, {
          base: at(1, 10, 2, {
            fontSize: "clamp(2.75rem, 8vw, 7.5rem)",
            fontWeight: "800",
            lineHeight: "0.92",
            letterSpacing: "-0.05em",
            ...flush,
          }),
        }),
        animation: animate("words-rise"),
      },
      {
        ...words("Introduction", copy.text, {
          base: at(7, 5, 3, { fontSize: "1.1875rem", lineHeight: "1.5", ...flush }),
        }),
        animation: animate("fade-in", { delay: 300 }),
      },
    ],
    { top: 9, bottom: 7 },
  );
}

interface Feature {
  number: string;
  heading: string;
  text: string;
}

function feature(item: Feature, styles: StyleDeclarations): NodeBlueprint {
  return {
    ...stack(
      item.heading,
      [
        label(item.number, "Number", { color: green }),
        title("Feature title", item.heading, 3, {
          base: {
            fontSize: "clamp(1.5rem, 2.4vw, 2rem)",
            fontWeight: "700",
            lineHeight: "1.1",
            letterSpacing: "-0.03em",
            ...flush,
          },
        }),
        words("Feature text", item.text, {
          base: { color: quiet, fontSize: "1.0625rem", lineHeight: "1.55", ...flush },
        }),
      ],
      { base: { ...styles, paddingTop: space(4), ...ruleAbove } },
    ),
    animation: animate("fade-up"),
  };
}

const features: readonly Feature[] = [
  {
    number: "01",
    heading: "Everyone sees their own week",
    text: "Each person gets their shifts, addresses and notes on their phone, and a text when something changes. No app to sign up for: the link in the text is enough.",
  },
  {
    number: "02",
    heading: "Swaps without the group chat",
    text: "Someone can’t make Thursday? They offer the shift, a colleague with the right tickets takes it, and you approve it with one tap.",
  },
  {
    number: "03",
    heading: "The day’s jobs, in the right order",
    text: "Relay lines up the day’s addresses so the van isn’t crossing the city twice, and shows how long the drive between each one should take.",
  },
  {
    number: "04",
    heading: "Timesheets that add up",
    text: "Clock in and out happens on the job. At the end of the month the hours are already checked, totalled and ready for payroll.",
  },
];

const homePage: StarterPage = {
  slug: "home",
  title: "Home",
  summary:
    "Relay is crew scheduling for trades and events teams: one board for the week, shifts on everyone’s phone, swaps without the group chat.",
  sections: [
    gridBand(
      "Introduction",
      [
        label("Crew scheduling for trades and events", "Label", at(1, 5, 1)),
        {
          ...link("Version 4.2 is out: route view →", "/updates", {
            ...detail,
            ...at(8, 5, 1, { justifySelf: "end" }),
            color: green,
          }),
          name: "Latest update",
        },
        {
          ...title("Main title", "The rota, sorted before the van leaves.", 1, {
            base: at(1, 11, 2, {
              fontSize: "clamp(3rem, 9.4vw, 9rem)",
              fontWeight: "800",
              lineHeight: "0.9",
              letterSpacing: "-0.055em",
              marginTop: space(5),
              marginBottom: "0",
            }),
            phone: { marginTop: space(3) },
          }),
          animation: animate("words-rise"),
        },
        {
          ...stack(
            "Introduction text and buttons",
            [
              words(
                "About in a line",
                "Relay puts your whole crew on one board: who’s where, in which van, with which kit. Change a job and everyone it touches hears about it.",
                { base: { fontSize: "1.1875rem", lineHeight: "1.5", ...flush } },
              ),
              row("Buttons", [
                pill("Start a free month", "/start"),
                pill("See pricing", "/pricing", "outline"),
              ]),
              label("Free for a month. No card needed.", "Reassurance"),
            ],
            { base: at(1, 4, 3, { gap: space(5), alignSelf: "start", marginTop: space(6) }) },
          ),
          animation: animate("fade-up", { delay: 300 }),
        },
        {
          ...picture(
            "Week board",
            "relay-board",
            "Drawing of Relay’s week board: five people down the side, five days across and their shifts as dark bars, two picked out in green",
            {
              base: at(6, 7, 3, { marginTop: space(6) }),
              phone: { marginTop: "0" },
            },
          ),
          animation: animate("mask-reveal-up", { delay: 200 }),
        },
      ],
      { top: 7, bottom: 9 },
    ),
    gridBand(
      "Who uses it",
      [
        label("In use", "Label", at(1, 2, 1)),
        {
          ...words(
            "Who uses it",
            "1,400 crews across the UK and Ireland plan their week in Relay: electricians, stage builders, caterers, window cleaners and one very organised brass band.",
            {
              base: at(3, 9, 1, {
                fontSize: "clamp(1.375rem, 2.8vw, 2.375rem)",
                lineHeight: "1.2",
                letterSpacing: "-0.025em",
                ...flush,
              }),
            },
          ),
          animation: animate("fade-up"),
        },
      ],
      { top: 7, bottom: 7, styles: { base: { backgroundColor: panel } } },
    ),
    gridBand(
      "What it does",
      [
        label("What it does", "Label", at(1, 2, 1)),
        title("Section title", "Built around the way crews really work.", 2, {
          base: at(3, 8, 1, {
            fontSize: "clamp(2rem, 4.6vw, 4rem)",
            fontWeight: "800",
            lineHeight: "0.98",
            letterSpacing: "-0.045em",
            ...flush,
          }),
        }),
        feature(features[0]!, at(7, 5, 2, { alignSelf: "end" })),
        {
          ...picture(
            "Phone picture",
            "relay-phone",
            "Drawing of a phone showing Thursday’s shift with the address and a green Accepted button",
            { base: at(1, 4, 2, { marginTop: space(6) }, 2), phone: { marginTop: "0" } },
          ),
          animation: animate("fade-up"),
        },
        feature(features[1]!, at(7, 5, 3, { alignSelf: "start" })),
        {
          ...picture(
            "Swap picture",
            "relay-swap",
            "Drawing of two shift cards, one dark and one green, with an arrow between them for a swap",
            { base: at(5, 8, 4, { marginTop: space(6) }), phone: { marginTop: "0" } },
          ),
          animation: animate("mask-reveal-up"),
        },
        feature(features[2]!, at(1, 4, 4, { alignSelf: "end" })),
        feature(features[3]!, at(9, 4, 5, { marginTop: space(6) })),
        {
          ...picture(
            "Route picture",
            "relay-route",
            "Drawing of a street map with a dotted route joining four stops, the last one green",
            { base: at(1, 7, 5, { marginTop: space(6) }), phone: { marginTop: "0" } },
          ),
          animation: animate("mask-reveal-up"),
        },
      ],
      { top: 9, bottom: 9 },
    ),
    gridBand(
      "How it works",
      [
        title("Section title", "Up and running by Monday.", 2, {
          base: at(1, 6, 1, {
            fontSize: "clamp(2rem, 4.6vw, 4rem)",
            fontWeight: "800",
            lineHeight: "0.98",
            letterSpacing: "-0.045em",
            ...flush,
          }),
        }),
        ...[
          [
            "Step 1",
            "Add your people",
            "Paste in names and mobile numbers, or import the spreadsheet you use now.",
          ],
          [
            "Step 2",
            "Lay out the week",
            "Drag jobs onto the board. Relay warns you about double bookings and missing tickets.",
          ],
          [
            "Step 3",
            "Press send",
            "Everyone gets their week by text. From then on, only the changes.",
          ],
        ].map(([step = "", heading = "", text = ""], index) => ({
          ...stack(
            heading,
            [
              label(step, "Step number", { color: green }),
              title("Step title", heading, 3, {
                base: {
                  fontSize: "1.375rem",
                  fontWeight: "700",
                  letterSpacing: "-0.02em",
                  ...flush,
                },
              }),
              words("Step text", text, { base: { color: quiet, lineHeight: "1.55", ...flush } }),
            ],
            { base: at(1 + index * 4, 4, 2, { paddingTop: space(4), ...ruleAbove }) },
          ),
          animation: animate("fade-up", { delay: index * 120 }),
        })),
      ],
      { top: 9, bottom: 9, styles: { base: { backgroundColor: panel } } },
    ),
    gridBand(
      "Customer quote",
      [
        {
          type: "quote",
          name: "Quote",
          props: {
            text: "I used to lose every Sunday night to the rota. Now it takes ten minutes on a Friday, and nobody rings me at six in the morning asking where they’re meant to be.",
            citation: "Morag Kerr, operations, Kerr & Lyle Electrical",
          },
          styles: {
            base: at(2, 10, 1, {
              fontSize: "clamp(1.5rem, 3.2vw, 2.75rem)",
              lineHeight: "1.2",
              letterSpacing: "-0.025em",
              ...flush,
            }),
          },
          animation: animate("fade-up"),
        },
      ],
      { top: 9, bottom: 9 },
    ),
    startBand(
      "Try it with your crew for a month.",
      "No card needed. If Relay isn’t for you, we’ll hand everything back as a spreadsheet.",
    ),
  ],
};

interface Plan {
  name: string;
  price: string;
  per: string;
  description: string;
  includes: string[];
  button: string;
  highlighted?: boolean;
}

const plans: readonly Plan[] = [
  {
    name: "Small crew",
    price: "£0",
    per: "up to 5 people",
    description: "For a sole trader and a couple of regulars.",
    includes: ["The week board", "Shifts by text", "One admin"],
    button: "Start free",
  },
  {
    name: "Team",
    price: "£4",
    per: "per person, per month",
    description: "What most crews choose.",
    includes: [
      "Everything in Small crew",
      "Shift swaps",
      "Route view",
      "Timesheets",
      "Five admins",
    ],
    button: "Start a free month",
    highlighted: true,
  },
  {
    name: "Company",
    price: "£6",
    per: "per person, per month",
    description: "For several depots or a big events season.",
    includes: [
      "Everything in Team",
      "Depots and regions",
      "Payroll export",
      "A named person to call",
    ],
    button: "Talk to us",
  },
];

function planCard(plan: Plan, index: number): NodeBlueprint {
  return {
    type: "box",
    name: plan.name,
    props: { element: "article" },
    styles: {
      base: at(1 + index * 4, 4, 1, {
        display: "flex",
        flexDirection: "column",
        gap: space(4),
        paddingTop: space(6),
        paddingBottom: space(6),
        paddingLeft: space(6),
        paddingRight: space(6),
        borderRadius: "1rem",
        borderStyle: "solid",
        borderWidth: plan.highlighted ? "2px" : "1px",
        borderColor: plan.highlighted ? green : rule,
        backgroundColor: plan.highlighted ? panel : paper,
      }),
    },
    animation: animate("fade-up", { delay: index * 100 }),
    children: [
      row("Plan name", [
        title("Plan name", plan.name, 2, {
          base: { fontSize: "1.25rem", fontWeight: "700", ...flush },
        }),
        ...(plan.highlighted ? [label("Most chosen", "Most chosen", { color: green })] : []),
      ]),
      words("Price", plan.price, {
        base: {
          fontSize: "clamp(3rem, 5vw, 4.5rem)",
          fontWeight: "800",
          lineHeight: "1",
          letterSpacing: "-0.05em",
          ...flush,
        },
      }),
      label(plan.per, "Per"),
      words("Plan description", plan.description, { base: { ...flush } }),
      {
        type: "list",
        name: "What's included",
        props: { items: plan.includes, ordered: false },
        styles: { base: { color: quiet, lineHeight: "1.8", ...flush } },
      },
      pill(
        plan.button,
        plan.button === "Talk to us" ? `mailto:${email}` : "/start",
        plan.highlighted ? "green" : "outline",
      ),
    ],
  };
}

const questions: readonly [string, string][] = [
  [
    "Do my crew need to download anything?",
    "No. They get a text with a link to their week, which opens in the phone’s browser. If they’d like the app, it’s free on both stores.",
  ],
  [
    "Who counts as a person?",
    "Anyone you put on the board in a month. Someone who only worked one weekend in July counts for July and not after.",
  ],
  [
    "Can I bring over the spreadsheet we use now?",
    "Yes. Upload it and Relay matches the columns for you. Most crews are moved over in an afternoon, and we’ll do it for you on the Company plan.",
  ],
  [
    "What happens after the free month?",
    "We email you a week before it ends. If you don’t choose a plan, your account goes back to Small crew; nothing is deleted.",
  ],
  [
    "Where is our data kept?",
    "On servers in the UK and Ireland, backed up every night. You can export everything, at any time, as a spreadsheet.",
  ],
];

const pricingPage: StarterPage = {
  slug: "pricing",
  title: "Pricing",
  summary: "Relay’s prices: free for up to five people, then one price per person each month.",
  sections: [
    pageTop({
      label: "Pricing",
      title: "One price per person. No setup fees.",
      text: "Pay monthly for the people on your board, and change plans whenever the season does. Prices are before VAT.",
    }),
    gridBand("Plans", plans.map(planCard), { top: 2, bottom: 9 }),
    gridBand(
      "Questions",
      [
        title("Section title", "Questions people ask before they switch.", 2, {
          base: at(1, 4, 1, {
            fontSize: "clamp(1.75rem, 3.4vw, 2.75rem)",
            fontWeight: "800",
            lineHeight: "1.02",
            letterSpacing: "-0.04em",
            ...flush,
          }),
        }),
        {
          type: "accordion",
          name: "Questions",
          props: { onlyOneOpen: false },
          styles: { base: at(6, 7, 1) },
          animation: animate("fade-up"),
          children: questions.map(([question, answer]) => ({
            type: "accordionItem",
            props: { title: question, startsOpen: false },
            children: [
              {
                type: "text",
                props: { text: answer },
                styles: { base: { color: quiet, lineHeight: "1.6" } },
              },
            ],
          })),
        },
      ],
      { top: 9, bottom: 9, styles: { base: { ...ruleAbove } } },
    ),
    startBand(
      "See it with your own rota.",
      "Start free for a month on the Team plan. We’ll remind you before it ends.",
    ),
  ],
};

interface Update {
  date: string;
  version: string;
  kind: "New" | "Better" | "Fixed";
  heading: string;
  text: string;
}

const updates: readonly Update[] = [
  {
    date: "14 Oct 2026",
    version: "4.2",
    kind: "New",
    heading: "Route view for the day",
    text: "Open any day and see its jobs on a map, in the order Relay suggests. Drag a stop to change the order and everyone in the van gets the new one.",
  },
  {
    date: "23 Sep 2026",
    version: "4.1",
    kind: "Better",
    heading: "Shift swaps take one tap, not three",
    text: "Offering a shift now goes straight to the people who can take it, and approving it is a single tap from the text message.",
  },
  {
    date: "2 Sep 2026",
    version: "4.0",
    kind: "New",
    heading: "Timesheets go straight to payroll",
    text: "Checked hours export as a file your payroll software reads, with overtime and night rates already split out.",
  },
  {
    date: "5 Aug 2026",
    version: "3.9",
    kind: "New",
    heading: "Holiday allowances",
    text: "Set each person’s allowance once. Requests show on the board, and Relay stops you booking someone who’s off.",
  },
  {
    date: "8 Jul 2026",
    version: "3.8",
    kind: "Fixed",
    heading: "Faster on poor signal",
    text: "Weeks now load in under a second on a weak connection, and changes made with no signal are sent when it comes back.",
  },
  {
    date: "10 Jun 2026",
    version: "3.7",
    kind: "Better",
    heading: "Notes and photos on jobs",
    text: "Add the gate code, a photo of the fuse board or where to park. The note shows to whoever is on the job, and only to them.",
  },
];

function updateRow(update: Update): NodeBlueprint {
  return {
    type: "box",
    name: update.heading,
    props: { element: "article" },
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr) minmax(0, 7fr)",
        columnGap: "clamp(0.75rem, 1.8vw, 1.75rem)",
        rowGap: space(2),
        paddingTop: space(6),
        paddingBottom: space(6),
        ...ruleAbove,
      },
      phone: { gridTemplateColumns: "minmax(0, 1fr) auto", rowGap: space(3) },
    },
    children: [
      label(update.date, "Date", { color: ink }),
      label(`${update.kind} · ${update.version}`, "Kind and version", {
        color: green,
      }),
      stack(
        "Update",
        [
          title("Update title", update.heading, 2, {
            base: {
              fontSize: "clamp(1.375rem, 2.4vw, 2rem)",
              fontWeight: "700",
              lineHeight: "1.1",
              letterSpacing: "-0.03em",
              ...flush,
            },
          }),
          words("Update text", update.text, {
            base: {
              color: quiet,
              fontSize: "1.0625rem",
              lineHeight: "1.55",
              maxWidth: "40rem",
              ...flush,
            },
          }),
        ],
        { base: {}, phone: { gridColumn: "1 / span 2" } },
      ),
    ],
  };
}

const updatesPage: StarterPage = {
  slug: "updates",
  title: "Updates",
  summary: "Every Relay release, newest first, in plain words.",
  sections: [
    pageTop({
      label: "Updates",
      title: "What changed, and when.",
      text: "We ship small improvements most weeks and a bigger one about once a month. Here is every one of them, newest first.",
    }),
    band(
      "Release log",
      [
        {
          type: "box",
          name: "Releases",
          styles: {
            base: {
              display: "flex",
              flexDirection: "column",
              borderStyle: "solid",
              borderColor: rule,
              borderWidth: "0 0 1px 0",
            },
          },
          animation: animate("stagger-up", { stagger: 70 }),
          children: updates.map(updateRow),
        },
      ],
      { top: 2, bottom: 9 },
    ),
    startBand(
      "Every update is included.",
      "Whatever plan you’re on, new features turn up without you doing anything.",
    ),
  ],
};

const startPage: StarterPage = {
  slug: "start",
  title: "Start free",
  summary: "Start a free month of Relay: tell us about your crew and we’ll set up your board.",
  sections: [
    gridBand(
      "Start free",
      [
        label("Start free", "Label", { ...at(1, 3, 1), color: green }),
        {
          ...title("Page title", "Set up your board in an afternoon.", 1, {
            base: at(1, 8, 2, {
              fontSize: "clamp(2.75rem, 7vw, 6.5rem)",
              fontWeight: "800",
              lineHeight: "0.92",
              letterSpacing: "-0.05em",
              ...flush,
            }),
          }),
          animation: animate("words-rise"),
        },
        {
          ...stack(
            "What happens next",
            [
              words(
                "Introduction",
                "Tell us a little about your crew and we’ll open your account, load in a sample week and send you the link. The first month is free, and there’s no card to enter.",
                { base: { fontSize: "1.1875rem", lineHeight: "1.5", ...flush } },
              ),
              {
                type: "list",
                name: "Steps",
                props: {
                  items: [
                    "We reply within one working day",
                    "A twenty-minute call to set up your board, if you’d like one",
                    "Your crew gets their first week by text",
                  ],
                  ordered: true,
                },
                styles: { base: { lineHeight: "1.9", color: quiet, ...flush } },
              },
              label(`Prefer to talk? ${phone}, weekdays 8 till 6`, "Phone"),
            ],
            { base: at(1, 5, 3, { gap: space(5), marginTop: space(4) }) },
          ),
          animation: animate("fade-up", { delay: 250 }),
        },
        {
          ...picture(
            "Crew picture",
            "relay-crew",
            "Drawing of five people standing in a row, the one in the middle in green",
            { base: at(7, 6, 3, { marginTop: space(4) }), phone: { marginTop: "0" } },
          ),
          animation: animate("fade-in"),
        },
      ],
      { top: 8, bottom: 6 },
    ),
    // The form has a band of its own, so without Forms only it is left out.
    gridBand(
      "Sign-up",
      [
        {
          ...stack(
            "Sign-up form",
            [
              title("Form title", "Tell us about your crew", 2, {
                base: { fontSize: "1.5rem", fontWeight: "700", letterSpacing: "-0.02em", ...flush },
              }),
              { type: "formEmbed", name: "Form", props: { form: "contact", showTitle: false } },
            ],
            {
              base: at(1, 7, 1, {
                gap: space(4),
                paddingTop: space(6),
                paddingBottom: space(6),
                paddingLeft: space(6),
                paddingRight: space(6),
                borderRadius: "1rem",
                backgroundColor: panel,
              }),
              phone: { paddingLeft: space(5), paddingRight: space(5) },
            },
          ),
          animation: animate("fade-up", { delay: 400 }),
        },
      ],
      { top: 2, bottom: 9 },
    ),
  ],
};

export const relaySite: StarterSite = {
  id: "relay",
  name: "Relay",
  description:
    "A crisp site for a software product: a big headline, features beside drawings of the app, plain prices, a release log and a sign-up page.",
  suitedTo: "Apps, software products and online services",
  coverIllustration: "relay-cover",
  theme: {
    brandColour: "#1d754a",
    accentColour: "#141615",
    fontPairing: "system",
    cornerStyle: "round",
    headingFont: "Manrope",
    bodyFont: "Manrope",
  },
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "ring-and-dot", colour: "brand", size: 22 },
    pageTransition: { style: "slide", duration: 450 },
    intro: { style: "curtain", text: "", background: "#111312", colour: "#5fcf95" },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  pages: [homePage, pricingPage, updatesPage, startPage],
};
