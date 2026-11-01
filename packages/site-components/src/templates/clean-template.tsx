import { defaultTheme } from "../theme/theme.js";
import { renderStandardView } from "./render-standard-view.js";
import type { SiteTemplate } from "./site-template.js";

/** "Clean": a business site. A slim header bar, big centred headings, posts as cards. */
export const cleanTemplate: SiteTemplate = {
  id: "clean",
  name: "Clean",
  description: "A crisp business site with bold headings and plenty of room.",
  defaultTheme: { ...defaultTheme, fontPairing: "system", cornerStyle: "soft" },
  headerLayout: "bar",
  renderView: (props) => renderStandardView(props, { cardLayout: "card" }),
};
