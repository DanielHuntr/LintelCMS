# Storefront

The public, read-only catalogue under `/delivery/shop`, with the delivery API's access rules
(a token when the site requires one, CORS for the sites listed in Build → API access):
markets (with `deliveryCountries`, the countries a shipping zone with a rate covers, for
checkout country pickers), active products priced for `?country=`, and collections. Responses can be cached
for a minute. Stock counts stay private: each variant only says `availableForSale`.

Until the shop can take an order (a market whose payment provider is connected, and a
delivery price somewhere), `shop-readiness.service.ts` says so and every product comes back
with `comingSoon: true` and nothing for sale, so the website says "Coming soon" rather than
letting shoppers fill a basket that checkout would turn away. A test session sees products
for sale either way (see `../test-checkout`).

Carts and checkout are under the same prefix but live in `src/commerce/carts`. The
developer docs page "Commerce API" walks through all of it with examples.
