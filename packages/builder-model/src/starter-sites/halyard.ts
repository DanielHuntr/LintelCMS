import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import { animate, space } from "../sections/section-parts.js";
import type { DesignVariable } from "../site-design/design-variables.js";
import type { StarterSite } from "./starter-site.js";
import { at, picture, starterParts, withStyles } from "./starter-parts.js";

/**
 * Halyard: a strength and yoga studio in Woodstock, Cape Town. Chalk and charcoal (charcoal
 * first in dark mode) with a lime that is only ever a fill, never text on the paper; Big
 * Shoulders Display in tall capitals for the headings and Archivo for reading. Loud type,
 * square edges and a timetable that's easy to scan on a phone.
 */

export const limeVariable = {
  id: "lime",
  name: "Lime",
  kind: "colour",
  value: "#c8f04a",
  darkValue: "#c8f04a",
} satisfies DesignVariable;
const lime = `var(--lintel-var-${limeVariable.id})`;
/** Text on the lime: always charcoal, 13:1. */
const onLime = "#17191a";

const paper = "light-dark(#ecebe6, #111314)";
const ink = "light-dark(#111314, #ecebe6)";

const parts = starterParts({
  paper,
  ink,
  quiet: "light-dark(#54574f, #a9aca4)",
  rule: "light-dark(#c9c8c1, #2c2f30)",
  detail: {
    fontSize: "0.75rem",
    fontWeight: "700",
    lineHeight: "1.5",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
});
const { band, gridBand, words, heading, label, link, action, image, group } = parts;

const tall: StyleDeclarations = {
  fontFamily: "var(--lintel-font-heading)",
  fontWeight: "900",
  textTransform: "uppercase",
  letterSpacing: "-0.01em",
  lineHeight: "0.88",
};
const email = "train@halyard.example";
const address = "Unit 4, 120 Albert Road\nWoodstock, Cape Town 7925";
const sectionTitle: StyleDeclarations = { ...tall, fontSize: "clamp(2.5rem, 6vw, 5rem)" };

function limeButton(text: string, href: string, styles: StyleDeclarations = {}): NodeBlueprint {
  return action(
    "Main button",
    text,
    href,
    { background: lime, text: onLime },
    {
      ...parts.look.detail,
      fontSize: "0.875rem",
      ...styles,
    },
  );
}

interface Course {
  name: string;
  length: string;
  level: string;
  text: string;
  illustration: string;
  alt: string;
}

const courses: readonly Course[] = [
  {
    name: "Strength",
    length: "50 minutes",
    level: "Every level",
    text: "Kettlebells, barbells and your own body weight, coached in groups of eight so someone is always watching your form.",
    illustration: "halyard-strength",
    alt: "A person swinging a lime-green kettlebell up to shoulder height",
  },
  {
    name: "Flow",
    length: "60 minutes",
    level: "Every level",
    text: "Vinyasa yoga that builds through the hour: strong standing poses, then a long, slow cool-down.",
    illustration: "halyard-yoga",
    alt: "A person holding a wide warrior pose on a lime-green mat",
  },
  {
    name: "Row",
    length: "40 minutes",
    level: "Some experience",
    text: "Intervals on the rowing machines with a coach calling the pace. Hard work, short and sociable.",
    illustration: "halyard-rower",
    alt: "A person on a rowing machine, pulling the handle to their chest",
  },
  {
    name: "Breathe",
    length: "30 minutes",
    level: "Every level",
    text: "Breathing practice and stillness, lying down, lights low. Good after work and better before sleep.",
    illustration: "halyard-breath",
    alt: "Rings around a small lime circle on charcoal, like a slow breath",
  },
];

/** One row of the class list: the name very large, with its picture under the pointer. */
function courseRow(course: Course, index: number): NodeBlueprint {
  return {
    type: "box",
    name: "Class",
    props: { element: "article" },
    styles: {
      base: {
        display: "grid",
        gridTemplateColumns: "3rem minmax(0, 1fr) minmax(0, 14rem)",
        alignItems: "end",
        gap: space(4),
        paddingTop: space(4),
        paddingBottom: space(4),
        borderStyle: "solid",
        borderColor: ink,
        borderWidth: "2px 0 0 0",
      },
      phone: { gridTemplateColumns: "2rem minmax(0, 1fr)" },
    },
    effects: [
      { effect: "hover-picture", params: { src: picture(course.illustration), size: "medium" } },
    ],
    children: [
      words("Number", String(index + 1).padStart(2, "0"), { base: parts.look.detail }),
      heading("Class name", course.name, 3, {
        base: { ...tall, fontSize: "clamp(3rem, 9vw, 8rem)" },
      }),
      words("Length and level", `${course.length}\n${course.level}`, {
        base: { whiteSpace: "pre-line", color: parts.look.quiet, textAlign: "right" },
        phone: { gridColumn: "2", textAlign: "left" },
      }),
    ],
  };
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
        at(1, 12, 2, { ...tall, fontSize: "clamp(4rem, 16vw, 15rem)" }),
        animate("letters-drop"),
      ),
      words(
        "Introduction",
        copy.text,
        at(1, 5, 3, { fontSize: "1.125rem", lineHeight: "1.55" }),
        animate("fade-in", { delay: 300 }),
      ),
    ],
    { top: 7, bottom: 6 },
  );
}

interface Session {
  time: string;
  course: string;
  coach: string;
}

const week: readonly { day: string; sessions: readonly Session[] }[] = [
  {
    day: "Monday",
    sessions: [
      { time: "06:00", course: "Strength", coach: "Thandi" },
      { time: "12:30", course: "Row", coach: "Pieter" },
      { time: "18:00", course: "Flow", coach: "Amira" },
      { time: "19:30", course: "Breathe", coach: "Amira" },
    ],
  },
  {
    day: "Tuesday",
    sessions: [
      { time: "06:00", course: "Flow", coach: "Lerato" },
      { time: "17:30", course: "Strength", coach: "Thandi" },
      { time: "18:45", course: "Row", coach: "Pieter" },
    ],
  },
  {
    day: "Wednesday",
    sessions: [
      { time: "06:00", course: "Strength", coach: "Sipho" },
      { time: "12:30", course: "Flow", coach: "Lerato" },
      { time: "18:00", course: "Strength", coach: "Thandi" },
      { time: "19:30", course: "Breathe", coach: "Amira" },
    ],
  },
  {
    day: "Thursday",
    sessions: [
      { time: "06:00", course: "Row", coach: "Pieter" },
      { time: "17:30", course: "Flow", coach: "Amira" },
      { time: "18:45", course: "Strength", coach: "Sipho" },
    ],
  },
  {
    day: "Friday",
    sessions: [
      { time: "06:00", course: "Strength", coach: "Thandi" },
      { time: "12:30", course: "Breathe", coach: "Lerato" },
      { time: "17:30", course: "Row", coach: "Pieter" },
    ],
  },
  {
    day: "Saturday",
    sessions: [
      { time: "08:00", course: "Strength", coach: "Sipho" },
      { time: "09:30", course: "Flow", coach: "Lerato" },
    ],
  },
  { day: "Sunday", sessions: [{ time: "09:00", course: "Flow", coach: "Amira" }] },
];

function navigation(): NodeBlueprint {
  return parts.navigation({
    logo: { ...tall, fontSize: "1.75rem", letterSpacing: "0.02em" },
    menu: { ...parts.look.detail, fontSize: "0.8125rem" },
    extra: [
      limeButton("Free first class", "/memberships", {
        paddingTop: space(2),
        paddingBottom: space(2),
      }),
    ],
  });
}

function footer(): NodeBlueprint {
  return gridBand(
    "Footer",
    [
      words(
        "Studio name",
        "Halyard",
        at(1, 12, 1, { ...tall, fontSize: "clamp(5rem, 22vw, 20rem)", lineHeight: "0.8" }),
      ),
      words("Address", address, at(1, 4, 2, { whiteSpace: "pre-line", lineHeight: "1.6" })),
      words(
        "Hours",
        "Monday to Friday, 05:30 to 20:30\nSaturday and Sunday, 07:30 to 13:00",
        at(5, 4, 2, { whiteSpace: "pre-line", lineHeight: "1.6" }),
      ),
      group(
        "Footer links",
        [
          link("Email", email, `mailto:${email}`),
          link("Instagram", "Instagram", "https://www.instagram.com/"),
          link("Strava", "Strava club", "https://www.strava.com/"),
          parts.cookieSettings(),
        ],
        at(9, 4, 2, { gap: space(2) }),
      ),
      label("© 2026 Halyard Studio (Pty) Ltd", "Small print", at(1, 4, 3)),
      parts.localTime("Cape Town", "Africa/Johannesburg", at(5, 4, 3)),
    ],
    {
      element: "footer",
      top: 6,
      bottom: 6,
      styles: { base: { borderStyle: "solid", borderColor: ink, borderWidth: "2px 0 0 0" } },
    },
  );
}

const homePage = {
  slug: "home",
  title: "Home",
  summary:
    "Halyard is a strength and yoga studio in Woodstock, Cape Town: small coached classes seven days a week, from 6am on weekdays.",
  sections: [
    gridBand(
      "Opening",
      [
        withStyles(label("Strength and yoga, Woodstock"), at(1, 7, 1)),
        heading(
          "Main title",
          "Get strong. Stay supple.",
          1,
          at(1, 7, 2, { ...tall, fontSize: "clamp(4.5rem, 13vw, 13rem)" }),
          animate("letters-drop"),
        ),
        image(
          "Strength",
          "halyard-strength",
          "A person swinging a lime-green kettlebell up to shoulder height",
          { ...at(9, 4, "1 / span 3"), phone: { gridRow: "auto" } },
          animate("mask-reveal-up", { delay: 200 }),
        ),
        group(
          "Welcome",
          [
            words(
              "Welcome",
              "Small coached classes, eight to a room, from six in the morning. Lift, row, stretch and breathe with people who’ll learn your name in a week.",
              { base: { fontSize: "1.125rem", lineHeight: "1.55", maxWidth: "30rem" } },
            ),
            group(
              "Buttons",
              [
                limeButton("Book a free first class", "/memberships"),
                link("Timetable link", "See the timetable", "/timetable", {
                  textDecoration: "underline",
                  alignSelf: "center",
                }),
              ],
              { base: { flexDirection: "row", flexWrap: "wrap", gap: space(5) } },
            ),
          ],
          at(1, 7, 3, { gap: space(6) }),
          animate("fade-up", { delay: 300 }),
        ),
      ],
      { top: 6, bottom: 8 },
    ),
    band(
      "Classes ticker",
      [
        {
          type: "marquee",
          name: "Classes ticker",
          props: {
            items: ["Strength", "Flow", "Row", "Breathe", "06:00 to 20:30", "Eight to a class"],
            speed: "medium",
            direction: "left",
          },
          styles: { base: { ...tall, fontSize: "clamp(2rem, 5vw, 3.75rem)" } },
        },
      ],
      { top: 3, bottom: 3, colours: { background: lime, text: onLime } },
    ),
    gridBand(
      "In numbers",
      [
        ...[
          { number: "20", counts: "Classes a week" },
          { number: "8", counts: "People to a class, at most" },
          { number: "6am", counts: "First class, every weekday" },
        ].map((item, index) =>
          parts.figure(
            item.number,
            item.counts,
            { ...tall, fontSize: "clamp(4rem, 9vw, 8rem)" },
            at(1 + index * 4, 4, 1),
          ),
        ),
      ],
      { top: 8, bottom: 6 },
    ),
    band(
      "Classes",
      [
        group(
          "Classes title",
          [
            heading("Section title", "Four kinds of class", 2, { base: sectionTitle }),
            link("Classes link", "More about each", "/classes", {
              ...parts.look.detail,
              textDecoration: "underline",
            }),
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
          "Class list",
          courses.map(courseRow),
          {
            base: { gap: "0", borderStyle: "solid", borderColor: ink, borderWidth: "0 0 2px 0" },
          },
          animate("stagger-up", { stagger: 70 }),
        ),
      ],
      {
        top: 6,
        bottom: 9,
        styles: { base: { display: "flex", flexDirection: "column", gap: space(6) } },
      },
    ),
    band(
      "First class",
      [
        heading(
          "Call to try",
          "Your first class is on us.",
          2,
          { base: { ...tall, fontSize: "clamp(3rem, 8vw, 7rem)" } },
          animate("fade-up"),
        ),
        action(
          "Main button",
          "Choose a class",
          "/timetable",
          { background: onLime, text: lime },
          {
            ...parts.look.detail,
            fontSize: "0.875rem",
          },
        ),
      ],
      {
        top: 9,
        bottom: 9,
        colours: { background: lime, text: onLime },
        styles: { base: { display: "flex", flexDirection: "column", gap: space(6) } },
      },
    ),
  ],
};

const timetablePage = {
  slug: "timetable",
  title: "Timetable",
  summary: "The weekly class timetable at Halyard, Woodstock.",
  sections: [
    pageTop({
      label: "This week and every week",
      title: "Timetable",
      text: "Book a place in the app or at the desk. Arrive ten minutes early for your first class so we can say hello.",
    }),
    ...week.map((day, index) =>
      gridBand(
        day.day,
        [
          heading(
            "Day",
            day.day,
            2,
            at(1, 4, 1, { ...tall, fontSize: "clamp(2rem, 4vw, 3.25rem)" }),
          ),
          withStyles(
            {
              type: "table",
              name: `${day.day} classes`,
              props: {
                caption: "",
                headings: ["Time", "Class", "Coach"],
                rows: day.sessions.map((session) => ({
                  cells: [session.time, session.course, session.coach],
                })),
                firstColumnIsHeading: true,
                striped: false,
              },
              animation: animate("fade-up"),
            },
            at(5, 8, 1, { width: "100%" }),
          ),
        ],
        {
          top: 4,
          bottom: index === week.length - 1 ? 9 : 4,
          styles: {
            base: { borderStyle: "solid", borderColor: parts.look.rule, borderWidth: "1px 0 0 0" },
          },
        },
      ),
    ),
  ],
};

const classesPage = {
  slug: "classes",
  title: "Classes",
  summary: "Strength, Flow, Row and Breathe: what each Halyard class is like and who it's for.",
  sections: [
    pageTop({
      label: "Classes",
      title: "Classes",
      text: "Every class is coached and capped at eight. New to all of it? Start with Strength or Flow; both are made for every level.",
    }),
    ...courses.map((course, index) =>
      gridBand(
        course.name,
        [
          image(
            "Picture",
            course.illustration,
            course.alt,
            at(index % 2 === 0 ? 1 : 8, 5, 1),
            animate("mask-reveal-up"),
          ),
          group(
            "About the class",
            [
              heading("Class name", course.name, 2, { base: sectionTitle }),
              label(`${course.length} · ${course.level}`, "Length and level"),
              words("About it", course.text, {
                base: { fontSize: "1.125rem", lineHeight: "1.55" },
              }),
            ],
            at(index % 2 === 0 ? 7 : 1, 5, 1, { alignSelf: "center", gap: space(4) }),
            animate("fade-up", { delay: 100 }),
          ),
        ],
        {
          top: 6,
          bottom: 6,
          styles: {
            base: { borderStyle: "solid", borderColor: parts.look.rule, borderWidth: "1px 0 0 0" },
          },
        },
      ),
    ),
  ],
};

interface Membership {
  name: string;
  price: string;
  text: string;
  includes: string;
  featured: boolean;
}

const memberships: readonly Membership[] = [
  {
    name: "Ten classes",
    price: "R1,450",
    text: "For when life is busy. Use them within three months.",
    includes: "Any ten classes\nFree towel and lockers\nShare with a friend",
    featured: false,
  },
  {
    name: "Unlimited",
    price: "R1,190 a month",
    text: "As many classes as you like. Most members come three times a week.",
    includes:
      "Every class, every day\nA coaching check-in each month\nBring a friend free on Fridays",
    featured: true,
  },
  {
    name: "Twice a week",
    price: "R890 a month",
    text: "Eight classes a month, the rhythm most people keep up.",
    includes: "Eight classes a month\nUnused classes roll over once\nFree towel and lockers",
    featured: false,
  },
];

function membershipBox(membership: Membership): NodeBlueprint {
  const colours = membership.featured
    ? { backgroundColor: lime, color: onLime, borderColor: lime }
    : { borderColor: ink };
  return group(
    "Membership",
    [
      heading("Name", membership.name, 2, {
        base: { ...tall, fontSize: "clamp(2rem, 3.4vw, 3rem)" },
      }),
      words("Price", membership.price, { base: { fontSize: "1.375rem", fontWeight: "700" } }),
      words("About it", membership.text, { base: { lineHeight: "1.55" } }),
      words("What it includes", membership.includes, {
        base: { whiteSpace: "pre-line", lineHeight: "1.9", flexGrow: "1" },
      }),
      action(
        "Join button",
        "Join at the desk or in the app",
        "/timetable",
        membership.featured ? { background: onLime, text: lime } : { background: ink, text: paper },
        { ...parts.look.detail, width: "100%" },
      ),
    ],
    {
      base: {
        gap: space(4),
        paddingTop: space(6),
        paddingBottom: space(6),
        paddingLeft: space(5),
        paddingRight: space(5),
        borderStyle: "solid",
        borderWidth: "2px",
        ...colours,
      },
    },
  );
}

const membershipsPage = {
  slug: "memberships",
  title: "Memberships",
  summary: "Halyard memberships and class packs, with prices. Your first class is free.",
  sections: [
    pageTop({
      label: "First class free",
      title: "Join us",
      text: "No joining fee and no contract: stop or pause any time with a month’s notice. Students and teachers pay 20% less.",
    }),
    band(
      "Memberships",
      [
        group(
          "Memberships",
          memberships.map(membershipBox),
          {
            base: {
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "clamp(0.75rem, 1.6vw, 1.5rem)",
              alignItems: "stretch",
            },
            tablet: { gridTemplateColumns: "minmax(0, 1fr)" },
          },
          animate("stagger-up", { stagger: 90 }),
        ),
      ],
      { top: 2, bottom: 8 },
    ),
    gridBand(
      "Try a class",
      [
        heading("Try title", "Try a class first", 2, at(1, 5, 1, sectionTitle)),
        group(
          "How to try",
          [
            words(
              "How to try",
              "Pick any class on the timetable and email us your name; we’ll keep a place and a mat for you. Wear something you can move in and bring water.",
              { base: { fontSize: "1.125rem", lineHeight: "1.55" } },
            ),
            link("Email", email, `mailto:${email}`, {
              textDecoration: "underline",
              fontSize: "1.25rem",
            }),
          ],
          at(7, 6, 1, { gap: space(4) }),
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

export const halyardSite: StarterSite = {
  id: "halyard",
  name: "Halyard",
  description:
    "A loud, clear site for a studio or gym: classes with pictures on hover, a week's timetable and memberships with prices.",
  suitedTo: "Gyms, yoga and pilates studios, personal trainers",
  coverIllustration: "halyard-cover",
  theme: {
    brandColour: "#17191a",
    accentColour: "#c8f04a",
    fontPairing: "geometric",
    cornerStyle: "square",
    headingFont: "Big Shoulders Display",
    bodyFont: "Archivo",
  },
  designVariables: [limeVariable],
  siteMotion: {
    smoothScroll: { strength: "gentle" },
    cursor: { style: "blend", colour: "#ffffff", size: 36 },
    pageTransition: { style: "zoom", duration: 400 },
    intro: { style: "none" },
  },
  siteSections: { navigation: navigation(), footer: footer() },
  pages: [homePage, timetablePage, classesPage, membershipsPage],
};
