# The PHP companion

`lintel-bridge.php`: one dependency-free PHP file (PHP 7.4 or newer, as on any cPanel host)
that Lintel uploads beside a website it publishes as files, so forms and the shop work on
hosting that only runs PHP. It is copied into `dist/bridge` at build time and uploaded as it is.

## Private folder

Its settings and everything it keeps live in `lintel-private`, beside the website when the
host allows it and otherwise inside it, protected by `.htaccess` and `web.config`:

| File             | Written by    | What it holds                                                            |
| ---------------- | ------------- | ------------------------------------------------------------------------ |
| `config.php`     | Lintel        | The shared secret, the site's address, Stripe and Mollie keys            |
| `forms.json`     | Lintel        | Each form's questions, signed                                            |
| `catalogue.json` | Lintel        | Prices per market, stock, shipping, tax, discount codes, signed          |
| `data/`          | the companion | Submissions and paid orders waiting for Lintel, stock holds, used nonces |

Keys never go into the website's own files.

## Forms

The page's form posts to `lintel-bridge.php?action=form&form=<handle>` after fetching a
signed "opened at" token (`action=token`). The companion checks the honeypot and the timer
(a bot gets the same thank-you, and nothing is kept), the required answers, email addresses
and choices, limits each address to ten a minute, and keeps the answers for Lintel.
Lintel collects them (`bridge-pull.service.ts`) into Forms with the usual emails and the
`form.submitted` event.

File upload questions are left out here: the companion has nowhere safe to keep files. Use
Lintel's API (`formDelivery: api`) for a form that asks for one.

## Shop

The basket lives in the visitor's browser. For totals and checkout the companion reads only
variant ids, quantities, the country and a discount code; every amount comes from the
signed catalogue, so a basket edited in the browser changes nothing. Checkout holds the
stock for 35 minutes under one file lock (`flock`), so two shoppers can't buy the last loaf,
and sends the shopper to Stripe Checkout or Mollie. Stripe's webhook is checked against its
signature; Mollie's is checked by fetching the payment back from Mollie. Each payment is
recorded once, and Lintel collects paid orders into Orders through the same
`placeOrderForPayment` as its own checkout, so stock, emails and `order.paid` follow.

A payment that arrives after its hold ended (a bank debit or transfer can take days) is still
recorded: a hold stops counting against stock after 35 minutes, and its details are kept for 30
days so the order can be made. Stripe's `…async_payment_succeeded` counts as paid too, so add it
to the webhook's events.

Stock and discount codes sync each time Lintel publishes or collects: an order counts
against the published stock until a catalogue made after Lintel collected it arrives.
Buy-X-get-Y codes and automatic discounts only work in Lintel's own checkout.

## Signing

`bridge-signing.ts`, matching the PHP. Files carry an HMAC-SHA256 of their contents.
Requests from Lintel (`status`, `pull`, `ack`) carry the time, a one-off nonce and an HMAC
over both, the action and the body; the companion refuses requests over five minutes old
and any nonce it has seen.

| File                        | What it does                                             |
| --------------------------- | -------------------------------------------------------- |
| `lintel-bridge.php`         | The companion                                            |
| `bridge-files.ts`           | Its file, its settings file, the private folder's guards |
| `bridge-signing.ts`         | Signed files and signed requests                         |
| `bridge-publish.service.ts` | What a publish adds for forms and the shop               |
| `bridge-pull.service.ts`    | Collecting submissions and orders                        |
| `shop-catalogue.service.ts` | The signed catalogue                                     |
| `shop-pages.ts`             | The shop's pages and the basket script                   |
| `bridge.test.ts`            | The companion under PHP's own web server                 |
