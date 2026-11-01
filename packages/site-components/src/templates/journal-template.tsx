import { defaultTheme } from "../theme/theme.js";
import { renderStandardView } from "./render-standard-view.js";
import type { SiteTemplate } from "./site-template.js";

/** "Journal": a blog. A centred masthead, serif type and posts as a reading list. */
export const journalTemplate: SiteTemplate = {
  id: "journal",
  name: "Journal",
  description: "A calm, reading-first blog with elegant serif type.",
  defaultTheme: {
    ...defaultTheme,
    brandColour: "#b4441f",
    accentColour: "#8a5a12",
    fontPairing: "editorial",
    cornerStyle: "square",
  },
  headerLayout: "masthead",
  renderView: (props) => renderStandardView(props, { cardLayout: "row" }),
};
