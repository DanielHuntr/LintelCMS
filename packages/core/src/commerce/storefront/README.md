# Storefront

The public, read-only catalogue under `/delivery/shop`, with the delivery API's access rules
(a token when the site requires one, CORS for the sites listed in Settings → API access):
markets (with `deliveryCountries`, the countries a shipping zone with a rate covers, for
checkout country pickers), active products priced for `?country=`, and collections. Responses can be cached
for a minute. Stock counts stay private: each variant only says `availableForSale`.

Carts and checkout are under the same prefix but live in `src/commerce/carts`. The
developer docs page "Commerce API" walks through all of it with examples.
