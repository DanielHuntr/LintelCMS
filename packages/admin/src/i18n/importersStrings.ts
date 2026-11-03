/**
 * The words for Build → Import's "Move your site to {product}" hub and the Webflow,
 * Framer, Statamic and Umbraco importers. The steps they share with the WordPress importer
 * use its strings (`wordpress.*`, in dataToolsStrings.ts). `strings.ts` spreads these in.
 */
export const importersStrings = {
  "import.moveHeader": "Move your site to {product}",
  "import.moveFooter":
    "Each importer shows what it found, lets you choose where things go, checks everything with a dry run, then imports in the background. Nothing already here is changed.",
  "import.webflowTitle": "Webflow",
  "import.webflowDescription": "CMS collections, and pages from the code export",
  "import.framerTitle": "Framer",
  "import.framerDescription": "CMS collections, and pages as far as they can come",
  "import.statamicTitle": "Statamic",
  "import.statamicDescription":
    "Collections, the page tree, taxonomies, globals, navigation and assets",
  "import.umbracoTitle": "Umbraco",
  "import.umbracoDescription": "Document types, the content tree, media and dictionary items",
  "import.shopifyTitle": "Shopify",
  "import.shopifyDescription": "Products, customers and past orders, into the shop",

  "siteImport.webflow.title": "Import from Webflow",
  "siteImport.webflow.subtitle": "Bring a Webflow site’s collections and pages into {product}.",
  "siteImport.webflow.howTo":
    "In Webflow, open each CMS collection and choose Export to download its CSV file. For the pages, open Site settings → Export code and download the zip. Upload them here together.",
  "siteImport.webflow.filesLabel": "Collection exports (.csv, one or more)",
  "siteImport.webflow.archiveLabel": "Optional: the site’s code export (.zip)",
  "siteImport.webflow.archiveHint":
    "Its pages become designed pages, with their text and pictures editable.",
  "siteImport.framer.title": "Import from Framer",
  "siteImport.framer.subtitle": "Bring a Framer site’s CMS collections into {product}.",
  "siteImport.framer.howTo":
    "In Framer’s CMS, open each collection’s menu and choose Export CSV. Framer can’t export page designs; if you like, save the published pages (File → Save page as… in your browser) and upload them as a zip.",
  "siteImport.framer.filesLabel": "Collection exports (.csv, one or more)",
  "siteImport.framer.archiveLabel": "Optional: saved pages (.zip)",
  "siteImport.framer.archiveHint":
    "Best effort: they come in as code blocks; Framer’s effects and interactions don’t.",
  "siteImport.statamic.title": "Import from Statamic",
  "siteImport.statamic.subtitle":
    "Bring a Statamic site’s collections, page tree, taxonomies, globals, navigation and assets into {product}.",
  "siteImport.statamic.howTo":
    "Zip the site’s content folder together with resources/blueprints and the assets folder (usually public/assets), or simply zip the whole site folder, and upload it here.",
  "siteImport.statamic.archiveLabel": "The site’s folder (.zip)",
  "siteImport.statamic.archiveHint":
    "Only content, blueprints and assets are read; templates and settings are left alone.",
  "siteImport.umbraco.title": "Import from Umbraco",
  "siteImport.umbraco.subtitle":
    "Bring an Umbraco site’s document types, content tree, media and dictionary into {product}.",
  "siteImport.umbraco.howTo":
    "In Umbraco, go to Settings → uSync and choose Export, then zip the uSync folder, with a copy of the media folder for the pictures. Or upload the Content Delivery API’s answer saved as a .json file.",
  "siteImport.umbraco.filesLabel": "Optional: a Delivery API answer (.json)",
  "siteImport.umbraco.archiveLabel": "The uSync folder (.zip)",
  "siteImport.umbraco.archiveHint": "Add the media folder to the zip to bring the pictures too.",
  "siteImport.upload": "Read the files",
  "siteImport.loading": "Loading the import",
  "siteImport.foundTitle": "We’ll bring in",
  "siteImport.found.media": "{count, plural, one {# picture} other {# pictures}}",
  "siteImport.found.menus": "{count, plural, one {# menu} other {# menus}}",
  "siteImport.found.globals":
    "{count, plural, one {# set of global values} other {# sets of global values}}",
  "siteImport.found.nothing": "Nothing we can bring in was found in these files.",
  "siteImport.notesTitle": "What can’t be moved",
  "siteImport.typeTitle": "{name} ({count, plural, one {# item} other {# items}})",
  "siteImport.typeInto": "Goes into",
  "siteImport.newType": "A new content type: {name}",
  "siteImport.newTypeName": "Name of the new content type",
  "siteImport.fieldsCaption": "Which field each of the old site’s fields goes into",
  "siteImport.column.oldField": "On the old site",
  "siteImport.column.newField": "Here",
  "siteImport.fieldInto": "{name} goes into",
  "siteImport.newField": "A new field: {name}",
  "siteImport.optionsTitle": "Everything else",
  "siteImport.taxonomyInto": "{name} goes into",
  "siteImport.newTaxonomy": "A new taxonomy: {name}",
  "siteImport.drafts": "Drafts and archived items",
  "siteImport.media": "Bring in the pictures ({count})",
  "siteImport.mediaHostsHint":
    "Pictures from the old site and its own picture servers ({hosts}) are always allowed. Add any other address, separated by commas.",
  "siteImport.noHosts": "none",
  "siteImport.menus": "Bring in the menus ({count})",
  "siteImport.globals": "Bring in the global values ({count})",
  "siteImport.count.entry": "Pages and items",
  "siteImport.count.media": "Pictures and files",
  "siteImport.count.contentType": "Content types",
  "siteImport.count.taxonomy": "Taxonomies",
  "siteImport.count.term": "Terms",
  "siteImport.count.menu": "Menus",
  "siteImport.count.global": "Global values",
  "siteImport.createdTitle": "Made for this import",
  "siteImport.designedTitle": "Designed pages to check",
  "siteImport.designedText":
    "These came in as code blocks that look like the original. Their text and pictures are editable in the Content panel; animations, interactions and scripts didn’t come across.",
  "siteImport.leftOutTitle": "Values left out",
  "siteImport.leftOutText":
    "These values couldn’t go into the field chosen for them, so the rest was imported without them:",
  "siteImport.kind.text": "Text",
  "siteImport.kind.textarea": "Long text",
  "siteImport.kind.richText": "Rich text",
  "siteImport.kind.markdown": "Markdown",
  "siteImport.kind.number": "Number",
  "siteImport.kind.toggle": "On or off",
  "siteImport.kind.date": "Date",
  "siteImport.kind.image": "Picture",
  "siteImport.kind.images": "Pictures",
  "siteImport.kind.url": "Link",
  "siteImport.kind.email": "Email address",
  "siteImport.kind.colour": "Colour",
  "siteImport.kind.select": "Choice",
  "siteImport.kind.terms": "Terms",
  "siteImport.kind.entries": "Links to other items",
  "siteImport.kind.code": "Code",
  "siteImport.kind.video": "Video",
  "siteImport.kind.list": "List",
  "siteImport.kind.design": "Page design",

  "wordpress.count.product": "Shop products",
  "wordpress.count.menu": "Menus",
  "wordpress.foundExtras":
    "Also {menus, plural, one {# menu} other {# menus}} and {products, plural, one {# shop product} other {# shop products}}.",
  "wordpress.menus": "Bring in the menus",
  "wordpress.products": "Shop products (WooCommerce)",
  "wordpress.products.import": "Bring them into the shop",
  "wordpress.products.skip": "Leave them behind",
  "wordpress.productsShopOff":
    "The online shop is switched off, so products will be left out. Switch it on in Build → Features first to bring them in.",
  "wordpress.customFieldsTitle": "Custom fields on {kind}s",
  "wordpress.customFieldsText":
    "Fields added by plugins such as Advanced Custom Fields. Choose a field of the content type for each, or leave it out.",
  "wordpress.customFieldFromAcf": "Advanced Custom Fields",
  "wordpress.customFieldInto": "{key} goes into",
  "wordpress.customFieldExample": "For example: {example}",
  "wordpress.fieldsLeftOutTitle": "Custom field values left out",
} as const;
