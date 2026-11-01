import { fluidSize, type NodeBlueprint } from "@lintel/builder-model";
import {
  catalogueFont,
  edgeToEdge,
  family,
  media,
  placed,
  referencePage,
} from "./reference-page.js";

/**
 * A bold agency page: condensed display type, a photo seen through a diagonal cut in a
 * letter, gradient-filled words, a team cut out of their photo breaking out of a card, tilted
 * stacked photo cards around a testimonial, and a person cut out in front of giant type.
 */

const deepGreen = "#17461b";
const display = {
  fontFamily: family("anton"),
  fontWeight: "400",
  lineHeight: "0.92",
  textTransform: "uppercase",
  color: deepGreen,
};
const body = {
  fontFamily: family("dm-sans"),
  fontSize: "0.95rem",
  lineHeight: "1.45",
  color: "#2c4a2a",
};

/** Light streaks over pale green, as on a sunlit wall. */
const sunlitWall = {
  backgroundColor: "#c8ecaf",
  backgroundImage:
    "linear-gradient(118deg, rgb(255 255 255 / 0) 30%, rgb(255 255 255 / 0.4) 38%, rgb(255 255 255 / 0) 46%, rgb(255 255 255 / 0) 62%, rgb(255 255 255 / 0.3) 70%, rgb(255 255 255 / 0) 78%), linear-gradient(180deg, #d6f3c0 0%, #b9e49c 100%)",
};

function card(
  file: string,
  place: { left: number; top: number; layer: number },
  turn: string,
): NodeBlueprint {
  return placed(
    { type: "image", name: "Portrait", props: { src: media(file), alt: "" } },
    { ...place, width: 11 },
    {
      base: {
        aspectRatio: "4 / 5",
        objectFit: "cover",
        borderRadius: "14px",
        boxShadow: "0 12px 28px rgb(0 0 0 / 0.25)",
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: "#ffffff",
        rotate: turn,
      },
      hover: { rotate: "0deg", scale: "1.05" },
      phone: { display: "none" },
    },
  );
}

const roundButton = (label: string, href: string, filled: boolean): NodeBlueprint => ({
  type: "button",
  name: label,
  props: { label: filled ? "→" : "←", href },
  styles: {
    base: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "2.25rem",
      height: "2.25rem",
      paddingTop: "0",
      paddingBottom: "0",
      paddingLeft: "0",
      paddingRight: "0",
      borderRadius: "999px",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: deepGreen,
      backgroundColor: filled ? deepGreen : "transparent",
      color: filled ? "#ffffff" : deepGreen,
      textDecoration: "none",
    },
  },
});

export const agencyBold = referencePage(
  [catalogueFont("anton"), catalogueFont("dm-sans")],
  [
    {
      type: "section",
      name: "Hero",
      freeLayout: { stackOnPhone: true },
      styles: {
        base: {
          ...edgeToEdge,
          height: "88vh",
          minHeight: "34rem",
          overflow: "hidden",
          backgroundColor: "#123d18",
          backgroundImage:
            "radial-gradient(circle, rgb(40 110 45 / 0.9) 0%, rgb(18 61 24 / 0) 70%), linear-gradient(160deg, #1d5a24 0%, #0d2e11 100%)",
        },
        phone: { height: "auto", paddingLeft: "1rem", paddingRight: "1rem", paddingBottom: "2rem" },
      },
      children: [
        placed(
          { type: "image", name: "Eyes", props: { src: media("eyes-photo.svg"), alt: "" } },
          { left: 26, top: 0, width: 36, layer: 1 },
          {
            base: {
              height: "50%",
              objectFit: "cover",
              borderRadius: "0",
              clipPath: "polygon(16% 100%, 30% 22%, 100% 0%, 82% 58%)",
              filter: "saturate(80%) contrast(110%)",
            },
            phone: { width: "100%", height: "auto", aspectRatio: "16 / 9" },
          },
        ),
        placed(
          {
            type: "text",
            name: "Intro",
            props: { text: "We build brands that people notice, remember and come back to." },
          },
          { left: 1.6, top: 32, width: 22, layer: 2 },
          { base: { ...body, color: "#e3f5dc", fontSize: "0.9rem" } },
        ),
        placed(
          { type: "text", name: "Verbs", props: { text: "THINK\nMAKE\nLAUNCH" } },
          { left: 83, top: 30, layer: 2 },
          {
            base: {
              fontFamily: family("dm-sans"),
              fontStyle: "italic",
              fontWeight: "700",
              fontSize: "1.05rem",
              lineHeight: "1.25",
              color: "#ffffff",
            },
          },
        ),
        placed(
          { type: "heading", name: "Bold", props: { text: "BOLD", level: 1 } },
          { left: 0, top: 51, layer: 2 },
          {
            base: {
              ...display,
              fontSize: fluidSize(5, 15.5),
              color: "#ffffff",
              lineHeight: "0.86",
            },
          },
        ),
        // The photo again, seen through a diagonal cut across the O.
        placed(
          { type: "image", name: "Cut in the O", props: { src: media("eyes-photo.svg"), alt: "" } },
          { left: 6.5, top: 57, width: 7.5, layer: 3 },
          {
            base: {
              height: "25%",
              objectFit: "cover",
              objectPosition: "38% 45%",
              borderRadius: "0",
              clipPath: "polygon(62% 0%, 86% 0%, 38% 100%, 14% 100%)",
            },
            tablet: { top: "53%", height: "14%" },
            phone: { display: "none" },
          },
        ),
        placed(
          { type: "text", name: "Moves", props: { text: "MOVES" } },
          { left: 33.5, top: 51, layer: 2 },
          {
            base: {
              ...display,
              fontSize: fluidSize(5, 15.5),
              lineHeight: "0.86",
              backgroundImage: "linear-gradient(180deg, #4cc63a 0%, #2a9a22 100%)",
              backgroundClip: "text",
              color: "transparent",
            },
          },
        ),
      ],
    },
    {
      type: "section",
      name: "About",
      styles: {
        base: {
          ...sunlitWall,
          paddingTop: "5rem",
          paddingBottom: "5rem",
          paddingLeft: "2rem",
          paddingRight: "2rem",
          overflow: "hidden",
        },
      },
      children: [
        {
          type: "box",
          name: "About grid",
          styles: {
            base: {
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gridTemplateAreas: '"words crew"',
              gap: "4rem",
              alignItems: "end",
            },
            phone: { gridTemplateColumns: "minmax(0, 1fr)", gridTemplateAreas: '"crew" "words"' },
          },
          children: [
            {
              type: "box",
              name: "Words",
              styles: {
                base: { gridArea: "words", display: "flex", flexDirection: "column", gap: "1rem" },
              },
              children: [
                {
                  type: "text",
                  name: "Kicker",
                  props: { text: "ABOUT US" },
                  styles: {
                    base: { ...body, fontStyle: "italic", fontWeight: "700", color: deepGreen },
                  },
                },
                {
                  type: "heading",
                  name: "Crew title",
                  props: { text: "OUR CREW", level: 2 },
                  styles: { base: { ...display, fontSize: fluidSize(3.5, 7.5) } },
                },
                {
                  type: "text",
                  name: "Crew text",
                  props: {
                    text: "Thanks for stopping by. We turn ideas into pictures, words and products people can feel, and we do it with the people who will use them.",
                  },
                  styles: { base: body },
                },
                {
                  type: "heading",
                  name: "Aim",
                  props: { text: "What we aim for", level: 3 },
                  styles: {
                    base: { ...body, fontSize: "1.3rem", fontWeight: "500", marginTop: "1rem" },
                  },
                },
                {
                  type: "text",
                  name: "Aim text",
                  props: { text: "Clear work that tells a brand’s story with warmth and nerve." },
                  styles: { base: body },
                },
                {
                  type: "divider",
                  name: "Line",
                  styles: {
                    base: {
                      borderColor: "#5f8f57",
                      borderStyle: "solid",
                      borderWidth: "1px 0 0 0",
                      width: "100%",
                    },
                  },
                },
                {
                  type: "heading",
                  name: "Hope",
                  props: { text: "What we hope for", level: 3 },
                  styles: { base: { ...body, fontSize: "1.3rem", fontWeight: "500" } },
                },
                {
                  type: "text",
                  name: "Hope text",
                  props: { text: "Clients who leave braver than they arrived." },
                  styles: { base: body },
                },
              ],
            },
            {
              type: "box",
              name: "Crew card",
              freeLayout: { stackOnPhone: false },
              styles: {
                base: {
                  gridArea: "crew",
                  height: "30rem",
                  backgroundImage: "linear-gradient(170deg, #2a8a34 0%, #16591d 100%)",
                  borderRadius: "18px",
                  justifySelf: "stretch",
                },
                phone: { height: "22rem" },
              },
              children: [
                placed(
                  {
                    type: "image",
                    name: "Crew",
                    props: {
                      src: media("crew-cutout.svg"),
                      alt: "Three people from the studio, smiling",
                    },
                  },
                  { left: -15, top: -50, width: 130 },
                  {
                    base: {
                      height: "150%",
                      maxWidth: "none",
                      objectFit: "contain",
                      objectPosition: "50% 100%",
                      borderRadius: "0",
                    },
                  },
                ),
              ],
            },
          ],
        },
      ],
    },
    {
      type: "section",
      name: "Voices",
      styles: {
        base: {
          ...sunlitWall,
          paddingTop: "2rem",
          paddingBottom: "4rem",
          paddingLeft: "2rem",
          paddingRight: "2rem",
          textAlign: "center",
        },
      },
      children: [
        {
          type: "text",
          name: "Label",
          props: {
            text: "STUDIO NOTES  09",
            marks: [
              { from: 14, to: 16, styles: { fontStyle: "italic", fontFamily: family("dm-sans") } },
            ],
          },
          styles: { base: { ...display, fontSize: "2.5rem", opacity: "0.25", textAlign: "left" } },
        },
        {
          type: "heading",
          name: "Keep in touch",
          props: { text: "KEEP\nIN TOUCH", level: 2 },
          styles: {
            base: {
              ...display,
              fontSize: fluidSize(3.25, 6.5),
              marginTop: "3rem",
              textWrap: "balance",
            },
          },
        },
        {
          type: "link",
          name: "Subscribe",
          props: { label: "Subscribe now  ↘", href: "/subscribe" },
          styles: {
            base: {
              ...body,
              display: "inline-block",
              width: "16rem",
              marginTop: "1.5rem",
              paddingBottom: "0.4rem",
              borderStyle: "solid",
              borderColor: deepGreen,
              borderWidth: "0 0 1px 0",
              textDecoration: "none",
              textAlign: "left",
            },
          },
        },
        {
          type: "box",
          name: "Testimonial",
          freeLayout: { stackOnPhone: true },
          styles: { base: { height: "20rem", marginTop: "3rem" }, phone: { height: "auto" } },
          children: [
            card("portrait-1.svg", { left: 1, top: 2, layer: 1 }, "0deg"),
            card("portrait-2.svg", { left: 8, top: 26, layer: 2 }, "-9deg"),
            placed(
              {
                type: "quote",
                name: "Words from a client",
                props: {
                  text: "They changed how people see us. Every idea came with a reason, every detail with care, and the whole team still talks about the launch.",
                  citation: "Ines Calloway, Northlight Studio",
                },
              },
              { left: 30, top: 10, width: 40 },
              { base: { ...body, fontSize: "1rem" }, phone: { width: "100%" } },
            ),
            placed(
              {
                type: "box",
                name: "Arrows",
                props: { element: "div" },
                children: [roundButton("Previous", "#", false), roundButton("Next", "#", true)],
              },
              { left: 45, top: 72 },
              {
                base: { display: "flex", flexDirection: "row", gap: "0.75rem" },
                phone: { justifyContent: "center" },
              },
            ),
            card("portrait-3.svg", { left: 88, top: 0, layer: 1 }, "0deg"),
            card("portrait-4.svg", { left: 80, top: 28, layer: 2 }, "8deg"),
          ],
        },
      ],
    },
    {
      type: "section",
      name: "Closing",
      freeLayout: { stackOnPhone: true },
      styles: {
        base: { ...sunlitWall, ...edgeToEdge, height: "26rem", overflow: "hidden" },
        phone: { height: "auto", paddingLeft: "1rem", paddingRight: "1rem", paddingBottom: "2rem" },
      },
      children: [
        placed(
          { type: "heading", name: "Human", props: { text: "HUMAN", level: 2 } },
          { left: 2, top: 6, layer: 1 },
          { base: { ...display, fontSize: fluidSize(4, 10) } },
        ),
        placed(
          { type: "text", name: "Made", props: { text: "MADE TO MATTER" } },
          { left: 2, top: 46, layer: 1 },
          {
            base: { ...display, fontSize: fluidSize(4, 10), whiteSpace: "nowrap" },
            phone: { whiteSpace: "normal" },
          },
        ),
        placed(
          {
            type: "image",
            name: "Person in front",
            props: { src: media("head-cutout.svg"), alt: "" },
          },
          { left: 33, top: 30, width: 20, layer: 2 },
          {
            base: { borderRadius: "0", filter: "drop-shadow(0 10px 18px rgb(0 0 0 / 0.25))" },
            phone: { display: "none" },
          },
        ),
        placed(
          {
            type: "text",
            name: "Closing words",
            props: {
              text: "Guiding your next step with ideas made for you, and people who care how it turns out.",
            },
          },
          { left: 72, top: 10, width: 22, layer: 2 },
          { base: { ...body, textAlign: "left" } },
        ),
      ],
    },
  ],
);
