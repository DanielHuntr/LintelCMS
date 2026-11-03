/**
 * The words for plugins in the admin: section tabs and plugin screens. (Build → Features
 * uses the `features.*` strings in strings.ts.)
 * Spread into `strings.ts`, so they are used through `t()` like every other string.
 * (A plugin's own words live in the plugin, through `createTranslator`.)
 */
export const pluginStrings = {
  "plugins.overviewTab": "Overview",
  "plugins.sectionTabsLabel": "Views",
  "plugins.notFoundTitle": "Page not found",
  "plugins.notFoundHeading": "There’s nothing at this address",
  "plugins.notFoundDescription":
    "The link may be out of date, or the feature it belongs to may be switched off.",
  "plugins.backToDashboard": "Go to the dashboard",
} as const;
