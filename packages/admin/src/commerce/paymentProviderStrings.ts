/**
 * The words for PayPal, Mollie and choosing a provider per market, in Shop → Settings →
 * Payments. Spread into `i18n/strings.ts`, so they are used through `t()`.
 */
export const paymentProviderStrings = {
  "shop.providers.chooseLabel": "Payment provider to set up",
  "shop.providers.name.stripe": "Stripe",
  "shop.providers.name.paypal": "PayPal",
  "shop.providers.name.mollie": "Mollie",
  "shop.providers.name.test": "Test checkout",
  "shop.providers.notConnectedOption": "{name} (not connected yet)",
  "shop.providers.marketsHeader": "Who takes payments",
  "shop.providers.marketsBody":
    "Each market's shoppers pay with one provider. Stripe is used unless you choose another. Shoppers always pay on the provider's own secure page, so card details never reach your site.",

  "shop.paypal.stepsLabel": "Steps to connect PayPal",
  "shop.paypal.step1Title": "Make an app in PayPal",
  "shop.paypal.step1Body":
    "Sign in to PayPal's developer dashboard with your PayPal business account, open Apps & Credentials and choose Create App. Use the Sandbox tab to test first.",
  "shop.paypal.step1Action": "Open PayPal's developer dashboard",
  "shop.paypal.step2Title": "Add the webhook",
  "shop.paypal.step2Body":
    "In your app, scroll to Webhooks and choose Add Webhook. Paste this address and tick the events below. PayPal then shows the webhook's ID, which you'll need in the next step.",
  "shop.paypal.step3Title": "Paste your app's details",
  "shop.paypal.step3Body":
    "Copy the Client ID and Secret from the top of your app's page, and the webhook ID from step 2. {product} checks them with PayPal before saving.",
  "shop.paypal.step3BodyLocal":
    "Copy the Client ID and Secret from the top of your app's page. {product} checks them with PayPal before saving.",
  "shop.paypal.environmentLabel": "Where you copied them from",
  "shop.paypal.sandbox": "Sandbox (testing)",
  "shop.paypal.live": "Live",
  "shop.paypal.clientIdLabel": "Client ID",
  "shop.paypal.clientIdHint": "A long code from the top of your app's page.",
  "shop.paypal.savedHint": "Saved: {hint}. Paste a new one to replace it.",
  "shop.paypal.secretLabel": "Secret",
  "shop.paypal.secretHint": "Under “Secret key 1”, choose Show. It's never shown again here.",
  "shop.paypal.webhookIdLabel": "Webhook ID",
  "shop.paypal.webhookIdHint":
    "Shown beside the webhook in step 2. Without it, PayPal's messages can't be checked, so no orders are made.",
  "shop.paypal.save": "Save and check",
  "shop.paypal.disconnect": "Disconnect PayPal",
  "shop.paypal.fromServer":
    "PayPal's details are set on the server, so they can't be changed here.",

  "shop.mollie.stepsLabel": "Steps to connect Mollie",
  "shop.mollie.step1Title": "Make a Mollie account",
  "shop.mollie.step1Body":
    "Mollie takes cards, iDEAL, Bancontact and other ways to pay that are popular in Europe. You can test before Mollie has checked your business.",
  "shop.mollie.step1Action": "Sign up with Mollie",
  "shop.mollie.step2Title": "Paste your API key",
  "shop.mollie.step2Body":
    "In Mollie's dashboard, open Developers → API keys and copy the test API key, which starts with test_. Use the live key when you're ready to take real money.",
  "shop.mollie.step2Action": "Open Mollie's API keys",
  "shop.mollie.apiKeyLabel": "API key",
  "shop.mollie.apiKeyHint": "Starts with test_ or live_.",
  "shop.mollie.save": "Save and check",
  "shop.mollie.disconnect": "Disconnect Mollie",
  "shop.mollie.fromServer": "Mollie's API key is set on the server, so it can't be changed here.",
  "shop.mollie.webhookAutomatic":
    "Nothing else to set up: each payment tells Mollie to report back to {url}.",
  "shop.mollie.webhookLocal":
    "Mollie can't reach this computer, so {product} checks with Mollie instead. Test payments still work, and there's nothing to set up.",
} as const;
