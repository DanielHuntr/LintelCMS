/**
 * The words for running several sites from one Lintel: Build → Websites and domains, the site switcher,
 * "Copy to site" and site folders in the media library. `strings.ts` spreads them in, so
 * they are used through `t()` like every other string.
 */
export const siteStrings = {
  "settings.sitesDescription": "Your websites, their domains and who works on each",
  "sites.title": "Websites and domains",
  "sites.subtitle":
    "Each site is one website, with its own pages, menus and languages. Run several brands or countries from one {product}.",
  "sites.loading": "Loading sites…",
  "sites.add": "Add a site",
  "sites.addTitle": "Add a site",
  "sites.addDescription":
    "Only the name is needed now. You can add domains and languages whenever you’re ready.",
  "sites.editTitle": "Edit {name}",
  "sites.edit": "Edit {name}",
  "sites.remove": "Delete {name}",
  "sites.removeTitle": "Delete {name}?",
  "sites.removeMessage":
    "Its menus, site settings and languages are deleted too. Files in its media folder move to the shared library. A site with entries can’t be deleted until they are moved or deleted.",
  "sites.removeConfirm": "Delete site",
  "sites.main": "Main site",
  "sites.noDomain": "No domain yet",
  "sites.footerMany":
    "Switch between sites at the top of the sidebar. Lists and editors show the site you’re working on.",
  "sites.oneSiteTitle": "You have one site",
  "sites.oneSiteDescription":
    "Add another to run a second brand, country or language from this {product}. Your current site carries on exactly as it is.",
  "sites.name": "Name",
  "sites.nameHint": "What editors see, such as “Acme France”.",
  "sites.handle": "Handle",
  "sites.handleHint": "How developers ask for this site, as ?site=handle. It can’t change later.",
  "sites.domains": "Domains",
  "sites.domainsHint":
    "Where the site lives, such as acme.fr, www.acme.fr. Separate several with commas.",
  "sites.pathPrefix": "Path (optional)",
  "sites.pathPrefixHint":
    "Only when sites share a domain: /fr puts this site at acme.com/fr. Leave empty otherwise.",
  "sites.siteUrl": "Site address",
  "sites.siteUrlHint": "The full public address, used in the sitemap and previews.",
  "sites.mainLanguage": "Main language",
  "sites.mainLanguageHint": "Add more languages in Settings → Languages while this site is chosen.",
  "sites.extraLanguages": "Other languages (optional)",
  "sites.extraLanguagesHint": "Tick any other languages this site is written in.",
  "sites.accentColor": "Accent colour (optional)",
  "sites.accentColorHint":
    "A hex colour such as #7539fd, for themes and white-label admin branding.",
  "sites.problem.name": "Please give the site a name",
  "sites.switcher.label": "Working on",
  "sites.everySite": "Every site",
  "sites.onlySite": "Only {name}",
  "sites.thisSiteOnly": "This site only",
  "sites.taxonomyOwner": "Used on",
  "sites.access.title": "Who works on which site",
  "sites.access.description":
    "Each role can work on every site, or be kept to some. People only see the sites their roles allow.",
  "sites.access.legend": "Sites {name} can work on",
  "sites.collections.title": "Content on each site",
  "sites.collections.description":
    "Choose whether each site writes its own entries, or every site shows the same ones.",
  "sites.collections.scopeLabel": "How {name} works across sites",
  "sites.collections.perSite": "Each site its own",
  "sites.collections.shared": "Shared",
  "sites.collections.sharedHint":
    "Every site shows the same entries. They are edited while the main site is chosen.",
  "sites.collections.sitesLegend": "Sites that use {name}",
  "sites.copy.action": "Copy to site…",
  "sites.copy.title": "Copy to another site",
  "sites.copy.description":
    "Starts a draft on the other site with this entry’s content, ready to adapt. Nothing goes live until you publish it there.",
  "sites.copy.site": "Copy to",
  "sites.copy.confirm": "Copy",
  "sites.copy.copying": "Copying…",
  "sites.media.label": "Folder",
  "sites.media.all": "All files",
  "sites.media.shared": "Shared",
  "sites.media.site": "{name}",
} as const;
