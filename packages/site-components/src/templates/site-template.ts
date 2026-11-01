import type { ReactNode } from "react";
import type { HeaderLayout } from "../chrome/Header.js";
import type { SiteChrome, SiteLabels } from "../site.types.js";
import type { SiteTheme } from "../theme/theme.js";
import type { SiteView } from "./view.types.js";

/** What a template is given to draw the inside of `<main>` for one page. */
export interface TemplateViewProps {
  view: SiteView;
  chrome: SiteChrome;
  labels: SiteLabels;
}

/**
 * A template: a look for the whole site. It chooses a default theme and a header, and
 * draws each kind of page. Templates are listed in `templates.ts`; a custom one is any
 * object of this shape (see "How Lintel renders sites" in the docs).
 */
export interface SiteTemplate {
  /** Saved in Settings, Site. Lowercase letters and dashes. */
  id: string;
  name: string;
  /** One plain sentence for the template picker. */
  description: string;
  /** The theme a site starts with when it picks this template. */
  defaultTheme: SiteTheme;
  headerLayout: HeaderLayout;
  /** Extra CSS, added after the shared component styles. */
  stylesheet?: string;
  renderView: (props: TemplateViewProps) => ReactNode;
}
