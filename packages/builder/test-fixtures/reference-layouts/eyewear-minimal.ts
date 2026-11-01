import { fluidSize } from "@lintel/builder-model";
import {
  catalogueFont,
  edgeToEdge,
  family,
  media,
  placed,
  referencePage,
} from "./reference-page.js";

/**
 * A minimal product front page: two giant words cropped off the page's edges with the
 * product photo between them, vertical text up the side, and tiny specification text.
 */

const giant = {
  fontFamily: family("inter"),
  fontWeight: "700",
  fontSize: fluidSize(5.5, 23.5),
  lineHeight: "0.78",
  letterSpacing: "-0.055em",
  color: "#0b0b0b",
  whiteSpace: "nowrap",
};

const tiny = {
  fontFamily: family("inter"),
  fontSize: "0.72rem",
  lineHeight: "1.35",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#5d5d58",
};

export const eyewearMinimal = referencePage(
  [catalogueFont("inter")],
  [
    {
      type: "section",
      name: "Front",
      freeLayout: { stackOnPhone: true },
      styles: {
        base: {
          ...edgeToEdge,
          height: "100vh",
          minHeight: "36rem",
          backgroundColor: "#ecebe6",
          overflow: "hidden",
        },
        phone: { height: "auto", paddingLeft: "1rem", paddingRight: "1rem", paddingBottom: "2rem" },
      },
      children: [
        placed(
          {
            type: "navigation",
            name: "Menu",
            props: {
              label: "Main",
              links: [
                { label: "Shop", href: "/shop" },
                { label: "Story", href: "/story" },
                { label: "Search", href: "/search" },
                { label: "Bag", href: "/bag" },
              ],
            },
          },
          { left: 70, top: 3, layer: 4 },
          {
            base: { fontFamily: family("inter"), fontSize: "0.8rem", color: "#77776f" },
            phone: { paddingTop: "1rem" },
          },
        ),
        placed(
          { type: "heading", name: "First word", props: { text: "PURE", level: 1 } },
          { left: -3.5, top: -17, layer: 1 },
          {
            base: giant,
            tablet: { top: "-3%" },
            phone: { marginLeft: "-0.5rem", marginTop: "1rem" },
          },
        ),
        placed(
          {
            type: "image",
            name: "Product",
            props: {
              src: media("sunglasses.svg"),
              alt: "Square sunglasses in smoked black acetate",
            },
          },
          { left: 27, top: 25, width: 45, layer: 2 },
          {
            base: {
              height: "45%",
              objectFit: "cover",
              borderRadius: "0",
              objectPosition: "60% 50%",
            },
            tablet: { left: "22%", width: "56%", height: "30%" },
            phone: { width: "100%", height: "auto", aspectRatio: "16 / 10" },
          },
        ),
        placed(
          { type: "text", name: "Second word", props: { text: "LINES" } },
          { left: 38.5, top: 64, layer: 3 },
          { base: giant, tablet: { top: "52%" }, phone: { marginLeft: "-0.5rem" } },
        ),
        placed(
          { type: "text", name: "Side note", props: { text: "ROME · EST. 1979 · Nº 07" } },
          { left: 0.7, top: 40, layer: 2 },
          {
            base: { ...tiny, color: "#a3a39b", writingMode: "vertical-rl", rotate: "180deg" },
            phone: { writingMode: "horizontal-tb", rotate: "0deg" },
          },
        ),
        placed(
          {
            type: "text",
            name: "Specification",
            props: { text: "Frame / smoked black\nLens / graded grey\nMade by hand" },
          },
          { left: 0.8, top: 70, width: 18, layer: 2 },
          { base: tiny },
        ),
        placed(
          { type: "link", name: "Explore", props: { label: "Explore ↘", href: "/shop" } },
          { left: 0.6, top: 80, layer: 2 },
          { base: { ...tiny, color: "#111111", fontSize: "0.8rem", textDecoration: "none" } },
        ),
        placed(
          {
            type: "text",
            name: "About the frame",
            props: {
              text: "Cut from deep smoke acetate around a hidden steel core, with a softly graded lens. Made to be worn every day.",
            },
          },
          { left: 75.5, top: 25, width: 13, layer: 2 },
          {
            base: { ...tiny, textTransform: "none", letterSpacing: "0.01em", color: "#86867e" },
            tablet: { width: "20%" },
          },
        ),
        placed(
          { type: "link", name: "Range", props: { label: "See the range ↘", href: "/shop" } },
          { left: 75, top: 37, layer: 2 },
          {
            base: { ...tiny, color: "#111111", fontSize: "0.8rem", textDecoration: "none" },
            hover: { textDecoration: "underline" },
          },
        ),
      ],
    },
  ],
);
