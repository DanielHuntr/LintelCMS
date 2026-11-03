import type { NodeBlueprint } from "../components/component-definition.js";
import type { StyleDeclarations } from "../document/page-document.schema.js";
import {
  animate,
  button,
  buttonRow,
  colour,
  container,
  eyebrow,
  heading,
  illustration,
  lead,
  link,
  section,
  space,
  text,
} from "./section-parts.js";

/**
 * More ways to open a page: an editorial intro, one with a big number, one with a video,
 * one in very big type and one over a wide picture; and two invitations, split and with a
 * newsletter sign-up. Built only from theme tokens, so each follows the site's colours,
 * fonts and corners in light and dark, and stacks in reading order on phones.
 */

export interface PackLink {
  label: string;
  href: string;
}

const tight: StyleDeclarations = { marginTop: "0", marginBottom: "0" };
const quiet: StyleDeclarations = { color: colour("text-secondary") };
const ruleAbove: StyleDeclarations = {
  borderStyle: "solid",
  borderWidth: "1px 0 0 0",
  borderColor: colour("border"),
};

/** Two columns at a ratio; on phones one under the other. */
function columns(
  name: string,
  children: NodeBlueprint[],
  ratio: string,
  styles: StyleDeclarations = {},
): NodeBlueprint {
  return {
    type: "columns",
    name,
    styles: {
      base: { display: "grid", gridTemplateColumns: ratio, gap: space(7), ...styles },
      phone: { gridTemplateColumns: "minmax(0, 1fr)", gap: space(5) },
    },
    children,
  };
}

function box(name: string, children: NodeBlueprint[], styles: StyleDeclarations): NodeBlueprint {
  return { type: "box", name, styles: { base: styles }, children };
}

/** A label and a big title on the left, the introduction and a link set lower on the right. */
export function editorialHero(copy: {
  label: string;
  heading: string;
  text: string;
  more: PackLink;
}): NodeBlueprint {
  return section("Editorial intro", [
    container([
      columns(
        "Intro columns",
        [
          box(
            "Title",
            [
              eyebrow(copy.label),
              heading(copy.heading, 1, {
                name: "Hero title",
                styles: {
                  base: {
                    ...tight,
                    fontSize: "clamp(2.5rem, 6.5vw, 5.5rem)",
                    lineHeight: "1",
                    letterSpacing: "-0.03em",
                  },
                },
                animation: animate("words-rise"),
              }),
            ],
            { display: "flex", flexDirection: "column", gap: space(4) },
          ),
          box(
            "Introduction",
            [
              lead(copy.text, { animation: animate("fade-up", { delay: 250 }) }),
              link(copy.more.label, copy.more.href),
            ],
            {
              display: "flex",
              flexDirection: "column",
              gap: space(4),
              alignSelf: "end",
              paddingTop: space(4),
              ...ruleAbove,
            },
          ),
        ],
        "minmax(0, 7fr) minmax(0, 4fr)",
      ),
    ]),
  ]);
}

/** The welcome on the left and one big number on the right, with a caption under it. */
export function bigNumberHero(copy: {
  heading: string;
  text: string;
  primary: PackLink;
  number: string;
  caption: string;
}): NodeBlueprint {
  return section("Intro with a number", [
    container([
      columns(
        "Intro columns",
        [
          box(
            "Welcome",
            [
              heading(copy.heading, 1, {
                name: "Hero title",
                styles: {
                  base: { ...tight, fontSize: "clamp(2.25rem, 5vw, 4rem)", lineHeight: "1.05" },
                },
                animation: animate("fade-up"),
              }),
              lead(copy.text),
              buttonRow([button(copy.primary.label, copy.primary.href)]),
            ],
            { display: "flex", flexDirection: "column", gap: space(5) },
          ),
          box(
            "Big number",
            [
              text(copy.number, {
                name: "Number",
                styles: {
                  base: {
                    fontFamily: "var(--lintel-font-heading)",
                    fontSize: "clamp(5rem, 16vw, 12rem)",
                    fontWeight: "700",
                    lineHeight: "0.85",
                    letterSpacing: "-0.05em",
                    color: colour("brand"),
                  },
                },
                animation: animate("mask-reveal-up", { delay: 200 }),
              }),
              text(copy.caption, { name: "Caption", styles: { base: quiet } }),
            ],
            {
              display: "flex",
              flexDirection: "column",
              gap: space(2),
              alignSelf: "end",
              paddingTop: space(4),
              ...ruleAbove,
            },
          ),
        ],
        "minmax(0, 3fr) minmax(0, 2fr)",
        { alignItems: "end" },
      ),
    ]),
  ]);
}

/** A centred welcome over a wide video: paste a YouTube or Vimeo link to show it. */
export function videoHero(copy: {
  heading: string;
  text: string;
  primary: PackLink;
  videoTitle: string;
}): NodeBlueprint {
  return section("Intro with video", [
    container(
      [
        heading(copy.heading, 1, {
          name: "Hero title",
          styles: {
            base: { ...tight, fontSize: "clamp(2.25rem, 5vw, 4rem)", lineHeight: "1.05" },
          },
          animation: animate("words-rise"),
        }),
        lead(copy.text, { styles: { base: { fontSize: "1.25rem", maxWidth: "36rem" } } }),
        buttonRow([button(copy.primary.label, copy.primary.href)], true),
        {
          type: "video",
          name: "Video",
          props: {
            source: "youtube",
            url: "",
            title: copy.videoTitle,
            poster: "",
            shape: "16:9",
            autoplayMuted: false,
            loop: false,
            captionsUrl: "",
          },
          styles: {
            base: {
              width: "100%",
              marginTop: space(5),
              borderRadius: "var(--lintel-radius-large)",
              overflow: "hidden",
            },
          },
          animation: animate("scale-in", { delay: 300 }),
        },
      ],
      { centred: true, width: "60rem" },
    ),
  ]);
}

/** One line in very big type, edge to edge, with a short line and a link under it. */
export function bigTypeHero(copy: {
  heading: string;
  text: string;
  more: PackLink;
}): NodeBlueprint {
  return section(
    "Big type intro",
    [
      container(
        [
          heading(copy.heading, 1, {
            name: "Hero title",
            styles: {
              base: {
                ...tight,
                fontSize: "clamp(3.25rem, 12vw, 10.5rem)",
                lineHeight: "0.88",
                letterSpacing: "-0.055em",
              },
            },
            animation: animate("letters-fade"),
          }),
          columns(
            "Under the title",
            [
              text(copy.text, {
                name: "Introduction",
                styles: { base: { fontSize: "1.125rem", lineHeight: "1.5", maxWidth: "28rem" } },
                animation: animate("fade-up", { delay: 400 }),
              }),
              box("Link", [link(copy.more.label, copy.more.href)], {
                justifySelf: "end",
                alignSelf: "end",
              }),
            ],
            "minmax(0, 1fr) auto",
            { paddingTop: space(4), ...ruleAbove },
          ),
        ],
        { width: "90rem", gap: 6 },
      ),
    ],
    { padding: 9 },
  );
}

/** A short title and line, then a wide picture with a small caption under it. */
export function widePictureHero(copy: {
  label: string;
  heading: string;
  picture: { name: string; alt: string };
  caption: string;
}): NodeBlueprint {
  return section("Intro with a wide picture", [
    container([
      eyebrow(copy.label),
      heading(copy.heading, 1, {
        name: "Hero title",
        styles: {
          base: {
            ...tight,
            fontSize: "clamp(2.25rem, 5vw, 4rem)",
            lineHeight: "1.05",
            maxWidth: "48rem",
          },
        },
        animation: animate("fade-up"),
      }),
      illustration(copy.picture.name, copy.picture.alt, {
        name: "Wide picture",
        styles: {
          base: {
            width: "100%",
            height: "auto",
            aspectRatio: "21 / 9",
            objectFit: "cover",
            borderRadius: "var(--lintel-radius-large)",
          },
          phone: { aspectRatio: "4 / 3" },
        },
        animation: animate("mask-reveal-up", { delay: 200 }),
      }),
      text(copy.caption, {
        name: "Caption",
        styles: { base: { ...quiet, fontSize: "0.875rem" } },
      }),
    ]),
  ]);
}

/** A panel split in two: the invitation on the left, a picture on the right. */
export function splitInvitation(copy: {
  heading: string;
  text: string;
  button: PackLink;
  picture: { name: string; alt: string };
}): NodeBlueprint {
  return section("Split call to action", [
    container([
      {
        type: "columns",
        name: "Invitation panel",
        styles: {
          base: {
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            alignItems: "stretch",
            borderRadius: "var(--lintel-radius-large)",
            overflow: "hidden",
            backgroundColor: colour("brand"),
            color: colour("on-brand"),
          },
          phone: { gridTemplateColumns: "minmax(0, 1fr)" },
        },
        animation: animate("fade-up"),
        children: [
          box(
            "Words",
            [
              heading(copy.heading, 2, { styles: { base: { ...tight, color: "inherit" } } }),
              text(copy.text),
              button(copy.button.label, copy.button.href, "inverse"),
            ],
            {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: space(4),
              paddingTop: space(7),
              paddingBottom: space(7),
              paddingLeft: space(7),
              paddingRight: space(7),
            },
          ),
          illustration(copy.picture.name, copy.picture.alt, {
            name: "Picture",
            styles: {
              base: {
                width: "100%",
                height: "100%",
                minHeight: "16rem",
                objectFit: "cover",
                borderRadius: "0",
              },
            },
          }),
        ],
      },
    ]),
  ]);
}

/** A slim band with a newsletter sign-up beside a line about what people will get. */
export function newsletterStrip(copy: {
  heading: string;
  text: string;
  buttonLabel: string;
}): NodeBlueprint {
  return section(
    "Newsletter strip",
    [
      container([
        columns(
          "Newsletter columns",
          [
            box("Words", [heading(copy.heading, 2, { styles: { base: tight } }), text(copy.text)], {
              display: "flex",
              flexDirection: "column",
              gap: space(2),
            }),
            {
              type: "newsletterSignup",
              name: "Sign-up",
              props: {
                form: "",
                title: "",
                text: "",
                emailLabel: "Email address",
                buttonLabel: copy.buttonLabel,
              },
              animation: animate("fade-in", { delay: 150 }),
            },
          ],
          "minmax(0, 1fr) minmax(0, 1fr)",
          { alignItems: "center" },
        ),
      ]),
    ],
    { tone: "panel", padding: 7 },
  );
}
