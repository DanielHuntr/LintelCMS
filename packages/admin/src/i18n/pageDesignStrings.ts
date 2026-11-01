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
  "pageDesign.card.emptyTitle": "This page has no design yet",
  "pageDesign.card.emptyDescription":
    "Start from a template, a ready-made section or a blank page. You can change everything afterwards.",
  "pageDesign.card.start": "Start from a template or section",
  "pageDesign.card.startDesigning": "Start designing",
  "pageDesign.card.opening": "Opening…",
  "pageDesign.card.nameFirst": "Give the page a title, then press Return or Start designing.",
  "pageDesign.simpleSections.title": "Simple sections (no design)",
  "pageDesign.simpleSections.description":
    "Build the page from a form instead of designing it. The website shows these only while the page has no design.",
  "pageDesign.simpleSections.unused": "Not used",
  "pageDesign.simpleSections.count.one": "{count} section",
  "pageDesign.simpleSections.count.other": "{count} sections",
} as const;
