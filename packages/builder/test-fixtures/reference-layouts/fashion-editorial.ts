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
 * An editorial fashion front page: viewport-filling words with a photo card laid over them
 * and a cut-out figure behind, a turned script sticker, italic letters inside upright
 * words, and links in brackets. One free-layout section, stacked on phones.
 */

const giant = {
  fontFamily: family("archivo"),
  fontWeight: "700",
  fontSize: fluidSize(4.5, 11),
  lineHeight: "0.82",
  letterSpacing: "-0.03em",
  color: "#0d0d0d",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

/** The thin italic letters inside the big words. */
const thinItalic = { fontStyle: "italic", fontWeight: "400" } as const;

const small = {
  fontFamily: family("archivo"),
  fontSize: "0.8125rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#0d0d0d",
};

function word(name: string, text: string, marks: Array<{ from: number; to: number }>) {
  return {
    type: "text",
    name,
    props: { text, marks: marks.map((mark) => ({ ...mark, styles: thinItalic })) },
  } satisfies NodeBlueprint;
}

const menu = (label: string, links: Array<[string, string]>) =>
  ({
    type: "navigation",
    name: label,
    props: { label, links: links.map(([text, href]) => ({ label: text, href })) },
    styles: { base: { ...small } },
  }) satisfies NodeBlueprint;

export const fashionEditorial = referencePage(
  [catalogueFont("archivo"), catalogueFont("yellowtail")],
  [
    {
      type: "section",
      name: "Front",
      freeLayout: { stackOnPhone: true },
      styles: {
        base: {
          ...edgeToEdge,
          height: "100vh",
          minHeight: "40rem",
          backgroundColor: "#a9a9a9",
          overflow: "hidden",
        },
        phone: { height: "auto", paddingLeft: "1rem", paddingRight: "1rem", paddingBottom: "2rem" },
      },
      children: [
        placed(
          {
            type: "box",
            name: "Top bar",
            props: { element: "header" },
            children: [
              menu("Shop", [
                ["Collection", "/collection"],
                ["Journal", "/journal"],
              ]),
              {
                type: "text",
                name: "Mark",
                props: { text: "M — RO" },
                styles: {
                  base: {
                    ...small,
                    fontSize: "1.25rem",
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                  },
                },
              },
              menu("Account", [
                ["[Menu]", "/menu"],
                ["Bag (0)", "/bag"],
              ]),
            ],
          },
          { left: 1.2, top: 2.2, width: 97.6, layer: 6 },
          {
            base: {
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            },
            phone: { width: "100%", paddingTop: "1rem", paddingBottom: "1.5rem" },
          },
        ),
        placed(
          {
            type: "image",
            name: "Figure behind",
            props: { src: media("coat-figure.svg"), alt: "" },
          },
          { left: 36, top: 6, width: 36, layer: 1 },
          {
            base: { height: "112%", objectFit: "cover", borderRadius: "0" },
            phone: { display: "none" },
          },
        ),
        placed(
          word("Move", "MOVE", [{ from: 2, to: 3 }]),
          { left: 0.8, top: 13, layer: 2 },
          {
            base: giant,
          },
        ),
        placed(
          word("As", "AS", [{ from: 1, to: 2 }]),
          { left: 61.5, top: 13, layer: 2 },
          {
            base: giant,
          },
        ),
        placed(
          word("You", "YOU", [{ from: 1, to: 3 }]),
          { left: 70.5, top: 34, layer: 2 },
          {
            base: giant,
            tablet: { left: "66%" },
          },
        ),
        placed(word("Are", "ARE", []), { left: 0.8, top: 78, layer: 2 }, { base: giant }),
        placed(
          {
            type: "image",
            name: "Photo",
            props: {
              src: media("portrait-card.svg"),
              alt: "A model in a striped jumper and a green vest",
            },
          },
          { left: 29, top: 24, width: 38, layer: 3 },
          {
            base: { height: "50%", objectFit: "cover", borderRadius: "0" },
            phone: { width: "100%", height: "auto", aspectRatio: "4 / 3", marginTop: "1rem" },
          },
        ),
        placed(
          { type: "text", name: "Sticker", props: { text: "New season" } },
          { left: 21, top: 45, layer: 4 },
          {
            base: {
              fontFamily: family("yellowtail"),
              fontSize: fluidSize(2.75, 8.5),
              lineHeight: "1",
              color: "#d71920",
              textStroke: "2px #111111",
              textShadow: "5px 5px 0 #111111",
              rotate: "-17deg",
              whiteSpace: "nowrap",
            },
            hover: { rotate: "-12deg" },
            phone: { marginTop: "-3.5rem", textAlign: "center" },
          },
        ),
        placed(
          {
            type: "text",
            name: "Since",
            props: {
              text: "SINCE 2019",
              marks: [{ from: 6, to: 10, styles: { fontStyle: "italic", fontWeight: "400" } }],
            },
          },
          { left: 11.5, top: 48, layer: 2 },
          { base: { ...small, fontSize: "1.05rem", fontWeight: "700", letterSpacing: "0" } },
        ),
        placed(
          {
            type: "text",
            name: "Statement",
            props: { text: "We make clothes for people who dress for themselves and nobody else." },
          },
          { left: 72.6, top: 63, width: 22, layer: 2 },
          {
            base: {
              fontFamily: family("archivo"),
              fontSize: "1.2rem",
              fontWeight: "700",
              lineHeight: "1.08",
              textTransform: "uppercase",
              color: "#0d0d0d",
            },
            tablet: { width: "26%", fontSize: "1rem" },
          },
        ),
        placed(
          {
            type: "link",
            name: "Collection link",
            props: { label: "[ See the collection ]", href: "/collection" },
          },
          { left: 72.6, top: 79.5, layer: 2 },
          {
            base: { ...small, textDecoration: "none", color: "#0d0d0d" },
            hover: { textDecoration: "underline" },
          },
        ),
      ],
    },
  ],
);
