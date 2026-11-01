/**
 * The words for Shop → Move from Shopify, and archived orders on a customer. Spread into
 * `i18n/strings.ts`, so they are used through `t()`.
 */
export const shopifyImportStrings = {
  "shop.import.homeHeader": "Moving your shop",
  "shop.import.title": "Move from Shopify",
  "shop.import.subtitle": "Bring your products, customers and past orders over from Shopify",
  "shop.import.rowDescription":
    "Bring products, customers and orders over from Shopify's export files",
  "shop.import.loading": "Loading…",
  "shop.import.needsMarket":
    "Shopify's files have prices but not their currency, so choose where you sell first. Prices are read in your shop's own currency.",

  "shop.import.filesHeader": "Choose Shopify's export files",
  "shop.import.filesBody":
    "In your Shopify admin, open Products and choose Export, then “Plain CSV file”. Do the same in Customers and Orders if you'd like to bring those too.",
  "shop.import.productsFile": "Products file",
  "shop.import.productsFileHint": "products_export.csv. This is the only one you need.",
  "shop.import.customersFile": "Customers file (optional)",
  "shop.import.customersFileHint":
    "customers_export.csv. Passwords never come across; customers set up their accounts again.",
  "shop.import.ordersFile": "Orders file (optional)",
  "shop.import.ordersFileHint": "orders_export.csv. Past orders are kept as records to look up.",
  "shop.import.fileChosen": "Chosen: {name}",
  "shop.import.noKeys":
    "Nothing is changed in your Shopify shop, and you don't need to give {product} any Shopify passwords or keys.",
  "shop.import.read": "Read the files",
  "shop.import.reading": "Reading…",
  "shop.import.otherFiles": "Use different files",

  "shop.import.previewHeader": "What's in the files",
  "shop.import.previewCounts":
    "{products} products with {variants} variants and {images} photos, {customers} customers and {orders} orders.",
  "shop.import.sample": "Variants: {variants} · Photos: {images} · {price} {currency}",
  "shop.import.mappingHeader": "Where everything goes",
  "shop.import.mappingBody": "Each column in Shopify's files and what it becomes in {product}.",
  "shop.import.mappingShopify": "In Shopify's file",
  "shop.import.mappingLintel": "In {product}",
  "shop.import.notImported": "Not brought over, as {product} has nowhere to keep them: {columns}.",
  "shop.import.nothingMapped": "None of the columns in this file are ones {product} knows.",
  "shop.import.field.handle": "Product address",
  "shop.import.field.title": "Name",
  "shop.import.field.description": "Description",
  "shop.import.field.vendor": "Brand",
  "shop.import.field.productType": "Product type",
  "shop.import.field.tags": "Tags",
  "shop.import.field.status": "On sale, draft or archived",
  "shop.import.field.options": "Options, like Size and Colour",
  "shop.import.field.sku": "SKU",
  "shop.import.field.weight": "Weight",
  "shop.import.field.trackStock": "Whether stock is counted",
  "shop.import.field.stock": "Stock",
  "shop.import.field.price": "Price",
  "shop.import.field.compareAtPrice": "Was price",
  "shop.import.field.barcode": "Barcode",
  "shop.import.field.photos": "Photos",
  "shop.import.field.seoTitle": "Search engine title",
  "shop.import.field.seoDescription": "Search engine description",
  "shop.import.field.collections": "Collections",
  "shop.import.field.giftCard": "Gift cards (left out)",
  "shop.import.field.name": "Customer's name",
  "shop.import.field.email": "Email",
  "shop.import.field.phone": "Phone",
  "shop.import.field.address": "Address",
  "shop.import.field.note": "Private note",
  "shop.import.field.orderNumber": "Order number",
  "shop.import.field.currency": "Currency",
  "shop.import.field.paymentStatus": "Payment status",
  "shop.import.field.fulfilmentStatus": "Sent or not",
  "shop.import.field.totals": "Totals",
  "shop.import.field.discounts": "Discount codes",
  "shop.import.field.placedAt": "Order date",
  "shop.import.field.items": "Items bought",
  "shop.import.field.shippingAddress": "Delivery address",

  "shop.import.choicesHeader": "Your choices",
  "shop.import.statusLabel": "Products come in",
  "shop.import.statusKeep": "As they are in Shopify",
  "shop.import.statusDraft": "All as drafts",
  "shop.import.statusKeepHint": "Products on sale in Shopify go on sale here straight away.",
  "shop.import.statusDraftHint": "Nothing shows on your site until you put each product on sale.",
  "shop.import.photos": "Download the product photos",
  "shop.import.collectionsColumn": "Make collections from the Collection column ({names})",
  "shop.import.tagsLegend": "Make a collection for these tags",
  "shop.import.customers": "Bring {count} customers",
  "shop.import.orders": "Bring {count} past orders as records",
  "shop.import.ordersHint":
    "They show on each customer, for looking things up. They were paid in Shopify, so they can't be refunded from {product}.",
  "shop.import.pathLabel": "Product pages on your new site start with",
  "shop.import.pathHint":
    "Used to suggest redirects from Shopify's addresses (/products/…), so old links and search results keep working.",

  "shop.import.dryRun": "Try a dry run",
  "shop.import.dryRunning": "Checking everything…",
  "shop.import.dryRunHeader": "Dry run",
  "shop.import.dryRunBody":
    "What would happen if you imported now. Nothing has been saved or downloaded.",
  "shop.import.start": "Start importing",

  "shop.import.progressHeader": "Importing",
  "shop.import.progressHint":
    "Keep this page open. If you close it, the import pauses, and you can carry on later from where it stopped.",
  "shop.import.carryOn": "Carry on importing",
  "shop.import.stage.products": "Bringing in products… {done} of {total} done",
  "shop.import.stage.collections": "Making collections… {done} of {total} done",
  "shop.import.stage.customers": "Bringing in customers… {done} of {total} done",
  "shop.import.stage.orders": "Bringing in past orders… {done} of {total} done",
  "shop.import.stage.done": "Finishing… {done} of {total} done",

  "shop.import.doneHeader": "Your shop has moved",
  "shop.import.doneBody":
    "Here's everything that came across, and anything that didn't, with the reason. Check a few products before putting your site live.",
  "shop.import.seeProducts": "See your products",
  "shop.import.another": "Import more files",

  "shop.import.report.what": "What",
  "shop.import.report.products": "Products",
  "shop.import.report.collections": "Collections",
  "shop.import.report.customers": "Customers",
  "shop.import.report.orders": "Past orders",
  "shop.import.report.created": "Brought in",
  "shop.import.report.wouldCreate": "Would bring in",
  "shop.import.report.skipped": "Skipped",
  "shop.import.report.failed": "Couldn't",
  "shop.import.report.photos": "{downloaded} photos downloaded, {skipped} skipped.",
  "shop.import.report.photosWould": "{downloaded} photos would be downloaded, {skipped} skipped.",
  "shop.import.report.problemsHeader": "Worth a look",
  "shop.import.report.redirectsHeader": "Redirects for your old addresses",
  "shop.import.report.redirectsBody":
    "With the SEO plugin on, these are waiting in Settings → Redirects for you to accept. You can also download them for your host.",
  "shop.import.report.goesTo": "goes to",
  "shop.import.report.downloadRedirects": "Download as a spreadsheet",

  "shop.customers.archivedHeader": "Orders before the move",
  "shop.customers.archivedFooter":
    "Imported from Shopify. Kept as records; they can't be refunded or sent from here.",
} as const;
