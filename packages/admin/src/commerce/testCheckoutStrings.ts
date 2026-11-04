/**
 * The words for trying the shop, test orders and how payments reach a shop. Spread into
 * `i18n/strings.ts`, so they are used through `t()`.
 */
export const testCheckoutStrings = {
  "shop.tryShop.title": "Try your shop",
  "shop.tryShop.body":
    "Place a test order on your website. You don't need a payment account, and no money is taken.",
  "shop.tryShop.action": "Place a test order",
  "shop.tryShop.opening": "Opening…",
  "shop.tryShop.notReady":
    "To try it, choose where you sell, set a delivery price and put a product on sale.",
  "shop.testOrders.badge": "Test",
  "shop.testOrders.title": "{count, plural, one {# test order} other {# test orders}}",
  "shop.testOrders.body":
    "They aren't sales. When you've finished, delete them to put the stock back.",
  "shop.testOrders.delete": "Delete test orders",
  "shop.testOrders.deleting": "Deleting…",
  "shop.testOrders.confirmTitle": "Delete test orders?",
  "shop.testOrders.confirmMessage":
    "This deletes {count, plural, one {# test order} other {# test orders}} and puts the stock back. Real orders aren't touched.",
  "shop.testOrders.keep": "Keep them",
  "shop.testOrders.detailNote": "No money was taken, and this doesn't count as a sale.",
  "shop.checks.localTitle": "The webhook can wait",
  "shop.checks.localBody":
    "{provider} can't reach this computer, so there's no webhook to set up yet. Test payments still work. Add the webhook when the site is live.",
  "shop.checks.onComputer":
    "{product} checks with {provider} for payments every few seconds while this site is on your computer. Nothing to set up.",
  "shop.checks.noWebhookYet":
    "{product} checks with {provider} for payments itself until the webhook is set up.",
  "shop.checks.testKeys": "{provider} is using test keys, so no real money moves.",
  "shop.checks.liveOnTestKeys":
    "This site is live, but {provider} is still using test keys, so nobody can really pay. Swap them for live keys.",
} as const;
