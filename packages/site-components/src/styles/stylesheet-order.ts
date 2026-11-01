/**
 * The component stylesheets, in the order they are joined into one `site.css`. Shared
 * foundations come first and templates last, so a template's adjustments win.
 */
export const stylesheetFiles = [
  "base.css",
  "layout.css",
  "buttons.css",
  "header.css",
  "footer.css",
  "hero.css",
  "prose.css",
  "sections.css",
  "faq.css",
  "posts.css",
  "templates.css",
] as const;
