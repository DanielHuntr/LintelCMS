import { builderStrings } from "@lintel/builder/strings";

/**
 * The words for page designs: the visual builder's own list (from `@lintel/builder`), and the
 * admin's screens around it. `strings.ts` spreads them in, so they are used through `t()`.
 */
export const pageDesignStrings = {
  ...builderStrings,
  "pageDesign.field.empty": "Not designed yet. Start from a ready-made section, or from scratch.",
  "pageDesign.field.summary.one": "{count} section on this page",
  "pageDesign.field.summary.other": "{count} sections on this page",
  "pageDesign.field.edit": "Edit design",
  "pageDesign.field.saveFirst":
    "Give the entry a title first. Once it’s saved as a draft, you can design it.",
  "pageDesign.loading": "Opening the page builder…",
  "pageDesign.back": "Back to {title}",
  "pageDesign.untitled": "Untitled",
  "pageDesign.notAPageField": "This entry has no page design called “{field}”.",
  "pageDesign.unreadable": "This page design can’t be opened: {problem}",
  "pageDesign.publish": "Publish",
  "pageDesign.publishing": "Publishing…",
  "pageDesign.published": "Published",
  "pageDesign.pickImage": "Choose a picture for {label}",
} as const;
