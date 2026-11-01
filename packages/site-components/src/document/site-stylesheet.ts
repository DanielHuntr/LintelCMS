import { readFileSync } from "node:fs";
import { stylesheetFiles } from "../styles/stylesheet-order.js";
import type { SiteTemplate } from "../templates/site-template.js";
import { themeStylesheet } from "../theme/theme-stylesheet.js";
import type { SiteTheme } from "../theme/theme.js";

const stylesFolder = new URL("../styles/", import.meta.url);

let componentStyles: string | undefined;

/** Every component's styles joined in order, read once from the CSS files beside this one. */
export function componentStylesheet(): string {
  componentStyles ??= stylesheetFiles
    .map((file) => readFileSync(new URL(file, stylesFolder), "utf8"))
    .join("\n");
  return componentStyles;
}

/** The whole stylesheet for a site: its theme's tokens, the components, then the template. */
export function siteStylesheet(theme: SiteTheme, template: SiteTemplate): string {
  return [themeStylesheet(theme), componentStylesheet(), template.stylesheet ?? ""]
    .filter((part) => part !== "")
    .join("\n\n");
}
