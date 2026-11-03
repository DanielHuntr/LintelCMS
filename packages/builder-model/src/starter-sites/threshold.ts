import type { NodeBlueprint } from "../components/component-definition.js";
import type { NodeStyles, StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import { menuDrawer, siteLogo, siteMenuRow } from "../sections/site-navigation.js";
import type { StarterCollection, StarterPage, StarterSite } from "./starter-site.js";

/**
 * Threshold: the site of an independent estate and letting agent in Bath. Warm limestone
 * and dark ink, Fraunces for the headings and Manrope for everything else, soft corners and
 * one terracotta accent (the colour of the front doors in the drawings).
 *
 * The homes for sale and to let are a collection (Listings), so the agent adds and removes
 * homes in Content and every list of homes follows. The home page shows the first three;
 * the Homes page shows them all.
 */

// Colours follow the visitor's light or dark setting (CSS light-dark), so they are set here.
const paper = "light-dark(#f4efe6, #181613)";
const panel = "light-dark(#ebe3d5, #221f1b)";
const ink = "light-dark(#2a241d, #efe8dc)";
const quiet = "light-dark(#5f574c, #b5ab9b)";
const rule = "light-dark(#d6cbb8, #3a342d)";
/** Terracotta: 5.6:1 on the paper in light mode, 6.9:1 on the dark paper. */
const terracotta = "light-dark(#a3442a, #e8906f)";
const onTerracotta = "light-dark(#fbf7f0, #181613)";
const serif = "var(--lintel-font-heading)";

const phone = "01632 960 418";
const phoneLink = "tel:+441632960418";
const email = "hello@threshold.example";

const picture = (name: string) => `/_lintel/illustrations/${name}.svg`;

/** Small, spaced capitals for labels above titles and the kind of listing. */
const small: StyleDeclarations = {
  fontSize: "0.75rem",
  fontWeight: "700",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  lineHeight: "1.4",
};

const noMargin: StyleDeclarations = { marginTop: "0", marginBottom: "0" };

/** A band of the page with the same side margins everywhere. */
function band(
  bandName: string,
  children: NodeBlueprint[],
  options: {
    tone?: "paper" | "panel" | "accent";
    top?: number;
    bottom?: number;
    element?: string;
    anchor?: string;
    styles?: NodeStyles;
  } = {},
): NodeBlueprint {
  const top = options.top ?? 9;
  const bottom = options.bottom ?? 9;
  const tones: Record<string, StyleDeclarations> = {
    paper: { backgroundColor: paper, color: ink },
    panel: { backgroundColor: panel, color: ink },
    accent: { backgroundColor: terracotta, color: onTerracotta },
  };
  return {
    type: "section",
    name: bandName,
    props: { element: options.element ?? "section", anchor: options.anchor ?? "" },
    styles: {
      ...options.styles,
      base: {
        ...tones[options.tone ?? "paper"],
        paddingTop: space(top),
        paddingBottom: space(bottom),
        paddingLeft: "clamp(1.25rem, 4vw, 3.5rem)",
        paddingRight: "clamp(1.25rem, 4vw, 3.5rem)",
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

/** A band laid out on twelve columns; on phones it goes back to one thing under another. */
function gridBand(
  bandName: string,
  children: NodeBlueprint[],
  options: Parameters<typeof band>[2] = {},
): NodeBlueprint {
  return {
    ...band(bandName, children, {
      ...options,
      styles: {
        ...options.styles,
        base: { columnGap: "clamp(1rem, 2vw, 2rem)", rowGap: space(5), ...options.styles?.base },
      },
    }),
    placedGrid: { columns: 12, stackOnPhone: true },
  };
}

/** Where an element sits on the grid: columns `column` to `column + span - 1`, row `row`. */
function at(column: number, span: number, row: number, extra: StyleDeclarations = {}): NodeStyles {
  return { base: { gridColumn: `${column} / span ${span}`, gridRow: String(row), ...extra } };
}

function withStyles(blueprint: NodeBlueprint, styles: NodeStyles): NodeBlueprint {
  const own = blueprint.styles ?? { base: {} };
  return {
    ...blueprint,
    styles: {
      ...own,
      ...styles,
      base: { ...own.base, ...styles.base },
      ...(own.phone || styles.phone ? { phone: { ...own.phone, ...styles.phone } } : {}),
    },
  };
}

function label(words: string, colour = terracotta, labelName = "Label"): NodeBlueprint {
  return {
    type: "text",
    name: labelName,
    props: { text: words },
    styles: { base: { ...small, ...noMargin, color: colour } },
  };
}

function words(wordsName: string, text: string, extra: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "text",
    name: wordsName,
    props: { text },
    styles: { base: { ...noMargin, lineHeight: "1.6", ...extra } },
  };
}

function title(
  titleName: string,
  text: string,
  level: number,
  extra: StyleDeclarations = {},
): NodeBlueprint {
  return {
    type: "heading",
    name: titleName,
    props: { text, level },
    styles: {
      base: {
        ...noMargin,
        fontFamily: serif,
        fontWeight: "400",
        lineHeight: "1.1",
        letterSpacing: "-0.015em",
        ...extra,
      },
    },
  };
}

function textLink(text: string, href: string, extra: StyleDeclarations = {}): NodeBlueprint {
  return {
    type: "link",
    props: { label: text, href, openInNewTab: false },
    styles: {
      base: {
        color: "inherit",
        textDecoration: "underline",
        ...extra,
      },
      hover: { color: terracotta },
    },
  };
}

function action(
  text: string,
  href: string,
  look: "solid" | "outline" | "inverse" = "solid",
): NodeBlueprint {
  const looks: Record<string, StyleDeclarations> = {
    solid: { backgroundColor: terracotta, color: onTerracotta },
    outline: {
      backgroundColor: "transparent",
      color: "inherit",
      borderStyle: "solid",
      borderWidth: "1px",
      borderColor: "currentColor",
    },
    inverse: { backgroundColor: onTerracotta, color: terracotta },
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
        borderRadius: "0.5rem",
        fontWeight: "600",
        textDecoration: "none",
        ...looks[look],
      },
      hover: { opacity: "0.88" },
    },
    animation: animate("press"),
  };
}

function row(rowName: string, children: NodeBlueprint[], extra: StyleDeclarations = {}) {
  return {
    type: "box",
    name: rowName,
    styles: {
      base: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: space(3),
        ...extra,
      },
    },
    children,
  } satisfies NodeBlueprint;
}

function drawing(
  drawingName: string,
  name: string,
  alt: string,
  ratio = "4 / 3",
  extra: StyleDeclarations = {},
): NodeBlueprint {
  return {
    type: "image",
    name: drawingName,
    props: { src: picture(name), alt, assetId: null, caption: "" },
    styles: {
      base: {
        width: "100%",
        height: "auto",
        aspectRatio: ratio,
        objectFit: "cover",
        borderRadius: "0.75rem",
        ...extra,
      },
    },
  };
}

// ---------------------------------------------------------------------------------------
// The listings collection

/** Homes for sale and to let. Each has no page of its own; the lists show everything. */
export const listingsCollection: StarterCollection = {
  handle: "listings",
  name: "Listings",
  itemName: "Listing",
  fields: [
    { handle: "kind", label: "For sale or to let", type: "text", helpText: "For sale, or To let" },
    { handle: "area", label: "Area", type: "text", helpText: "The neighbourhood, like Widcombe" },
    {
      handle: "price",
      label: "Price",
      type: "text",
      helpText: "The asking price, or the rent a month",
    },
    {
      handle: "rooms",
      label: "Rooms",
      type: "text",
      helpText: "In short: 3 bedrooms · 2 bathrooms · garden",
    },
    { handle: "summary", label: "Summary", type: "textarea", helpText: "Two or three sentences" },
    {
      handle: "picture",
      label: "Picture address",
      type: "text",
      helpText: "The address of a picture of the home",
    },
    {
      handle: "picture_alt",
      label: "What the picture shows",
      type: "text",
      helpText: "For people who can't see it",
    },
  ],
  entries: [
    {
      title: "Raby Row",
      slug: "raby-row",
      data: {
        kind: "For sale",
        area: "Widcombe",
        price: "£865,000",
        rooms: "4 bedrooms · 2 bathrooms · walled garden",
        summary:
          "A Georgian townhouse two minutes from the canal, with its original shutters, a kitchen in the old scullery and a garden that gets the evening sun.",
        picture: picture("threshold-terrace"),
        picture_alt:
          "Drawing of a three-storey stone townhouse with tall sash windows and a terracotta front door",
      },
    },
    {
      title: "Quarry Cottage",
      slug: "quarry-cottage",
      data: {
        kind: "For sale",
        area: "Combe Down",
        price: "£540,000",
        rooms: "2 bedrooms · 1 bathroom · garden and parking",
        summary:
          "Built for a stonemason in 1820 and kept simply since: low ceilings, a wood burner and a lane that ends at the woods.",
        picture: picture("threshold-cottage"),
        picture_alt:
          "Drawing of a small stone cottage with a chimney, a red door and a low garden wall",
      },
    },
    {
      title: "Hollis Mews",
      slug: "hollis-mews",
      data: {
        kind: "To let",
        area: "Lansdown",
        price: "£2,150 a month",
        rooms: "3 bedrooms · 2 bathrooms · garage",
        summary:
          "A converted coach house behind the crescent, unfurnished, with a big garage and a quiet courtyard. Free from April.",
        picture: picture("threshold-mews"),
        picture_alt:
          "Drawing of a two-storey mews house with a large arched carriage door on a cobbled lane",
      },
    },
    {
      title: "Second floor, Orchard Place",
      slug: "orchard-place",
      data: {
        kind: "To let",
        area: "City centre",
        price: "£1,375 a month",
        rooms: "1 bedroom · 1 bathroom · furnished",
        summary:
          "One big room with three tall windows, a galley kitchen and a bedroom at the back, away from the street. Bills not included.",
        picture: picture("threshold-flat"),
        picture_alt:
          "Drawing of a high-ceilinged room with a tall sash window, an armchair and a floor lamp",
      },
    },
    {
      title: "The Laurels",
      slug: "the-laurels",
      data: {
        kind: "For sale",
        area: "Weston",
        price: "£1,150,000",
        rooms: "5 bedrooms · 3 bathrooms · half an acre",
        summary:
          "A Victorian villa set back from the road, with bay windows on both floors, a kitchen garden and room for a studio at the end of it.",
        picture: picture("threshold-villa"),
        picture_alt:
          "Drawing of a detached stone villa with two bay windows, a hipped roof and a tree on each side",
      },
    },
    {
      title: "The Dye Works",
      slug: "the-dye-works",
      data: {
        kind: "For sale",
        area: "Larkhall",
        price: "£395,000",
        rooms: "2 bedrooms · 1 bathroom · lift",
        summary:
          "A top-floor flat in an old mill, with arched windows on two sides and a shared roof terrace that looks over the valley.",
        picture: picture("threshold-loft"),
        picture_alt:
          "Drawing of a long stone mill with three rows of arched windows under a shallow roof",
      },
    },
  ],
};

/**
 * The homes from Listings, each drawn with this design: its picture, whether it's for sale
 * or to let, where, its name, price and rooms (and on the Homes page a short summary).
 */
function listingList(
  listName: string,
  options: { limit: number; withSummary: boolean },
): NodeBlueprint {
  return {
    type: "collectionList",
    name: listName,
    props: {
      collection: listingsCollection.handle,
      term: "",
      sort: "manual",
      limit: options.limit,
      paginate: false,
      columns: 3,
      tabletColumns: 2,
      phoneColumns: 1,
      emptyText: "No homes on the market just now. Call us to hear about new ones first.",
      skipCurrent: false,
    },
    styles: { base: { columnGap: space(6), rowGap: space(8) } },
    animation: animate("stagger-up", { stagger: 80 }),
    children: [
      {
        type: "box",
        name: "Listing",
        props: { element: "article" },
        styles: { base: { display: "flex", flexDirection: "column", gap: space(2) } },
        children: [
          {
            ...drawing(
              "Picture",
              "threshold-terrace",
              "Drawing of a three-storey stone townhouse with a terracotta front door",
              "4 / 3",
              { marginBottom: space(2) },
            ),
            bindings: { src: "data.picture", alt: "data.picture_alt" },
          },
          row(
            "Kind and area",
            [
              { ...label("For sale"), name: "Kind", bindings: { text: "data.kind" } },
              {
                ...label("Widcombe", quiet),
                name: "Area",
                bindings: { text: "data.area" },
              },
            ],
            { gap: space(3) },
          ),
          {
            ...title("Name", "Raby Row", 3, { fontSize: "1.5rem" }),
            bindings: { text: "title" },
          },
          {
            ...words("Price", "£865,000", { fontFamily: serif, fontSize: "1.25rem" }),
            bindings: { text: "data.price" },
          },
          {
            ...words("Rooms", "4 bedrooms · 2 bathrooms · walled garden", {
              color: quiet,
              fontSize: "0.9375rem",
            }),
            bindings: { text: "data.rooms" },
          },
          ...(options.withSummary
            ? [
                {
                  ...words(
                    "Summary",
                    "A Georgian townhouse two minutes from the canal, with its original shutters.",
                    { marginTop: space(2) },
                  ),
                  bindings: { text: "data.summary" },
                },
              ]
            : []),
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------
// The navigation and footer, on every page

function thresholdNavigation(): NodeBlueprint {
  return band(
    "Navigation",
    [
      siteLogo("name", {
        fontFamily: serif,
        fontSize: "1.5rem",
        fontWeight: "400",
        letterSpacing: "-0.02em",
        color: ink,
        textDecoration: "none",
      }),
      row(
        "Menu and button",
        [
          siteMenuRow({ styles: { fontWeight: "500", color: ink } }),
          {
            ...action("Book a valuation", "/valuation"),
            name: "Valuation button",
            styles: {
              base: {
                display: "inline-block",
                paddingTop: space(2),
                paddingBottom: space(2),
                paddingLeft: space(4),
                paddingRight: space(4),
                borderRadius: "0.5rem",
                fontWeight: "600",
                textDecoration: "none",
                backgroundColor: terracotta,
                color: onTerracotta,
              },
              hover: { opacity: "0.88" },
              phone: { display: "none" },
            },
          },
          menuDrawer(),
        ],
        { gap: space(6) },
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

function thresholdFooter(): NodeBlueprint {
  return gridBand(
    "Footer",
    [
      withStyles(
        words("Agency name", "Threshold", {
          fontFamily: serif,
          fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
          lineHeight: "1",
          letterSpacing: "-0.03em",
        }),
        at(1, 5, 1),
      ),
      withStyles(
        words("Office", "The office\n14 Abbey Green\nBath BA1\nMonday to Saturday, 9 till 5.30", {
          whiteSpace: "pre-line",
          color: quiet,
        }),
        at(6, 3, 1),
      ),
      {
        type: "box",
        name: "Ways to get in touch",
        styles: at(9, 4, 1, { display: "flex", flexDirection: "column", gap: space(2) }),
        children: [
          textLink(phone, phoneLink, { textDecoration: "none", fontSize: "1.125rem" }),
          textLink(email, `mailto:${email}`, { textDecoration: "none", fontSize: "1.125rem" }),
          textLink("Book a valuation", "/valuation"),
        ],
      },
      withStyles(
        row(
          "Small print",
          [
            words(
              "Legal",
              "© 2026 Threshold Homes Ltd. Registered in England and Wales. Client money is protected and we belong to an approved redress scheme; details on request.",
              { color: quiet, fontSize: "0.8125rem" },
            ),
            // Shows only once the site asks visitors about cookies.
            {
              type: "cookieSettings",
              styles: {
                base: { color: quiet, fontSize: "0.8125rem", textDecoration: "underline" },
                hover: { color: terracotta },
              },
            },
          ],
          {
            justifyContent: "space-between",
            paddingTop: space(5),
            borderStyle: "solid",
            borderColor: rule,
            borderWidth: "1px 0 0 0",
          },
        ),
        at(1, 12, 2, { marginTop: space(6) }),
      ),
    ],
    {
      element: "footer",
      tone: "panel",
      top: 8,
      bottom: 6,
    },
  );
}

// ---------------------------------------------------------------------------------------
// Pages

interface Area {
  name: string;
  anchor: string;
  illustration: string;
  alt: string;
  line: string;
  story: string;
  facts: string[];
}

const areas: readonly Area[] = [
  {
    name: "Widcombe",
    anchor: "widcombe",
    illustration: "threshold-widcombe",
    alt: "Drawing of houses stepping up a hillside above a canal lock with terracotta gates",
    line: "Canal walks and steep streets, ten minutes from the station.",
    story:
      "Widcombe starts at the canal locks and climbs fast. The parade at the bottom has a butcher, two pubs and a bakery that sells out by eleven; above it, terraces give way to big gardens and views back over the city. People move here for the walk to work and stay for the neighbours.",
    facts: [
      "Walk to the centre: 10 minutes",
      "Good for: families, commuters to Bristol and London",
      "Most homes: Georgian terraces and Victorian semis",
      "Typical prices: £450,000 to £950,000",
    ],
  },
  {
    name: "Larkhall",
    anchor: "larkhall",
    illustration: "threshold-larkhall",
    alt: "Drawing of a row of four shopfronts with awnings and flats above them",
    line: "A village square of its own, with a greengrocer and a good deli.",
    story:
      "Larkhall feels like a small town that happens to be in Bath. The square has a greengrocer, a deli, a hardware shop that still cuts keys while you wait and a Saturday market in the summer. The streets around it are quiet, the gardens are long, and the river path is at the bottom of the hill.",
    facts: [
      "Walk to the centre: 25 minutes, or 8 by bus",
      "Good for: first homes, young families",
      "Most homes: stone terraces and converted mills",
      "Typical prices: £320,000 to £650,000",
    ],
  },
  {
    name: "Lansdown",
    anchor: "lansdown",
    illustration: "threshold-lansdown",
    alt: "Drawing of green hills with a curved terrace along the slope and a low sun",
    line: "Crescents, wide views and the racecourse at the top of the hill.",
    story:
      "Lansdown is Bath at its grandest: crescents and squares on the slope, mews houses tucked behind them and open fields at the top. It's a steep walk home, but the views are the best in the city, the primary schools are sought after and the bus runs late.",
    facts: [
      "Walk to the centre: 15 minutes down, 25 back up",
      "Good for: space, views, schools",
      "Most homes: Georgian crescents, mews and flats",
      "Typical prices: £550,000 to £2 million",
    ],
  },
];

/** The top of an inner page: a label, the page's title and a sentence, on the grid. */
function pageTop(copy: { label: string; title: string; text: string }): NodeBlueprint {
  return gridBand(
    "Page title",
    [
      withStyles(label(copy.label), at(1, 4, 1)),
      {
        ...withStyles(
          title("Page title", copy.title, 1, {
            fontSize: "clamp(2.75rem, 7vw, 6rem)",
            lineHeight: "1",
            letterSpacing: "-0.03em",
          }),
          at(1, 9, 2),
        ),
        animation: animate("words-rise"),
      },
      {
        ...withStyles(
          words("Introduction", copy.text, { fontSize: "1.1875rem", maxWidth: "36rem" }),
          at(1, 6, 3),
        ),
        animation: animate("fade-in", { delay: 250 }),
      },
    ],
    { top: 9, bottom: 6 },
  );
}

const homePage: StarterPage = {
  slug: "home",
  title: "Home",
  summary:
    "Threshold: an independent estate and letting agent in Bath. Homes for sale and to let, area guides and free valuations.",
  sections: [
    gridBand(
      "Introduction",
      [
        withStyles(label("Estate and letting agents in Bath since 2009"), at(1, 6, 1)),
        {
          ...withStyles(
            title("Main title", "Homes in Bath, sold and let by people who live here.", 1, {
              fontSize: "clamp(2.75rem, 6.6vw, 6.25rem)",
              lineHeight: "0.98",
              letterSpacing: "-0.035em",
            }),
            at(1, 10, 2),
          ),
          animation: animate("words-rise"),
        },
        {
          ...withStyles(
            words(
              "About in a line",
              "We’re a team of six on Abbey Green. We sell and let around forty homes a year, mostly Georgian, mostly within a mile of the Abbey, and we answer the phone ourselves.",
              { fontSize: "1.1875rem", maxWidth: "34rem" },
            ),
            at(1, 6, 3),
          ),
          animation: animate("fade-up", { delay: 300 }),
        },
        withStyles(
          row("Buttons", [
            action("See homes for sale and to let", "/homes"),
            action("Book a valuation", "/valuation", "outline"),
          ]),
          at(1, 8, 4),
        ),
        {
          ...withStyles(
            drawing(
              "Terrace picture",
              "threshold-crescent",
              "Drawing of a long Georgian terrace of Bath stone, with railings along the pavement and terracotta front doors",
              "16 / 9",
            ),
            at(1, 12, 5, { marginTop: space(6) }),
          ),
          animation: animate("mask-reveal-up"),
        },
      ],
      { top: 8, bottom: 8 },
    ),
    band(
      "New homes",
      [
        row(
          "Title and link",
          [
            title("Section title", "New this month", 2, {
              fontSize: "clamp(2rem, 4vw, 3.25rem)",
            }),
            textLink("All homes for sale and to let", "/homes"),
          ],
          { justifyContent: "space-between", alignItems: "baseline" },
        ),
        listingList("Newest homes", { limit: 3, withSummary: false }),
      ],
      {
        top: 6,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(7) } },
      },
    ),
    gridBand(
      "How we work",
      [
        withStyles(
          title("Section title", "How we work", 2, {
            ...small,
            fontFamily: "inherit",
            letterSpacing: "0.14em",
            color: terracotta,
          }),
          at(1, 3, 1),
        ),
        {
          ...withStyles(
            words(
              "Statement",
              "We take on fewer homes than most agents, so the person who values yours is the one who shows it, answers the phone and sees the sale through.",
              {
                fontFamily: serif,
                fontSize: "clamp(1.625rem, 3.2vw, 2.75rem)",
                lineHeight: "1.2",
                letterSpacing: "-0.02em",
              },
            ),
            at(4, 9, 1),
          ),
          animation: animate("fade-up"),
        },
        ...[
          {
            number: "01",
            heading: "One person, start to finish",
            text: "No hand-offs to a sales progressor you’ve never met. You get one name and one mobile number.",
          },
          {
            number: "02",
            heading: "Prices we can stand behind",
            text: "We’d rather tell you what your home will sell for than what you’d like to hear. Last year our sales agreed within 3% of the asking price.",
          },
          {
            number: "03",
            heading: "Fees in writing, on one page",
            text: "1.2% plus VAT when we sell, nothing if we don’t. Letting fees are on one page too, and nothing is added later.",
          },
        ].map((point, index) =>
          withStyles(
            {
              type: "box",
              name: "Point",
              styles: {
                base: {
                  display: "flex",
                  flexDirection: "column",
                  gap: space(3),
                  paddingTop: space(5),
                  borderStyle: "solid",
                  borderColor: rule,
                  borderWidth: "1px 0 0 0",
                },
              },
              animation: animate("fade-up", { delay: 100 * index }),
              children: [
                label(point.number, quiet, "Number"),
                title("Point title", point.heading, 3, { fontSize: "1.375rem" }),
                words("Point text", point.text, { color: quiet }),
              ],
            },
            at(4 + index * 3, 3, 2, { marginTop: space(6) }),
          ),
        ),
      ],
      { tone: "panel" },
    ),
    band(
      "Living in Bath",
      [
        row(
          "Title and link",
          [
            title("Section title", "Living in Bath", 2, {
              fontSize: "clamp(2rem, 4vw, 3.25rem)",
            }),
            textLink("Read the area guides", "/areas"),
          ],
          { justifyContent: "space-between", alignItems: "baseline" },
        ),
        {
          type: "columns",
          name: "Area guides",
          styles: {
            base: {
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: space(6),
            },
            tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
            phone: { gridTemplateColumns: "minmax(0, 1fr)" },
          },
          effects: [{ effect: "cursor-word", params: { text: "Explore" } }],
          animation: animate("stagger-up", { stagger: 90 }),
          children: areas.map((area) => ({
            type: "box",
            name: area.name,
            props: { element: "article" },
            styles: { base: { display: "flex", flexDirection: "column", gap: space(3) } },
            children: [
              drawing("Picture", area.illustration, area.alt),
              title("Area name", area.name, 3, { fontSize: "1.5rem" }),
              words("Area in a line", area.line, { color: quiet }),
              textLink(`About ${area.name}`, `/areas#${area.anchor}`, { fontWeight: "600" }),
            ],
          })),
        },
      ],
      {
        top: 9,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(7) } },
      },
    ),
    gridBand(
      "Valuation invitation",
      [
        {
          ...withStyles(
            title("Invitation title", "Thinking of selling or letting?", 2, {
              color: "inherit",
              fontSize: "clamp(2.25rem, 5vw, 4.25rem)",
              lineHeight: "1",
              letterSpacing: "-0.03em",
            }),
            at(1, 7, 1),
          ),
          animation: animate("words-rise"),
        },
        withStyles(
          words(
            "Invitation text",
            "We’ll come round, look properly and tell you in writing what your home is worth and what we’d do to sell or let it. It’s free, and there’s no obligation.",
            { fontSize: "1.125rem" },
          ),
          at(8, 5, 1, { alignSelf: "end" }),
        ),
        withStyles(action("Book a valuation", "/valuation", "inverse"), at(8, 5, 2)),
      ],
      { tone: "accent", top: 9, bottom: 9 },
    ),
  ],
};

const homesPage: StarterPage = {
  slug: "homes",
  title: "Homes",
  summary: "Every home Threshold is selling or letting in and around Bath right now.",
  sections: [
    pageTop({
      label: "For sale and to let",
      title: "Homes",
      text: "Every home we’re selling or letting right now. New ones go up here a day before they reach the property websites.",
    }),
    band(
      "All homes",
      [
        title("Section title", "On the market now", 2, {
          ...small,
          fontFamily: "inherit",
          color: quiet,
          paddingTop: space(4),
          borderStyle: "solid",
          borderColor: rule,
          borderWidth: "1px 0 0 0",
        }),
        listingList("Homes list", { limit: 24, withSummary: true }),
      ],
      {
        top: 2,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(6) } },
      },
    ),
    gridBand(
      "Register",
      [
        withStyles(
          title("Register title", "Not seeing the right one?", 2, {
            fontSize: "clamp(1.75rem, 3.4vw, 2.75rem)",
          }),
          at(1, 6, 1),
        ),
        {
          ...withStyles(
            words(
              "Register text",
              "Tell us what you’re looking for and where, and we’ll ring you when something comes up, often before it’s advertised.",
              { fontSize: "1.125rem" },
            ),
            at(7, 6, 1),
          ),
          animation: animate("fade-up"),
        },
        withStyles(
          row("Buttons", [
            action("Email us what you need", `mailto:${email}?subject=Looking%20for%20a%20home`),
            textLink(`Or call ${phone}`, phoneLink),
          ]),
          at(7, 6, 2),
        ),
      ],
      { tone: "panel", top: 8, bottom: 8 },
    ),
  ],
};

const areasPage: StarterPage = {
  slug: "areas",
  title: "Area guides",
  summary: "What it’s like to live in Widcombe, Larkhall and Lansdown, from people who do.",
  sections: [
    pageTop({
      label: "Area guides",
      title: "Where to live in Bath",
      text: "Three neighbourhoods we know street by street: what they’re like on a Tuesday morning, who lives there and what homes cost.",
    }),
    ...areas.map((area, index) => {
      const pictureFirst = index % 2 === 0;
      return gridBand(
        area.name,
        [
          {
            ...withStyles(
              drawing("Picture", area.illustration, area.alt),
              at(pictureFirst ? 1 : 7, 6, 1),
            ),
            animation: animate("mask-reveal-up"),
          },
          {
            type: "box",
            name: "About the area",
            styles: at(pictureFirst ? 8 : 1, 5, 1, {
              display: "flex",
              flexDirection: "column",
              gap: space(4),
              alignSelf: "center",
            }),
            animation: animate("fade-up"),
            children: [
              label(`0${index + 1}`, terracotta, "Number"),
              title("Area name", area.name, 2, {
                fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)",
                lineHeight: "1",
              }),
              words("Story", area.story, { fontSize: "1.0625rem" }),
              {
                type: "list",
                name: "Facts",
                props: { items: area.facts, ordered: false },
                styles: { base: { color: quiet, lineHeight: "1.8", paddingLeft: space(4) } },
              },
            ],
          },
        ],
        {
          anchor: area.anchor,
          tone: index === 1 ? "panel" : "paper",
          top: 8,
          bottom: 8,
        },
      );
    }),
  ],
};

const valuationPage: StarterPage = {
  slug: "valuation",
  title: "Valuation",
  summary: "Book a free valuation of your home in Bath, or arrange a viewing.",
  sections: [
    pageTop({
      label: "Free valuations",
      title: "What is your home worth?",
      text: "A valuation takes about forty minutes at your home. You’ll have our figure in writing within two working days, with the reasons for it.",
    }),
    gridBand(
      "What happens next",
      [
        withStyles(
          title("Section title", "What happens next", 2, {
            fontSize: "clamp(1.75rem, 3.4vw, 2.75rem)",
          }),
          at(1, 4, 1),
        ),
        ...[
          {
            heading: "We visit",
            text: "One of us comes round at a time that suits you, evenings and Saturdays included, and walks through every room with you.",
          },
          {
            heading: "You get it in writing",
            text: "Within two working days: our price, three recent sales nearby that back it up, and what we’d change before the photographs.",
          },
          {
            heading: "You decide",
            text: "No follow-up calls unless you ask for one. If you go with us, we can be on the market within a week.",
          },
        ].map((step, index) => ({
          ...withStyles(
            {
              type: "box",
              name: "Step",
              styles: {
                base: {
                  display: "flex",
                  flexDirection: "column",
                  gap: space(3),
                  paddingTop: space(5),
                  borderStyle: "solid",
                  borderColor: rule,
                  borderWidth: "1px 0 0 0",
                },
              },
              children: [
                words("Step number", String(index + 1), {
                  fontFamily: serif,
                  fontSize: "2.5rem",
                  lineHeight: "1",
                  color: terracotta,
                }),
                title("Step title", step.heading, 3, { fontSize: "1.375rem" }),
                words("Step text", step.text, { color: quiet }),
              ],
            },
            at(1 + index * 4, 4, 2),
          ),
          animation: animate("fade-up", { delay: 100 * index }),
        })),
      ],
      { top: 4, bottom: 8 },
    ),
    gridBand(
      "Ask for a valuation",
      [
        withStyles(
          title("Form title", "Ask for a valuation", 2, {
            fontSize: "clamp(1.75rem, 3.4vw, 2.75rem)",
          }),
          at(1, 5, 1),
        ),
        withStyles(
          words(
            "Form text",
            "Tell us your address and when you’re free. If you’d rather talk first, call the office and ask for Hannah or Tom.",
            { color: quiet },
          ),
          at(1, 5, 2),
        ),
        {
          type: "box",
          name: "Phone and email",
          styles: at(7, 6, 1, {
            display: "flex",
            flexDirection: "column",
            gap: space(2),
            alignSelf: "end",
          }),
          children: [
            textLink(phone, phoneLink, {
              fontFamily: serif,
              fontSize: "clamp(1.75rem, 3.4vw, 2.5rem)",
              textDecoration: "none",
            }),
            textLink(email, `mailto:${email}`),
          ],
        },
      ],
      { tone: "panel", anchor: "book", top: 8, bottom: 6 },
    ),
    // The form needs Forms; without it this band is left out and the phone and email above
    // still do the job.
    band(
      "Valuation form",
      [{ type: "formEmbed", name: "Form", props: { form: "contact", showTitle: false } }],
      {
        tone: "panel",
        top: 0,
        bottom: 8,
        styles: { base: { display: "flex", flexDirection: "column", alignItems: "stretch" } },
      },
    ),
    gridBand(
      "Viewings",
      [
        withStyles(
          title("Viewings title", "Booking a viewing", 2, {
            fontSize: "clamp(1.75rem, 3.4vw, 2.75rem)",
          }),
          at(1, 5, 1),
        ),
        withStyles(
          words(
            "Viewings text",
            "Call or email with the name of the home and two or three times that suit you. We show homes on weekday evenings and all day Saturday, and we’ll always be there to open the door.",
            { fontSize: "1.125rem" },
          ),
          at(6, 6, 1),
        ),
        withStyles(textLink("See the homes", "/homes", { fontWeight: "600" }), at(6, 6, 2)),
      ],
      { anchor: "viewings", top: 8, bottom: 9 },
    ),
  ],
};

export const thresholdSite: StarterSite = {
  id: "threshold",
  name: "Threshold",
  description:
    "A calm site for an estate or letting agent: homes for sale and to let from a collection, area guides and a valuation request.",
  suitedTo: "Estate agents, letting agents and property managers",
  coverIllustration: "threshold-cover",
  theme: {
    brandColour: "#a3442a",
    accentColour: "#2a241d",
    fontPairing: "classic",
    cornerStyle: "soft",
    headingFont: "Fraunces",
    bodyFont: "Manrope",
  },
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "dot", colour: "brand", size: 10 },
    pageTransition: { style: "zoom", duration: 450 },
    intro: { style: "none" },
  },
  siteSections: { navigation: thresholdNavigation(), footer: thresholdFooter() },
  collections: [listingsCollection],
  pages: [homePage, homesPage, areasPage, valuationPage],
};
