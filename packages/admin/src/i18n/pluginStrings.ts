/**
 * The words for plugins in the admin: Settings → Features, section tabs and plugin screens.
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

  "featureSettings.title": "Features",
  "featureSettings.subtitle":
    "Switch on the parts of Lintel your site needs. Switching one off hides it, and keeps everything it made for when you switch it back on.",
  "featureSettings.settingsTitle": "Features",
  "featureSettings.settingsDescription": "Blog, shop, forms and other optional parts",
  "featureSettings.beta": "Beta",
  "featureSettings.builtInHeader": "Built into Lintel",
  "featureSettings.installedHeader": "Added by your developer",
  "featureSettings.installedFooter":
    "These come from packages listed in lintel.config.ts. They run with full access to your site, so only add ones you trust.",
  "featureSettings.version": "Version {version}",
  "featureSettings.loading": "Loading features…",
  "featureSettings.switchedOn": "{name} is on.",
  "featureSettings.switchedOff": "{name} is off. Nothing it made has been deleted.",
  "featureSettings.readOnly":
    "Only an admin who can change settings can switch features on or off.",
} as const;
