import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import type { DesignVariable } from "../site-design/design-variables.js";
import type { StarterSite } from "./starter-site.js";
import { at, starterParts, withStyles } from "./starter-parts.js";

/**
 * Northside Commons: a community group and charity in Phibsborough, Dublin, running a food
 * larder, a garden, a Thursday lunch and a bike workshop. Warm paper and deep blue-grey ink,
 * DM Serif Display for headings with DM Sans for reading, a handwritten note in Caveat, round
 * buttons and one harbour teal. Plain words throughout, and the ways to help (give money,
 * give time, give food) are always one click away.
 */

export const harbourVariable = {
  id: "harbour",
  name: "Harbour teal",
  kind: "colour",
  value: "#1f6b6a",
  darkValue: "#82cfc9",
} satisfies DesignVariable;
const harbour = `var(--lintel-var-${harbourVariable.id})`;
const onHarbour = "light-dark(#fffaf0, #102021)";

const paper = "light-dark(#faf6ee, #14191b)";
const ink = "light-dark(#1f2a2e, #eef0ea)";
/** A softer band for the numbers. */
const mist = "light-dark(#e3eeea, #1c2628)";

const parts = starterParts({
  paper,
  ink,
  quiet: "light-dark(#4f5b5e, #a9b4b3)",
  rule: "light-dark(#e0d8c8, #2c3638)",
  detail: { fontSize: "0.8125rem", fontWeight: "700", lineHeight: "1.5", letterSpacing: "0.02em" },
  buttonCorners: "999px",
});
const { band, gridBand, words, heading, label, link, action, image, group } = parts;

const serif: StyleDeclarations = { fontFamily: "var(--lintel-font-heading)", fontWeight: "400" };
const handwriting: StyleDeclarations = {
  fontFamily: "Caveat, cursive",
  fontWeight: "700",
  fontSize: "2rem",
  lineHeight: "1",
  color: harbour,
};
const sectionTitle: StyleDeclarations = {
  ...serif,
  fontSize: "clamp(2rem, 4vw, 3.25rem)",
  lineHeight: "1.05",
};
const email = "hello@northsidecommons.example";
const address = "St Peter’s Hall, 8 Cabra Road\nPhibsborough, Dublin 7";
const donateHref = "https://northsidecommons.example/donate";

function donateButton(
  text = "Donate",
  styles: StyleDeclarations = {},
  amount?: number,
): NodeBlueprint {
  return action(
    "Donate button",
    text,
    amount ? `${donateHref}?amount=${amount}` : donateHref,
    { background: harbour, text: onHarbour },
    {
      fontWeight: "700",
      ...styles,
    },
  );
}

function outlineButton(text: string, href: string): NodeBlueprint {
  return withStyles(action("Button", text, href, { background: "transparent", text: ink }), {
    base: { borderStyle: "solid", borderWidth: "2px", borderColor: ink, fontWeight: "700" },
  });
}

interface Project {
  name: string;
  when: string;
  text: string;
  illustration: string;
  alt: string;
}

const projects: readonly Project[] = [
  {
    name: "The larder",
    when: "Tuesdays and Fridays, 4pm to 7pm",
    text: "Free food and household basics for anyone who needs them, no questions asked. Take what you need; leave what you can.",
    illustration: "northside-larder",
    alt: "Shelves of jars, tins and packets in teal and orange",
  },
  {
    name: "The garden",
    when: "Saturdays, 10am to 1pm",
    text: "Six raised beds behind the hall, growing vegetables for the larder and the lunch. No experience needed; gloves provided.",
    illustration: "northside-garden",
    alt: "Two raised vegetable beds with flowers, and an orange watering can",
  },
  {
    name: "Thursday lunch",
    when: "Thursdays, 12.30pm",
    text: "Soup, bread and a hot dinner at one long table, cooked by volunteers. Pay what you like, or nothing at all.",
    illustration: "northside-lunch",
    alt: "A long table with a teal teapot and steaming mugs",
  },
  {
    name: "Bike workshop",
    when: "First Sunday of the month, 11am",
    text: "Bring a bike that needs fixing and we’ll show you how. Donated bikes are mended and passed on to people who need one.",
    illustration: "northside-bikes",
    alt: "A teal bicycle up on an orange repair stand",
  },
];

interface Gathering {
  day: string;
  month: string;
  title: string;
  details: string;
}

const gatherings: readonly Gathering[] = [
  {
    day: "14",
    month: "Nov",
    title: "Winter coat swap",
    details: "Saturday, 11am to 2pm, in the hall. Bring a coat, take a coat.",
  },
  {
    day: "19",
    month: "Nov",
    title: "Thursday lunch: Irish stew night",
    details: "Thursday, 6pm. An evening lunch, for once. Pay what you like.",
  },
  {
    day: "28",
    month: "Nov",
    title: "Garden put-to-bed day",
    details: "Saturday, 10am. Mulching, mending and soup afterwards.",
  },
  {
    day: "05",
    month: "Dec",
    title: "Christmas hampers: packing day",
    details: "Saturday, 10am to 4pm. Come for an hour or all day.",
  },
  {
    day: "06",
    month: "Dec",
    title: "Bike workshop: lights and brakes",
    details: "Sunday, 11am. Get your bike ready for the dark evenings.",
  },
];

/** One event: the date large on the left, then what and when. */
function gatheringRow(gathering: Gathering, level: number): NodeBlueprint {
  return group(
    "Event",
    [
      group(
        "Date",
        [
          words("Day", gathering.day, { base: { ...serif, fontSize: "2.75rem", lineHeight: "1" } }),
          words("Month", gathering.month, { base: { ...parts.look.detail, color: harbour } }),
        ],
        { base: { gap: "0", alignItems: "center", minWidth: "4rem" } },
      ),
      group(
        "What and when",
        [
          heading("Event name", gathering.title, level, {
            base: { ...serif, fontSize: "1.5rem", lineHeight: "1.15" },
          }),
          words("Details", gathering.details, { base: { color: parts.look.quiet } }),
        ],
        { base: { gap: space(1) } },
      ),
    ],
    {
      base: {
        flexDirection: "row",
        alignItems: "center",
        gap: space(5),
        paddingTop: space(4),
        paddingBottom: space(4),
        borderStyle: "solid",
        borderColor: parts.look.rule,
        borderWidth: "0 0 1px 0",
      },
    },
  );
}

function pageTop(copy: { note: string; title: string; text: string }): NodeBlueprint {
  return gridBand(
    "Page title",
    [
      withStyles(words("Note", copy.note, { base: handwriting }), at(1, 6, 1, { rotate: "-2deg" })),
      heading(
        "Page title",
        copy.title,
        1,
        at(1, 9, 2, { ...serif, fontSize: "clamp(2.75rem, 7vw, 6rem)", lineHeight: "1" }),
        animate("words-rise"),
      ),
      words(
        "Introduction",
        copy.text,
        at(1, 6, 3, { fontSize: "1.1875rem", lineHeight: "1.6" }),
        animate("fade-in", { delay: 300 }),
      ),
    ],
    { top: 8, bottom: 6 },
  );
}

function navigation(): NodeBlueprint {
  return parts.navigation({
    logo: { ...serif, fontSize: "1.5rem" },
    menu: { fontWeight: "500" },
    extra: [donateButton("Donate", { paddingTop: space(2), paddingBottom: space(2) })],
  });
}

function footer(): NodeBlueprint {
  return gridBand(
    "Footer",
    [
      words(
        "Group name",
        "Northside Commons",
        at(1, 5, 1, { ...serif, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: "1" }),
      ),
      words("Address", address, at(6, 3, 1, { whiteSpace: "pre-line", lineHeight: "1.6" })),
      group(
        "Footer links",
        [
          link("Email", email, `mailto:${email}`),
          link("Facebook", "Facebook", "https://www.facebook.com/"),
          link("Instagram", "Instagram", "https://www.instagram.com/"),
          parts.cookieSettings(),
        ],
        at(9, 4, 1, { gap: space(2) }),
      ),
      label(
        "Northside Commons CLG · Registered charity number 20071234 · © 2026",
        "Small print",
        at(1, 8, 2, { color: parts.look.quiet }),
      ),
      parts.localTime("Dublin", "Europe/Dublin", at(9, 4, 2)),
    ],
    {
      element: "footer",
      top: 7,
      bottom: 6,
      colours: { background: mist, text: ink },
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
    "Northside Commons runs a free food larder, a community garden, a Thursday lunch and a bike workshop in Phibsborough, Dublin.",
  sections: [
    gridBand(
      "Opening",
      [
        withStyles(
          words("Note", "Everyone welcome", { base: handwriting }),
          at(1, 6, 1, { rotate: "-2deg" }),
        ),
        heading(
          "Main title",
          "Neighbours looking after neighbours in Phibsborough.",
          1,
          at(1, 7, 2, {
            ...serif,
            fontSize: "clamp(2.75rem, 6.4vw, 6rem)",
            lineHeight: "1",
            letterSpacing: "-0.01em",
          }),
          animate("words-rise"),
        ),
        image(
          "The street",
          "northside-street",
          "A terrace of five houses with teal and orange doors under an orange sun",
          { ...at(8, 5, "1 / span 3", { borderRadius: "1.5rem", alignSelf: "center" }) },
          animate("mask-reveal-up", { delay: 200 }),
        ),
        group(
          "Welcome",
          [
            words(
              "Welcome",
              "Since 2009 we’ve run a free larder, a garden, a Thursday lunch and a bike workshop from St Peter’s Hall, all of it by volunteers. Come along to any of them; you don’t need to sign up.",
              { base: { fontSize: "1.1875rem", lineHeight: "1.6", maxWidth: "34rem" } },
            ),
            group(
              "Buttons",
              [donateButton(), outlineButton("Volunteer with us", "/get-involved")],
              { base: { flexDirection: "row", flexWrap: "wrap", gap: space(3) } },
            ),
          ],
          at(1, 6, 3, { gap: space(6) }),
          animate("fade-up", { delay: 300 }),
        ),
      ],
      { top: 7, bottom: 8 },
    ),
    gridBand(
      "Last year",
      [
        withStyles(label("Last year, together"), at(1, 12, 1)),
        ...[
          { number: "1,240", counts: "Food parcels given out" },
          { number: "86", counts: "Volunteers, aged 15 to 84" },
          { number: "52", counts: "Thursday lunches, none missed" },
        ].map((item, index) =>
          parts.figure(
            item.number,
            item.counts,
            { ...serif, fontSize: "clamp(3.5rem, 7vw, 6rem)", color: harbour },
            at(1 + index * 4, 4, 2),
          ),
        ),
      ],
      { top: 8, bottom: 8, colours: { background: mist, text: ink } },
    ),
    band(
      "What we do",
      [
        group(
          "Title",
          [
            heading("Section title", "What we do", 2, { base: sectionTitle }),
            link("About link", "More about us", "/about", { textDecoration: "underline" }),
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
        group(
          "Projects",
          projects.map((project) =>
            group(
              "Project",
              [
                image("Picture", project.illustration, project.alt, {
                  base: { borderRadius: "1.25rem", aspectRatio: "4 / 3", objectFit: "cover" },
                }),
                heading("Project name", project.name, 3, {
                  base: { ...serif, fontSize: "1.75rem", marginTop: space(3) },
                }),
                label(project.when, "When"),
                words("About it", project.text, { base: { lineHeight: "1.6" } }),
              ],
              { base: { gap: space(2) } },
            ),
          ),
          {
            base: {
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              columnGap: "clamp(1rem, 3vw, 3rem)",
              rowGap: space(8),
            },
            phone: { gridTemplateColumns: "minmax(0, 1fr)", rowGap: space(6) },
          },
          animate("stagger-up", { stagger: 90 }),
        ),
      ],
      {
        top: 9,
        bottom: 8,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(7) } },
      },
    ),
    gridBand(
      "Coming up",
      [
        group(
          "Title",
          [
            heading("Section title", "Coming up", 2, { base: sectionTitle }),
            link("Events link", "Everything that’s on", "/events", { textDecoration: "underline" }),
          ],
          at(1, 4, 1, { gap: space(4) }),
        ),
        group(
          "Events",
          gatherings.slice(0, 3).map((gathering) => gatheringRow(gathering, 3)),
          at(6, 7, 1, {
            gap: "0",
            borderStyle: "solid",
            borderColor: parts.look.rule,
            borderWidth: "1px 0 0 0",
          }),
          animate("stagger-up", { stagger: 80 }),
        ),
      ],
      { top: 6, bottom: 9 },
    ),
    band(
      "Donate",
      [
        heading(
          "Call to give",
          "€10 keeps the larder stocked for one family for a week.",
          2,
          {
            base: {
              ...serif,
              fontSize: "clamp(2rem, 4.6vw, 4rem)",
              lineHeight: "1.05",
              maxWidth: "50rem",
            },
          },
          animate("fade-up"),
        ),
        action(
          "Donate button",
          "Give €10",
          donateHref,
          { background: onHarbour, text: harbour },
          {
            fontWeight: "700",
          },
        ),
      ],
      {
        top: 9,
        bottom: 9,
        colours: { background: harbour, text: onHarbour },
        styles: { base: { display: "flex", flexDirection: "column", gap: space(6) } },
      },
    ),
  ],
};

const aboutPage = {
  slug: "about",
  title: "About us",
  summary: "Why Northside Commons exists, what it does and who runs it.",
  sections: [
    pageTop({
      note: "Since 2009",
      title: "Nobody on our streets should go without.",
      text: "That’s the whole idea. We started as six neighbours with a car boot of tins; today we’re a registered charity run almost entirely by volunteers, with one part-time coordinator.",
    }),
    ...projects.map((project, index) =>
      gridBand(
        project.name,
        [
          image(
            "Picture",
            project.illustration,
            project.alt,
            at(index % 2 === 0 ? 1 : 7, 6, 1, { borderRadius: "1.5rem" }),
            animate("mask-reveal-up"),
          ),
          group(
            "About it",
            [
              heading("Project name", project.name, 2, { base: sectionTitle }),
              label(project.when, "When"),
              words("About it", project.text, {
                base: { fontSize: "1.125rem", lineHeight: "1.6" },
              }),
            ],
            at(index % 2 === 0 ? 8 : 1, 5, 1, { alignSelf: "center", gap: space(4) }),
            animate("fade-up", { delay: 100 }),
          ),
        ],
        { top: 5, bottom: 5 },
      ),
    ),
    gridBand(
      "Who runs it",
      [
        heading("Section title", "Who runs it", 2, at(1, 5, 1, sectionTitle)),
        words(
          "Who runs it",
          "A board of seven volunteers, elected each spring at our open meeting, and Niamh Byrne, our coordinator, three days a week. Every euro and every decision is in our yearly report, which anyone can ask for.",
          at(7, 6, 1, { fontSize: "1.125rem", lineHeight: "1.6" }),
          animate("fade-up"),
        ),
      ],
      { top: 7, bottom: 9, colours: { background: mist, text: ink } },
    ),
  ],
};

const eventsPage = {
  slug: "events",
  title: "Events",
  summary: "What's on at Northside Commons and St Peter's Hall.",
  sections: [
    pageTop({
      note: "All free, all welcome",
      title: "What’s on",
      text: "Everything happens at St Peter’s Hall unless it says otherwise. Children are welcome at all of it.",
    }),
    band(
      "Events",
      [
        group(
          "Events",
          gatherings.map((gathering) => gatheringRow(gathering, 2)),
          {
            base: {
              gap: "0",
              maxWidth: "52rem",
              borderStyle: "solid",
              borderColor: parts.look.rule,
              borderWidth: "1px 0 0 0",
            },
          },
          animate("stagger-up", { stagger: 70 }),
        ),
      ],
      { top: 2, bottom: 8 },
    ),
    gridBand(
      "The hall",
      [
        image(
          "The hall",
          "northside-hall",
          "A small hall with a round window over open orange doors",
          at(1, 6, 1, { borderRadius: "1.5rem" }),
          animate("mask-reveal-up"),
        ),
        group(
          "About the hall",
          [
            heading("Section title", "Use the hall", 2, { base: sectionTitle }),
            words(
              "About the hall",
              "Local groups can use the hall for free on weekday mornings; birthday parties and classes pay €20 an hour, which goes to the larder. Fifty chairs, a kitchen and step-free access.",
              { base: { fontSize: "1.125rem", lineHeight: "1.6" } },
            ),
            link("Email", `Ask about a date: ${email}`, `mailto:${email}`, {
              textDecoration: "underline",
            }),
          ],
          at(8, 5, 1, { alignSelf: "center", gap: space(4) }),
          animate("fade-up"),
        ),
      ],
      { top: 7, bottom: 9, colours: { background: mist, text: ink } },
    ),
  ],
};

const getInvolvedPage = {
  slug: "get-involved",
  title: "Get involved",
  summary: "Give money, time or food to Northside Commons.",
  sections: [
    pageTop({
      note: "Thank you",
      title: "Give money, time or food",
      text: "Every one of these helps, and none of them is too small.",
    }),
    gridBand(
      "Give money",
      [
        heading("Section title", "Give money", 2, at(1, 5, 1, sectionTitle)),
        group(
          "Donating",
          [
            words(
              "Donating",
              "Donations go straight to food, seeds and bike parts. A monthly gift helps us plan; over €250 a year, we can claim tax back at no cost to you.",
              { base: { fontSize: "1.125rem", lineHeight: "1.6" } },
            ),
            group(
              "Amounts",
              [
                donateButton("Give €5", {}, 5),
                donateButton("Give €10", {}, 10),
                donateButton("Give €25", {}, 25),
                outlineButton("Another amount", donateHref),
              ],
              { base: { flexDirection: "row", flexWrap: "wrap", gap: space(3) } },
            ),
          ],
          at(6, 7, 1, { gap: space(5) }),
          animate("fade-up"),
        ),
      ],
      { top: 4, bottom: 7 },
    ),
    gridBand(
      "Give time",
      [
        heading("Section title", "Give time", 2, at(1, 5, 1, sectionTitle)),
        group(
          "Volunteering",
          [
            words(
              "Volunteering",
              "We always need people to pack the larder, cook on Thursdays, dig on Saturdays and drive the van. Two hours a month is plenty. Tell us a little about yourself and we’ll call you back.",
              { base: { fontSize: "1.125rem", lineHeight: "1.6" } },
            ),
          ],
          at(6, 7, 1),
          animate("fade-up"),
        ),
      ],
      {
        top: 7,
        bottom: 4,
        styles: {
          base: { borderStyle: "solid", borderColor: parts.look.rule, borderWidth: "1px 0 0 0" },
        },
      },
    ),
    gridBand(
      "Volunteer form",
      [
        withStyles(
          { type: "formEmbed", name: "Form", props: { form: "contact", showTitle: false } },
          at(6, 7, 1),
        ),
      ],
      { top: 2, bottom: 7 },
    ),
    gridBand(
      "Give food",
      [
        heading("Section title", "Give food", 2, at(1, 5, 1, sectionTitle)),
        group(
          "Giving food",
          [
            words(
              "Giving food",
              "Bring tins, pasta, rice, tea, nappies and toiletries to the hall on Tuesdays and Fridays from 3pm, or to the box inside Doyle’s pharmacy on the Cabra Road any time it’s open. Please, nothing out of date.",
              { base: { fontSize: "1.125rem", lineHeight: "1.6" } },
            ),
          ],
          at(6, 7, 1),
          animate("fade-up"),
        ),
      ],
      { top: 7, bottom: 9, colours: { background: mist, text: ink } },
    ),
  ],
};

export const northsideSite: StarterSite = {
  id: "northside",
  name: "Northside Commons",
  description:
    "A warm, plain-spoken site for a community group: what you do, what's on, and how to give money, time or food.",
  suitedTo: "Charities, community groups, clubs and volunteer projects",
  coverIllustration: "northside-cover",
  theme: {
    brandColour: "#1f6b6a",
    accentColour: "#e08a4f",
    fontPairing: "friendly",
    cornerStyle: "round",
    headingFont: "DM Serif Display",
    bodyFont: "DM Sans",
  },
  designVariables: [harbourVariable],
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "none" },
    pageTransition: { style: "fade", duration: 400 },
    intro: { style: "none" },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  pages: [homePage, aboutPage, eventsPage, getInvolvedPage],
};
