import type { NodeBlueprint } from "../components/component-definition.js";
import type { NodeStyles, StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import { menuDrawer, siteLogo, siteMenuRow } from "../sections/site-navigation.js";
import type { StarterPage, StarterSite } from "./starter-site.js";

/**
 * Chambers: the site of a small firm of solicitors and accountants in Edinburgh's New Town.
 * Calm and plain on purpose: warm paper and deep green ink (the other way round in dark
 * mode), one oxblood accent, a serif for headings (DM Serif Display) over a clear sans
 * (DM Sans), and a twelve-column grid with plenty of room. Services come with their fees in
 * plain numbers, the team with initials rather than stock portraits, and the navigation and
 * footer are the site's own (site-sections/), shown on every page.
 */

// Colours follow the visitor's light or dark setting (CSS light-dark), so they are set here.
const paper = "light-dark(#f4f0e7, #141b18)";
const panel = "light-dark(#ebe5d8, #1c2622)";
const ink = "light-dark(#1f3a32, #e9e4d8)";
const quiet = "light-dark(#4f5d56, #aab3ac)";
const rule = "light-dark(#d6cfbe, #2f3b36)";
/** The one accent: oxblood, 8:1 on the paper; a soft rose in dark mode, 8:1 on the ink. */
const accent = "light-dark(#7a2e2a, #e3a79f)";

const firm = "Moray Lindsay";
const email = "hello@moraylindsay.example";
const phone = "0131 496 0712";
const address = "9 Abercromby Place\nEdinburgh EH3 6LB";

const picture = (name: string) => `/_lintel/illustrations/${name}.svg`;

const serif: StyleDeclarations = {
  fontFamily: "var(--lintel-font-heading)",
  fontWeight: "400",
  marginTop: "0",
  marginBottom: "0",
};

/** The small labels above titles: spaced capitals in the body font. */
const smallCaps: StyleDeclarations = {
  fontSize: "0.75rem",
  fontWeight: "700",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  lineHeight: "1.5",
};

const hairline: StyleDeclarations = {
  borderStyle: "solid",
  borderColor: rule,
  borderWidth: "1px 0 0 0",
};

/** A band of the page on the site's paper, with the same side margins everywhere. */
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
        paddingLeft: "clamp(1.25rem, 4vw, 4rem)",
        paddingRight: "clamp(1.25rem, 4vw, 4rem)",
        ...options.styles?.base,
      },
      phone: {
        paddingTop: space(Math.max(top - 2, 5)),
        paddingBottom: space(Math.max(bottom - 2, 5)),
        ...options.styles?.phone,
      },
    },
    children,
  };
}

/** A band laid out on the twelve-column grid; on phones everything stacks in reading order. */
function gridBand(
  bandName: string,
  children: NodeBlueprint[],
  options: { element?: string; top?: number; bottom?: number; styles?: NodeStyles } = {},
): NodeBlueprint {
  const own = options.styles ?? { base: {} };
  return {
    ...band(bandName, children, {
      ...options,
      styles: {
        ...own,
        base: { columnGap: "clamp(1rem, 2vw, 2rem)", rowGap: space(5), ...own.base },
      },
    }),
    placedGrid: { columns: 12, stackOnPhone: true },
  };
}

/** Where an element sits on the grid: columns `column` to `column + span - 1` of row `row`. */
function at(column: number, span: number, row: number, rowSpan = 1): StyleDeclarations {
  return {
    gridColumn: `${column} / span ${span}`,
    gridRow: rowSpan > 1 ? `${row} / span ${rowSpan}` : String(row),
  };
}

function label(words: string, labelName = "Label", styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "text",
    name: labelName,
    props: { text: words },
    styles: { base: { ...smallCaps, color: accent, ...styles } },
  };
}

function title(
  words: string,
  level: number,
  titleName: string,
  styles: StyleDeclarations,
  extras: Pick<NodeBlueprint, "animation"> = {},
): NodeBlueprint {
  return {
    type: "heading",
    name: titleName,
    props: { text: words, level },
    styles: { base: { ...serif, ...styles } },
    ...extras,
  };
}

function words(
  text: string,
  wordsName: string,
  styles: StyleDeclarations = {},
  extras: Pick<NodeBlueprint, "animation" | "styles"> = {},
): NodeBlueprint {
  return {
    type: "text",
    name: wordsName,
    props: { text },
    ...extras,
    styles: {
      ...extras.styles,
      base: { lineHeight: "1.6", marginTop: "0", marginBottom: "0", ...styles },
    },
  };
}

function link(text: string, href: string, styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "link",
    props: { label: text, href, openInNewTab: false },
    styles: {
      base: {
        color: ink,
        textDecoration: `underline ${rule}`,
        width: "fit-content",
        ...styles,
      },
      hover: { textDecoration: `underline ${accent}`, color: accent },
    },
  };
}

/** A button in ink on paper (paper on ink in dark mode), or an outlined one. */
function button(text: string, href: string, look: "solid" | "outline" = "solid"): NodeBlueprint {
  const looks: Record<string, StyleDeclarations> = {
    solid: { backgroundColor: ink, color: paper, borderColor: ink },
    outline: { backgroundColor: "transparent", color: ink, borderColor: ink },
  };
  return {
    type: "button",
    props: { label: text, href, openInNewTab: false },
    styles: {
      base: {
        display: "inline-block",
        width: "fit-content",
        paddingTop: space(3),
        paddingBottom: space(3),
        paddingLeft: space(5),
        paddingRight: space(5),
        borderRadius: "6px",
        borderStyle: "solid",
        borderWidth: "1px",
        fontWeight: "600",
        textDecoration: "none",
        ...looks[look],
      },
      hover: { backgroundColor: accent, borderColor: accent, color: paper },
    },
    animation: animate("press"),
  };
}

function buttons(children: NodeBlueprint[], styles: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "box",
    name: "Buttons",
    styles: {
      base: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: space(3), ...styles },
    },
    children,
  };
}

function drawing(
  name: string,
  alt: string,
  styles: StyleDeclarations,
  extras: Pick<NodeBlueprint, "animation"> = {},
): NodeBlueprint {
  return {
    type: "image",
    name: "Picture",
    props: { src: picture(name), alt, assetId: null, caption: "" },
    styles: {
      base: { width: "100%", height: "auto", borderRadius: "10px", ...styles },
    },
    ...extras,
  };
}

/** The top of an inner page: a label, the page's title and a sentence. */
function pageTop(copy: { label: string; title: string; text: string }): NodeBlueprint {
  return gridBand(
    "Page title",
    [
      { ...label(copy.label), styles: { base: { ...smallCaps, color: accent, ...at(1, 6, 1) } } },
      title(
        copy.title,
        1,
        "Page title",
        { ...at(1, 8, 2), fontSize: "clamp(2.75rem, 6.4vw, 5.75rem)", lineHeight: "1" },
        { animation: animate("words-rise") },
      ),
      words(
        copy.text,
        "Introduction",
        { ...at(1, 6, 3), fontSize: "1.1875rem", color: quiet, maxWidth: "36rem" },
        { animation: animate("fade-in", { delay: 250 }) },
      ),
    ],
    { top: 9, bottom: 6 },
  );
}

/** A closing invitation, the same on every page: the free first half hour. */
function invitation(): NodeBlueprint {
  return gridBand(
    "First meeting",
    [
      title("Your first half hour with us is free.", 2, "Invitation title", {
        ...at(1, 7, 1),
        fontSize: "clamp(2rem, 4vw, 3.5rem)",
        lineHeight: "1.05",
      }),
      words(
        "Tell us what’s happening and we’ll say plainly whether we can help, what it involves and what it will cost. No obligation, and no bill for the conversation.",
        "Invitation text",
        { ...at(8, 5, 1), color: quiet, alignSelf: "end" },
      ),
      {
        ...buttons(
          [
            button("Book a first meeting", "/contact"),
            link(phone, `tel:${phone.replaceAll(" ", "")}`, { alignSelf: "center" }),
          ],
          {
            ...at(8, 5, 2),
            alignItems: "center",
            gap: space(5),
          },
        ),
        animation: animate("fade-up"),
      },
    ],
    {
      top: 8,
      bottom: 8,
      styles: { base: { backgroundColor: panel } },
    },
  );
}

// ——— Shared navigation and footer ———

function navigation(): NodeBlueprint {
  return band(
    "Navigation",
    [
      siteLogo("name", {
        ...serif,
        color: ink,
        textDecoration: "none",
        fontSize: "1.375rem",
        letterSpacing: "-0.005em",
        minHeight: "0",
      }),
      siteMenuRow({ styles: { fontWeight: "500", color: ink, fontSize: "0.9375rem" } }),
      menuDrawer(),
    ],
    {
      element: "header",
      top: 4,
      bottom: 4,
      styles: {
        base: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: space(5),
          borderStyle: "solid",
          borderColor: rule,
          borderWidth: "0 0 1px 0",
        },
        phone: { paddingTop: space(3), paddingBottom: space(3) },
      },
    },
  );
}

function footer(): NodeBlueprint {
  const column = (children: NodeBlueprint[], styles: StyleDeclarations): NodeBlueprint => ({
    type: "box",
    name: "Footer column",
    styles: { base: { display: "flex", flexDirection: "column", gap: space(2), ...styles } },
    children,
  });
  return gridBand(
    "Footer",
    [
      words(firm, "Firm name", {
        ...serif,
        ...at(1, 5, 1),
        fontSize: "clamp(2rem, 3.6vw, 3rem)",
        lineHeight: "1",
      }),
      column(
        [
          label("Visit", "Address title", { color: quiet }),
          words(address, "Address", { whiteSpace: "pre-line" }),
        ],
        at(6, 3, 1),
      ),
      column(
        [
          label("Talk to us", "Contact title", { color: quiet }),
          link(phone, `tel:${phone.replaceAll(" ", "")}`),
          link(email, `mailto:${email}`),
        ],
        at(9, 4, 1),
      ),
      {
        type: "box",
        name: "Small print",
        styles: {
          base: {
            ...at(1, 12, 2),
            ...hairline,
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: space(4),
            paddingTop: space(4),
            marginTop: space(5),
            fontSize: "0.8125rem",
            color: quiet,
          },
        },
        children: [
          words(
            `© 2026 ${firm} LLP, solicitors and chartered accountants. Regulated by the Law Society of Scotland and ICAS.`,
            "Regulation",
            { maxWidth: "44rem" },
          ),
          {
            type: "cookieSettings",
            styles: {
              base: { color: quiet, textDecoration: "underline", width: "fit-content" },
              hover: { color: accent },
            },
          },
        ],
      },
    ],
    {
      element: "footer",
      top: 8,
      bottom: 5,
      styles: { base: { ...hairline } },
    },
  );
}

// ——— Services, used on the home page and the services page ———

interface Service {
  name: string;
  summary: string;
  picture: string;
  alt: string;
  details: string;
  fees: readonly (readonly [string, string])[];
}

const services: readonly Service[] = [
  {
    name: "Family",
    summary: "Separation, children’s arrangements and agreements before you marry.",
    picture: "chambers-fanlight",
    alt: "Line drawing of a semicircular Georgian fanlight above a door",
    details:
      "When a family changes shape, people need someone calm on their side. We help you reach agreements without going to court where we can, and stand beside you when you have to.",
    fees: [
      ["First meeting, 30 minutes", "Free"],
      ["Separation agreement", "from £1,450"],
      ["Prenuptial agreement", "from £950"],
      ["Court work", "£210 an hour"],
    ],
  },
  {
    name: "Buying and selling a home",
    summary: "Conveyancing from offer to keys, with one solicitor from start to finish.",
    picture: "chambers-key",
    alt: "Line drawing of an old door key with an oxblood leather tag",
    details:
      "We handle the missives, the title, the Land Register and the money on the day, and we tell you what is happening without you having to ask. Quoted at the start, fixed to the end.",
    fees: [
      ["Buying, up to £300,000", "£995"],
      ["Selling, up to £300,000", "£895"],
      ["Remortgage", "£450"],
      ["Home report and marketing", "On request"],
    ],
  },
  {
    name: "Wills, powers of attorney and estates",
    summary: "Getting your affairs in order, and helping families after a death.",
    picture: "chambers-pen",
    alt: "Line drawing of a fountain pen resting across a ruled page of handwriting",
    details:
      "A will and a power of attorney take an afternoon and spare your family months. When someone has died, we can wind up the estate for you, step by step and at a pace that suits you.",
    fees: [
      ["Single will", "£260"],
      ["Mirror wills for a couple", "£420"],
      ["Power of attorney", "£350"],
      ["Winding up an estate", "Quoted in advance"],
    ],
  },
  {
    name: "Accounts for small businesses",
    summary: "Year-end accounts, tax returns and payroll for sole traders and small companies.",
    picture: "chambers-ledger",
    alt: "Line drawing of an open ledger with ruled columns of figures",
    details:
      "Our accountants look after shops, trades, practices and start-ups across Edinburgh and the Lothians. You get a monthly fee, a named accountant and replies within a working day.",
    fees: [
      ["Self-assessment tax return", "£320"],
      ["Sole trader accounts and return", "from £65 a month"],
      ["Limited company accounts", "from £120 a month"],
      ["Payroll, up to ten people", "£40 a month"],
    ],
  },
];

/** One line of the home page's list: number, name and a sentence, with its drawing on hover. */
function serviceRow(service: Service, index: number): NodeBlueprint {
  return {
    type: "box",
    name: "Service",
    props: { element: "article" },
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: "3rem minmax(0, 5fr) minmax(0, 6fr)",
        alignItems: "baseline",
        gap: space(5),
        paddingTop: space(5),
        paddingBottom: space(5),
        ...hairline,
      },
      phone: { gridTemplateColumns: "2rem minmax(0, 1fr)", rowGap: space(2) },
    },
    effects: [
      { effect: "hover-picture", params: { src: picture(service.picture), size: "small" } },
    ],
    children: [
      words(String(index + 1).padStart(2, "0"), "Number", { color: accent, fontWeight: "600" }),
      title(service.name, 3, "Service name", {
        fontSize: "clamp(1.5rem, 2.6vw, 2.25rem)",
        lineHeight: "1.1",
      }),
      words(
        service.summary,
        "Summary",
        { color: quiet },
        { styles: { base: {}, phone: { gridColumn: "2" } } },
      ),
    ],
  };
}

/** One service in full on the services page: name and drawing, then what we do and the fees. */
function serviceDetail(service: Service, index: number): NodeBlueprint {
  return gridBand(
    service.name,
    [
      label(`0${index + 1}`, "Number", at(1, 4, 1)),
      title(
        service.name,
        2,
        "Service name",
        { ...at(1, 4, 2), fontSize: "clamp(1.875rem, 3.2vw, 2.75rem)", lineHeight: "1.05" },
        { animation: animate("fade-up") },
      ),
      drawing(service.picture, service.alt, { ...at(1, 4, 3), maxWidth: "24rem" }),
      words(service.details, "What we do", {
        ...at(6, 7, 1, 2),
        fontSize: "1.1875rem",
        alignSelf: "end",
      }),
      {
        type: "box",
        name: "Fees",
        styles: {
          base: { ...at(6, 7, 3), display: "flex", flexDirection: "column", alignSelf: "start" },
        },
        animation: animate("stagger-up", { stagger: 60 }),
        children: service.fees.map(([item, fee]) => ({
          type: "box",
          name: "Fee",
          styles: {
            base: {
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: space(3),
              paddingTop: space(3),
              paddingBottom: space(3),
              ...hairline,
            },
          },
          children: [words(item, "Item"), words(fee, "Price", { fontWeight: "600" })],
        })),
      },
    ],
    { top: 7, bottom: 7, styles: { base: { ...hairline } } },
  );
}

// ——— The team ———

interface Person {
  name: string;
  initials: string;
  role: string;
  about: string;
}

const people: readonly Person[] = [
  {
    name: "Catriona Moray",
    initials: "CM",
    role: "Partner, family law",
    about:
      "Founded the firm with Alasdair in 1987. Accredited family law specialist and trained mediator.",
  },
  {
    name: "Alasdair Lindsay",
    initials: "AL",
    role: "Partner, property",
    about:
      "Has bought and sold more New Town flats than he can count, and still reads every title.",
  },
  {
    name: "Priya Sandhu",
    initials: "PS",
    role: "Chartered accountant, ICAS",
    about: "Looks after our small-business clients, from Leith cafés to an Inverleith architects.",
  },
  {
    name: "Euan Forsyth",
    initials: "EF",
    role: "Solicitor, wills and estates",
    about: "Patient with paperwork and with people. Visits clients at home when they can’t travel.",
  },
  {
    name: "Marta Kowalska",
    initials: "MK",
    role: "Accountant, payroll and tax",
    about: "Runs payroll for forty local employers and answers the tax questions nobody else will.",
  },
  {
    name: "Iona Baird",
    initials: "IB",
    role: "Office manager",
    about:
      "The first voice you’ll hear on the phone, and the person who knows where everything is.",
  },
];

function personCard(person: Person): NodeBlueprint {
  return {
    type: "box",
    name: person.name,
    props: { element: "article" },
    styles: {
      base: {
        display: "flex",
        flexDirection: "column",
        gap: space(2),
        paddingTop: space(5),
        ...hairline,
      },
    },
    children: [
      {
        type: "text",
        name: "Initials",
        props: { text: person.initials },
        styles: {
          base: {
            ...serif,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "4.5rem",
            height: "4.5rem",
            borderRadius: "999px",
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: accent,
            color: accent,
            fontSize: "1.5rem",
            marginBottom: space(3),
          },
        },
      },
      title(person.name, 2, "Name", { fontSize: "1.625rem", lineHeight: "1.15" }),
      words(person.role, "Role", { ...smallCaps, color: quiet }),
      words(person.about, "About", { color: quiet }),
    ],
  };
}

// ——— Pages ———

const homePage: StarterPage = {
  slug: "home",
  title: "Home",
  summary: `${firm}: solicitors and accountants in Edinburgh’s New Town since 1987.`,
  sections: [
    gridBand(
      "Introduction",
      [
        label("Solicitors and accountants, Edinburgh New Town", "Label", at(1, 7, 1)),
        title(
          "Clear advice for the things that matter at home and at work.",
          1,
          "Main title",
          {
            ...at(1, 7, 2),
            fontSize: "clamp(2.75rem, 6vw, 5.5rem)",
            lineHeight: "1",
            letterSpacing: "-0.01em",
          },
          { animation: animate("words-rise") },
        ),
        words(
          "We are eleven solicitors and accountants in a townhouse on Abercromby Place. For nearly forty years we have helped Edinburgh families and small businesses with moves, wills, separations and accounts, at fees agreed before we start.",
          "About in a line",
          { ...at(1, 6, 3), fontSize: "1.1875rem", color: quiet, maxWidth: "36rem" },
          { animation: animate("fade-in", { delay: 300 }) },
        ),
        buttons(
          [
            button("Book a first meeting", "/contact"),
            button("Services and fees", "/services", "outline"),
          ],
          at(1, 6, 4),
        ),
        drawing(
          "chambers-doorway",
          "Line drawing of the firm’s Georgian front door, painted oxblood under a fanlight",
          { ...at(9, 4, 1, 4), alignSelf: "end" },
          { animation: animate("mask-reveal-up", { delay: 150 }) },
        ),
      ],
      { top: 8, bottom: 9 },
    ),
    gridBand(
      "What we help with",
      [
        label("What we help with", "Label", at(1, 4, 1)),
        title("Four kinds of work, each done carefully.", 2, "Section title", {
          ...at(1, 7, 2),
          fontSize: "clamp(2rem, 3.8vw, 3.25rem)",
          lineHeight: "1.05",
        }),
        {
          type: "box",
          name: "Service list",
          styles: {
            base: {
              ...at(1, 12, 3),
              display: "flex",
              flexDirection: "column",
              borderStyle: "solid",
              borderColor: rule,
              borderWidth: "0 0 1px 0",
              marginTop: space(4),
            },
          },
          animation: animate("stagger-up", { stagger: 80 }),
          children: services.map(serviceRow),
        },
        link("Every service, with its fees", "/services", { ...at(1, 6, 4), fontWeight: "600" }),
      ],
      { top: 7, bottom: 9 },
    ),
    gridBand(
      "How we work",
      [
        drawing(
          "chambers-desk",
          "Line drawing of a desk with a lamp, a stack of papers and a cup of tea",
          { ...at(1, 5, 1, 3), alignSelf: "center" },
          { animation: animate("fade-in") },
        ),
        label("How we work", "Label", at(7, 6, 1)),
        title("Fixed fees, plain letters and one person who knows your file.", 2, "Section title", {
          ...at(7, 6, 2),
          fontSize: "clamp(1.875rem, 3.4vw, 3rem)",
          lineHeight: "1.1",
        }),
        {
          type: "box",
          name: "Promises",
          styles: {
            base: { ...at(7, 6, 3), display: "flex", flexDirection: "column", gap: space(4) },
          },
          animation: animate("stagger-up", { stagger: 80 }),
          children: [
            ["You know the cost first.", "We put the fee in writing before any work starts."],
            ["You hear from us.", "A short update every week, even when the news is “no news”."],
            ["You see the same face.", "One solicitor or accountant stays with you throughout."],
          ].map(([heading = "", text = ""]) => ({
            type: "box",
            name: "Promise",
            styles: {
              base: { display: "flex", flexDirection: "column", gap: space(1), ...hairline },
            },
            children: [
              title(heading, 3, "Promise title", {
                fontSize: "1.375rem",
                paddingTop: space(3),
              }),
              words(text, "Promise text", { color: quiet }),
            ],
          })),
        },
      ],
      { top: 8, bottom: 9, styles: { base: { ...hairline } } },
    ),
    gridBand(
      "Client's words",
      [
        {
          type: "quote",
          name: "Quote",
          props: {
            text: "Euan explained my mother’s estate in a single letter I could actually follow, then quietly took care of all of it.",
            citation: "Fiona R., Morningside",
          },
          styles: {
            base: {
              ...at(2, 10, 1),
              ...serif,
              fontSize: "clamp(1.625rem, 3.2vw, 2.625rem)",
              lineHeight: "1.25",
              color: ink,
            },
          },
          animation: animate("fade-up"),
        },
      ],
      { top: 8, bottom: 9 },
    ),
    invitation(),
  ],
};

const servicesPage: StarterPage = {
  slug: "services",
  title: "Services and fees",
  summary: "Family law, conveyancing, wills and estates, and small-business accounts, with fees.",
  sections: [
    pageTop({
      label: "Services and fees",
      title: "What we help with, and what it costs.",
      text: "Our usual fees are below, including VAT. If your matter is unusual we’ll quote it in writing before we start, and that is the price you pay.",
    }),
    ...services.map(serviceDetail),
    invitation(),
  ],
};

const teamPage: StarterPage = {
  slug: "team",
  title: "Our people",
  summary: `The solicitors, accountants and office team at ${firm}.`,
  sections: [
    pageTop({
      label: "Our people",
      title: "The people you’ll deal with.",
      text: "A small firm on purpose. You’ll meet the person handling your matter at the first meeting, and they’ll stay with you until it’s done.",
    }),
    band(
      "Team",
      [
        {
          type: "columns",
          name: "People",
          styles: {
            base: {
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              columnGap: "clamp(1rem, 3vw, 3rem)",
              rowGap: space(7),
            },
            tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
            phone: { gridTemplateColumns: "minmax(0, 1fr)", rowGap: space(6) },
          },
          animation: animate("stagger-up", { stagger: 70 }),
          children: people.map(personCard),
        },
      ],
      { top: 4, bottom: 9 },
    ),
    invitation(),
  ],
};

const contactPage: StarterPage = {
  slug: "contact",
  title: "Contact",
  summary: `How to reach ${firm}: address, opening hours, phone and email.`,
  sections: [
    gridBand(
      "Contact",
      [
        label("Contact", "Label", at(1, 5, 1)),
        title(
          "Come and see us, or send a note.",
          1,
          "Page title",
          { ...at(1, 7, 2), fontSize: "clamp(2.5rem, 5.4vw, 4.75rem)", lineHeight: "1" },
          { animation: animate("words-rise") },
        ),
        words(
          "Call, write or drop in. We reply to every message within one working day.",
          "How to write",
          { ...at(1, 5, 3), color: quiet, fontSize: "1.125rem" },
        ),
        {
          type: "box",
          name: "Details",
          styles: {
            base: {
              ...at(1, 6, 4),
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: space(5),
              marginTop: space(4),
            },
            phone: { gridTemplateColumns: "minmax(0, 1fr)" },
          },
          children: [
            ["Address", address],
            ["Opening hours", "Monday to Friday, 9am to 5.30pm\nEvening meetings by arrangement"],
          ]
            .map(([heading = "", text = ""]) => ({
              type: "box",
              name: heading,
              styles: {
                base: { display: "flex", flexDirection: "column", gap: space(2), ...hairline },
              },
              children: [
                title(heading, 2, "Detail title", { fontSize: "1.25rem", paddingTop: space(3) }),
                words(text, heading, { whiteSpace: "pre-line", color: quiet }),
              ],
            }))
            .concat({
              type: "box",
              name: "Phone and email",
              styles: {
                base: { display: "flex", flexDirection: "column", gap: space(2), ...hairline },
              },
              children: [
                title("Phone and email", 2, "Detail title", {
                  fontSize: "1.25rem",
                  paddingTop: space(3),
                }),
                link(phone, `tel:${phone.replaceAll(" ", "")}`),
                link(email, `mailto:${email}`),
              ],
            }),
        },
        drawing(
          "chambers-fanlight",
          "Line drawing of the fanlight above the firm’s front door",
          { ...at(8, 5, 1, 4), alignSelf: "center" },
          { animation: animate("mask-reveal-up") },
        ),
      ],
      { top: 8, bottom: 8 },
    ),
    // Its own band, so the page keeps everything else when the site has Forms switched off.
    gridBand(
      "Send us a note",
      [
        title("Send us a note", 2, "Form title", {
          ...at(1, 4, 1),
          fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
        }),
        words(
          "Tell us briefly what it’s about and how best to reach you. We never share what you send.",
          "Form note",
          { ...at(1, 4, 2), color: quiet },
        ),
        {
          type: "box",
          name: "Form",
          styles: {
            base: {
              ...at(6, 7, 1, 3),
              backgroundColor: panel,
              borderRadius: "10px",
              paddingTop: space(6),
              paddingBottom: space(6),
              paddingLeft: space(6),
              paddingRight: space(6),
            },
            phone: { paddingLeft: space(5), paddingRight: space(5) },
          },
          animation: animate("fade-up", { delay: 150 }),
          children: [
            {
              type: "formEmbed",
              name: "Contact form",
              props: { form: "contact", showTitle: false },
            },
          ],
        },
      ],
      { top: 7, bottom: 7, styles: { base: { ...hairline } } },
    ),
    gridBand(
      "Getting here",
      [
        title("Getting here", 2, "Section title", {
          ...at(1, 5, 1),
          fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
        }),
        words(
          "We’re on the north side of Queen Street Gardens, five minutes’ walk from Princes Street. The 23 and 27 buses stop at the end of the street. There’s pay-and-display parking outside, and a ramp and a ground-floor meeting room if you’d rather not take the stairs.",
          "Directions",
          { ...at(6, 7, 1), color: quiet, fontSize: "1.125rem" },
        ),
      ],
      { top: 7, bottom: 9, styles: { base: { ...hairline } } },
    ),
  ],
};

export const chambersSite: StarterSite = {
  id: "chambers",
  name: "Chambers",
  description:
    "A calm, trustworthy site for a professional practice: services with plain fees, the people behind them and an easy way to get in touch.",
  suitedTo: "Solicitors, accountants, surveyors and other professional practices",
  coverIllustration: "chambers-cover",
  theme: {
    brandColour: "#1f3a32",
    accentColour: "#7a2e2a",
    fontPairing: "classic",
    cornerStyle: "soft",
    headingFont: "DM Serif Display",
    bodyFont: "DM Sans",
  },
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "none" },
    pageTransition: { style: "fade", duration: 300 },
    intro: { style: "none" },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  pages: [homePage, servicesPage, teamPage, contactPage],
};
