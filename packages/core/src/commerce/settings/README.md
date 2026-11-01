# Shop settings

One row per tenant (`shop_settings`) for the shop's name, support email, order numbering,
tax choice, checkout mode and any Stripe keys pasted in the admin. The order number counter
lives here too: `takeNextOrderNumber` reads and increases it in one statement, so numbers
never repeat and never skip.

`shop-settings.routes.ts` serves all of Shop → Settings that isn't markets, shipping or
locations: general details, taxes and payments.
