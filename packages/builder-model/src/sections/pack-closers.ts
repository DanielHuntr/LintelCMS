import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import {
  animate,
  button,
  colour,
  container,
  eyebrow,
  heading,
  illustration,
  lead,
  link,
  list,
  radius,
  section,
  space,
  stack,
  text,
} from "./section-parts.js";
import { siteLogo, siteMenuRow } from "./site-navigation.js";

/**
 * More sections for proof, prices, questions, contact and the end of the page: names you've
 * worked with, a wall of short quotes, a big quote with a portrait, numbers on a band and
 * numbers that count up, a single plan and a plan comparison, questions that open and
 * questions in two columns, contact with a map or beside a form, and three footers. Theme
 * tokens only, so light and dark follow the site; everything stacks on phones.
 */

const tight: StyleDeclarations = { marginTop: "0", marginBottom: "0" };
const quiet: StyleDeclarations = { color: colour("text-secondary") };
const hairline: StyleDeclarations = {
  borderStyle: "solid",
  borderWidth: "1px 0 0 0",
  borderColor: colour("border"),
};

function title(words: string, extra: StyleDeclarations = {}): NodeBlueprint {
  return heading(words, 2, { styles: { base: { ...tight, ...extra } } });
}

function row(
  name: string,
  children: NodeBlueprint[],
  styles: StyleDeclarations = {},
  phone: StyleDeclarations = {},
): NodeBlueprint {
  return {
    type: "box",
    name,
    styles: {
      base: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: space(5),
        ...styles,
      },
      ...(Object.keys(phone).length > 0 ? { phone } : {}),
    },
    children,
  };
}

/** The names of people you've worked with, set as quiet wordmarks in a row. */
export function nameRow(copy: { label: string; names: string[] }): NodeBlueprint {
  return section(
    "Names row",
    [
      container(
        [
          text(copy.label, {
            name: "Label",
            styles: { base: { ...quiet, fontSize: "0.875rem" } },
          }),
          {
            ...row(
              "Names",
              copy.names.map((name) =>
                text(name, {
                  name: "Name",
                  styles: {
                    base: {
                      fontFamily: "var(--lintel-font-heading)",
                      fontSize: "1.5rem",
                      fontWeight: "700",
                      letterSpacing: "-0.02em",
                      opacity: "0.6",
                    },
                  },
                }),
              ),
              { justifyContent: "center", columnGap: space(7), rowGap: space(3) },
              { columnGap: space(5) },
            ),
            animation: animate("fade-in"),
          },
        ],
        { centred: true, gap: 4 },
      ),
    ],
    { padding: 6 },
  );
}

/** Names drifting slowly across the page, for many clients or partners. */
export function scrollingNames(copy: { label: string; names: string[] }): NodeBlueprint {
  return section(
    "Scrolling names",
    [
      container(
        [
          text(copy.label, { name: "Label", styles: { base: { ...quiet, fontSize: "0.875rem" } } }),
          {
            type: "marquee",
            name: "Names",
            props: { items: copy.names, speed: "slow", direction: "left" },
            styles: {
              base: {
                fontFamily: "var(--lintel-font-heading)",
                fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
                fontWeight: "700",
                letterSpacing: "-0.02em",
              },
            },
          },
        ],
        { width: "100%", centred: true, gap: 4 },
      ),
    ],
    { padding: 6 },
  );
}

/** Many short quotes in three uneven columns, like notes pinned to a wall. */
export function quoteWall(copy: {
  heading: string;
  quotes: Array<{ words: string; name: string }>;
}): NodeBlueprint {
  const columns = [0, 1, 2].map((column) => copy.quotes.filter((_, index) => index % 3 === column));
  return section("Quote wall", [
    container([
      title(copy.heading),
      {
        type: "columns",
        name: "Wall",
        styles: {
          base: {
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: space(4),
            alignItems: "start",
          },
          tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
          phone: { gridTemplateColumns: "minmax(0, 1fr)" },
        },
        animation: animate("stagger-up"),
        children: columns.map((quotes) =>
          stack(
            "Column",
            quotes.map((quote) => ({
              type: "box",
              name: "Quote",
              props: { element: "article" },
              styles: {
                base: {
                  display: "flex",
                  flexDirection: "column",
                  gap: space(3),
                  marginTop: "0",
                  marginBottom: "0",
                  marginLeft: "0",
                  marginRight: "0",
                  paddingTop: space(5),
                  paddingBottom: space(5),
                  paddingLeft: space(5),
                  paddingRight: space(5),
                  borderRadius: radius("large"),
                  backgroundColor: colour("surface"),
                },
              },
              children: [
                text(`“${quote.words}”`, {
                  name: "Words",
                  styles: { base: { fontSize: "1.0625rem", lineHeight: "1.5" } },
                }),
                text(quote.name, {
                  name: "Name",
                  styles: { base: { ...quiet, fontSize: "0.875rem" } },
                }),
              ],
            })),
            4,
          ),
        ),
      },
    ]),
  ]);
}

/** One long quote, big, beside a portrait of the person who said it. */
export function portraitQuote(copy: {
  words: string;
  name: string;
  role: string;
  picture: { name: string; alt: string };
}): NodeBlueprint {
  return section("Quote with portrait", [
    container([
      {
        type: "columns",
        name: "Two halves",
        styles: {
          base: {
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
            gap: space(8),
            alignItems: "center",
          },
          phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
        },
        children: [
          illustration(copy.picture.name, copy.picture.alt, {
            name: "Portrait",
            styles: {
              base: {
                width: "100%",
                height: "auto",
                aspectRatio: "4 / 5",
                objectFit: "cover",
                borderRadius: radius("large"),
              },
              phone: { maxWidth: "14rem" },
            },
            animation: animate("fade-in"),
          }),
          stack(
            "Quote",
            [
              {
                type: "quote",
                name: "Words",
                props: { text: copy.words, citation: "" },
                styles: {
                  base: {
                    fontFamily: "var(--lintel-font-heading)",
                    fontSize: "clamp(1.5rem, 3.2vw, 2.5rem)",
                    lineHeight: "1.2",
                    letterSpacing: "-0.01em",
                  },
                },
                animation: animate("words-rise"),
              },
              stack(
                "Who said it",
                [
                  text(copy.name, {
                    name: "Name",
                    styles: { base: { fontWeight: "700", ...tight } },
                  }),
                  text(copy.role, { name: "Role", styles: { base: { ...quiet, ...tight } } }),
                ],
                1,
              ),
            ],
            5,
          ),
        ],
      },
    ]),
  ]);
}

/** Big numbers in a row on the brand colour, divided by thin lines. */
export function statBand(stats: Array<{ value: string; label: string }>): NodeBlueprint {
  return section(
    "Numbers band",
    [
      container([
        {
          type: "columns",
          name: "Numbers",
          styles: {
            base: {
              display: "grid",
              gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
              gap: space(5),
            },
            tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
            phone: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", rowGap: space(6) },
          },
          animation: animate("stagger-up"),
          children: stats.map((stat) =>
            stack(
              "Number",
              [
                text(stat.value, {
                  name: "Value",
                  styles: {
                    base: {
                      fontFamily: "var(--lintel-font-heading)",
                      fontSize: "clamp(2.5rem, 5vw, 4rem)",
                      fontWeight: "700",
                      lineHeight: "1",
                      letterSpacing: "-0.03em",
                    },
                  },
                }),
                text(stat.label, { name: "What it counts", styles: { base: { opacity: "0.85" } } }),
              ],
              2,
              {
                styles: {
                  base: {
                    display: "flex",
                    flexDirection: "column",
                    gap: space(2),
                    paddingTop: space(4),
                    borderStyle: "solid",
                    borderWidth: "1px 0 0 0",
                    borderColor: "currentColor",
                  },
                },
              },
            ),
          ),
        },
      ]),
    ],
    { tone: "brand", padding: 7 },
  );
}

/** A heading and numbers that count up as they come into view. */
export function countingNumbers(copy: {
  heading: string;
  numbers: Array<{ value: string; label: string }>;
}): NodeBlueprint {
  return section("Counting numbers", [
    container(
      [
        title(copy.heading),
        {
          type: "counterRow",
          name: "Numbers",
          styles: {
            base: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
              gap: space(6),
              textAlign: "center",
              width: "100%",
            },
          },
          children: copy.numbers.map((number) => ({
            type: "box",
            name: "Number",
            children: [
              {
                type: "heading",
                props: { text: number.value, level: 3 },
                styles: {
                  base: {
                    ...tight,
                    fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                    lineHeight: "1",
                    color: colour("brand"),
                  },
                },
                effects: [{ effect: "count-up", params: {} }],
              },
              text(number.label, { styles: { base: quiet } }),
            ],
          })),
        },
      ],
      { centred: true },
    ),
  ]);
}

/** One plan, centred: its price, what's included and a button. */
export function singlePlan(copy: {
  heading: string;
  text: string;
  name: string;
  price: string;
  per: string;
  includes: string[];
  button: { label: string; href: string };
  note: string;
}): NodeBlueprint {
  return section(
    "Single plan",
    [
      container(
        [
          title(copy.heading),
          lead(copy.text, { styles: { base: quiet } }),
          {
            type: "box",
            name: "Plan",
            props: { element: "article" },
            styles: {
              base: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: space(4),
                width: "100%",
                maxWidth: "28rem",
                marginTop: space(4),
                paddingTop: space(7),
                paddingBottom: space(7),
                paddingLeft: space(6),
                paddingRight: space(6),
                borderRadius: radius("large"),
                borderStyle: "solid",
                borderWidth: "1px",
                borderColor: colour("border"),
                backgroundColor: colour("background"),
              },
            },
            animation: animate("scale-in"),
            children: [
              heading(copy.name, 3, { styles: { base: tight } }),
              row(
                "Price",
                [
                  text(copy.price, {
                    name: "Amount",
                    styles: {
                      base: {
                        fontFamily: "var(--lintel-font-heading)",
                        fontSize: "3.5rem",
                        fontWeight: "700",
                        lineHeight: "1",
                      },
                    },
                  }),
                  text(copy.per, { name: "Per", styles: { base: quiet } }),
                ],
                { justifyContent: "center", alignItems: "baseline", gap: space(2) },
              ),
              {
                ...list(copy.includes),
                name: "What's included",
                styles: { base: { textAlign: "left" } },
              },
              button(copy.button.label, copy.button.href),
              text(copy.note, {
                name: "Small print",
                styles: { base: { ...quiet, fontSize: "0.875rem" } },
              }),
            ],
          },
        ],
        { centred: true, width: "48rem" },
      ),
    ],
    { tone: "panel" },
  );
}

/** Plans side by side in a table, feature by feature, with a button for each plan. */
export function planComparison(copy: {
  heading: string;
  text: string;
  plans: Array<{ name: string; price: string; button: { label: string; href: string } }>;
  rows: string[][];
}): NodeBlueprint {
  return section("Plan comparison", [
    container(
      [
        title(copy.heading),
        lead(copy.text, { styles: { base: quiet } }),
        {
          type: "table",
          name: "Plans table",
          props: {
            caption: "",
            headings: ["", ...copy.plans.map((plan) => `${plan.name} (${plan.price})`)],
            rows: copy.rows.map((cells) => ({ cells })),
            firstColumnIsHeading: true,
            striped: false,
          },
          styles: { base: { width: "100%", overflow: "auto" } },
          animation: animate("fade-up"),
        },
        row(
          "Buttons",
          copy.plans.map((plan, index) =>
            button(plan.button.label, plan.button.href, index === 1 ? "solid" : "outline"),
          ),
          { justifyContent: "flex-end", gap: space(3) },
          { justifyContent: "flex-start" },
        ),
      ],
      { width: "60rem" },
    ),
  ]);
}

/** Questions that open to show their answer, one at a time. */
export function openingQuestions(copy: {
  heading: string;
  text: string;
  items: Array<{ question: string; answer: string }>;
}): NodeBlueprint {
  return section("Questions that open", [
    container(
      [
        title(copy.heading),
        lead(copy.text, { styles: { base: quiet } }),
        {
          type: "accordion",
          name: "Questions",
          props: { onlyOneOpen: true },
          animation: animate("fade-up"),
          children: copy.items.map((item, index) => ({
            type: "accordionItem",
            name: "Question",
            props: { title: item.question, startsOpen: index === 0 },
            children: [text(item.answer, { name: "Answer" })],
          })),
        },
      ],
      { width: "48rem" },
    ),
  ]);
}

/** A heading and a way to ask on the left, the questions and answers on the right. */
export function questionsBesideTitle(copy: {
  heading: string;
  text: string;
  ask: { label: string; href: string };
  items: Array<{ question: string; answer: string }>;
}): NodeBlueprint {
  return section("Questions in two columns", [
    container([
      {
        type: "columns",
        name: "Two halves",
        styles: {
          base: {
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
            gap: space(8),
            alignItems: "start",
          },
          phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
        },
        children: [
          stack(
            "Title",
            [
              title(copy.heading),
              text(copy.text, { styles: { base: quiet } }),
              link(copy.ask.label, copy.ask.href),
            ],
            4,
          ),
          stack(
            "Questions",
            copy.items.map((item) =>
              stack(
                "Question",
                [
                  heading(item.question, 3, {
                    styles: { base: { ...tight, fontSize: "1.125rem" } },
                  }),
                  text(item.answer, { styles: { base: quiet } }),
                ],
                2,
                {
                  styles: {
                    base: {
                      display: "flex",
                      flexDirection: "column",
                      gap: space(2),
                      paddingTop: space(4),
                      ...hairline,
                    },
                  },
                },
              ),
            ),
            5,
            { animation: animate("stagger-up") },
          ),
        ],
      },
    ]),
  ]);
}

/** Address, phone and email beside a map of where you are. */
export function contactWithMap(copy: {
  heading: string;
  text: string;
  address: string;
  phone: string;
  email: string;
  place: { name: string; latitude: number; longitude: number };
}): NodeBlueprint {
  return section("Contact with map", [
    container([
      {
        type: "columns",
        name: "Two halves",
        styles: {
          base: {
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
            gap: space(7),
            alignItems: "stretch",
          },
          phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
        },
        children: [
          stack(
            "Details",
            [
              title(copy.heading),
              text(copy.text, { styles: { base: quiet } }),
              stack(
                "Address",
                [
                  eyebrow("Address"),
                  text(copy.address, { styles: { base: { whiteSpace: "pre-line" } } }),
                ],
                1,
              ),
              stack(
                "Phone",
                [eyebrow("Phone"), link(copy.phone, `tel:${copy.phone.replace(/\s/g, "")}`)],
                1,
              ),
              stack("Email", [eyebrow("Email"), link(copy.email, `mailto:${copy.email}`)], 1),
            ],
            5,
            { animation: animate("fade-up") },
          ),
          {
            type: "map",
            name: "Map",
            props: {
              placeName: copy.place.name,
              address: copy.address.replace(/\n/g, ", "),
              latitude: copy.place.latitude,
              longitude: copy.place.longitude,
              zoom: 15,
            },
            styles: {
              base: {
                width: "100%",
                minHeight: "22rem",
                borderRadius: radius("large"),
                overflow: "hidden",
              },
            },
          },
        ],
      },
    ]),
  ]);
}

/** A few lines about how you reply on the left, one of your forms on the right. */
export function contactBesideForm(copy: {
  label: string;
  heading: string;
  text: string;
  promises: string[];
  email: string;
}): NodeBlueprint {
  return section(
    "Contact beside a form",
    [
      container([
        {
          type: "columns",
          name: "Two halves",
          styles: {
            base: {
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: space(8),
              alignItems: "start",
            },
            phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
          },
          children: [
            stack(
              "Words",
              [
                eyebrow(copy.label),
                title(copy.heading),
                text(copy.text),
                list(copy.promises),
                link(copy.email, `mailto:${copy.email}`),
              ],
              4,
            ),
            {
              type: "box",
              name: "Form panel",
              styles: {
                base: {
                  paddingTop: space(6),
                  paddingBottom: space(6),
                  paddingLeft: space(6),
                  paddingRight: space(6),
                  borderRadius: radius("large"),
                  backgroundColor: colour("background"),
                },
                phone: {
                  paddingTop: space(5),
                  paddingBottom: space(5),
                  paddingLeft: space(4),
                  paddingRight: space(4),
                },
              },
              animation: animate("fade-up", { delay: 150 }),
              children: [
                { type: "formEmbed", name: "Form", props: { form: "", showTitle: false } },
              ],
            },
          ],
        },
      ]),
    ],
    { tone: "panel" },
  );
}

const smallPrintStyles: StyleDeclarations = { fontSize: "0.875rem", opacity: "0.75" };
const cookieSettingsLink: NodeBlueprint = {
  type: "cookieSettings",
  styles: { base: smallPrintStyles },
};

function footerBand(
  children: NodeBlueprint[],
  tone: "page" | "dark",
  styles: StyleDeclarations = {},
): NodeBlueprint {
  const tones: Record<typeof tone, StyleDeclarations> = {
    page: { boxShadow: `inset 0 1px 0 ${colour("border")}` },
    dark: { backgroundColor: colour("text"), color: colour("background") },
  };
  return {
    type: "section",
    name: "Footer",
    props: { element: "footer", anchor: "" },
    styles: {
      base: {
        paddingTop: space(7),
        paddingBottom: space(7),
        paddingLeft: space(5),
        paddingRight: space(5),
        ...tones[tone],
        ...styles,
      },
      phone: { paddingTop: space(6), paddingBottom: space(6) },
    },
    children,
  };
}

function footerContainer(children: NodeBlueprint[], gap = 6): NodeBlueprint {
  return {
    type: "container",
    name: "Footer content",
    styles: {
      base: {
        display: "flex",
        flexDirection: "column",
        gap: space(gap),
        maxWidth: "72rem",
        marginLeft: "auto",
        marginRight: "auto",
        width: "100%",
      },
    },
    children,
  };
}

/** A big invitation as the last thing on every page, over the menu and the small print. */
export function footerBigInvitation(copy: {
  invitation: string;
  href: string;
  smallPrint: string;
}): NodeBlueprint {
  return footerBand(
    [
      footerContainer([
        {
          type: "link",
          name: "Invitation",
          props: { label: copy.invitation, href: copy.href, openInNewTab: false },
          styles: {
            base: {
              fontFamily: "var(--lintel-font-heading)",
              fontSize: "clamp(2.75rem, 10vw, 8rem)",
              fontWeight: "700",
              lineHeight: "0.95",
              letterSpacing: "-0.045em",
              color: "inherit",
              textDecoration: "none",
            },
            hover: { opacity: "0.7" },
          },
          animation: animate("fade-up"),
        },
        row(
          "Footer row",
          [
            siteMenuRow({ label: "Footer", always: true, styles: { color: "inherit" } }),
            row(
              "Small print",
              [
                text(copy.smallPrint, { name: "Small print", styles: { base: smallPrintStyles } }),
                cookieSettingsLink,
              ],
              { gap: space(4) },
            ),
          ],
          {
            justifyContent: "space-between",
            paddingTop: space(5),
            borderStyle: "solid",
            borderWidth: "1px 0 0 0",
            borderColor: "currentColor",
          },
          { flexDirection: "column", alignItems: "flex-start" },
        ),
      ]),
    ],
    "dark",
    { paddingTop: space(9) },
  );
}

/** A newsletter sign-up beside the logo and the menu, then the small print. */
export function footerWithSignUp(copy: { signUpTitle: string; smallPrint: string }): NodeBlueprint {
  return footerBand(
    [
      footerContainer([
        {
          type: "columns",
          name: "Footer columns",
          styles: {
            base: {
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: space(7),
              alignItems: "start",
            },
            phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
          },
          children: [
            stack(
              "Site",
              [
                siteLogo("both", { fontSize: "1.25rem" }),
                siteMenuRow({ label: "Footer", always: true }),
              ],
              4,
            ),
            {
              type: "newsletterSignup",
              name: "Sign-up",
              props: {
                form: "",
                title: copy.signUpTitle,
                text: "",
                emailLabel: "Email address",
                buttonLabel: "Sign up",
              },
            },
          ],
        },
        row(
          "Small print",
          [
            text(copy.smallPrint, { name: "Small print", styles: { base: smallPrintStyles } }),
            cookieSettingsLink,
          ],
          { gap: space(4), paddingTop: space(4), ...hairline },
        ),
      ]),
    ],
    "page",
  );
}

/** The name, the menu, the small print and a way back to the top, on one quiet line. */
export function footerQuiet(copy: { smallPrint: string }): NodeBlueprint {
  return footerBand(
    [
      footerContainer(
        [
          row(
            "Footer row",
            [
              row(
                "Small print",
                [
                  siteLogo("name", { fontSize: "0.875rem", fontWeight: "700" }),
                  siteMenuRow({
                    label: "Footer",
                    always: true,
                    styles: { fontSize: "0.875rem", fontWeight: "400" },
                  }),
                  text(copy.smallPrint, {
                    name: "Small print",
                    styles: { base: smallPrintStyles },
                  }),
                  cookieSettingsLink,
                ],
                { gap: space(4) },
              ),
              {
                type: "backToTop",
                name: "Back to top",
                props: { label: "Back to top", floats: false },
                styles: { base: { fontSize: "0.875rem" } },
              },
            ],
            { justifyContent: "space-between" },
            { flexDirection: "column", alignItems: "flex-start", gap: space(3) },
          ),
        ],
        3,
      ),
    ],
    "page",
    { paddingTop: space(5), paddingBottom: space(5) },
  );
}
