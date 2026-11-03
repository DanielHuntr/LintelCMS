# 55. Publishing the website as files, with a PHP companion

Date: 2026-11-01

## Context

Many people who want Lintel have hosting that can't run Node.js: PHP-only shared hosting,
cPanel without "Setup Node.js App", plain FTP space. Asking them to move hosts is the
biggest reason they can't use it.

## Decision

Lintel's admin runs wherever Node.js runs (their computer, a small cloud server) and
publishes the website as files to the hosting they have (`src/static-site`,
`src/publishing`).

- Pages are drawn by the live website's own code, not a second renderer, so the two can't
  drift apart. Only picture addresses differ.
- Exports are incremental, from fingerprints of what each page depends on, because a
  publish over FTP has to be quick enough to do after every change.
- The things a static site can't do alone (forms, the shop's checkout) are handled by one
  dependency-free PHP file uploaded beside the site (`src/bridge`), since PHP is what such
  hosting always has. It trusts nothing from the browser: prices come from a catalogue
  Lintel signs, payments are confirmed by Stripe's signature or by asking Mollie, and Lintel
  collects results with signed, replay-protected requests.
- Member logins stay a live-server feature: they need sessions and private pages that a
  folder of files can't keep private.

## Consequences

- Forms, orders and stock reach Lintel when it collects (every five minutes while it runs,
  and on every publish), not instantly.
- Stock and discount usage are counted in two places between publishes; the companion holds
  stock under a file lock and counts its own orders until Lintel's next catalogue includes them.
- Shop features that need Lintel's full rules (automatic and buy-X-get-Y discounts, Stripe
  Tax) only work on a live server.
