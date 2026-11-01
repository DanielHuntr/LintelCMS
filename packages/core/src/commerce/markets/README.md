# Markets

Where the shop sells and in which currency: "United Kingdom" in GBP, "Europe" in EUR. The
first market made is the primary one; its currency is the shop's own. Each country is in
at most one market, and a cart's country picks its market (countries in none use the
primary market).

A variant's price in a market (`market-prices.ts`) is its own price in that currency if it
has one, otherwise the primary price converted at the market's `exchangeRate` and rounded by
its `priceRounding`. `pricesIncludeTax` says whether shoppers see prices with tax in (UK, EU)
or have it added at checkout (US).

| Method and path            | Permission        |
| -------------------------- | ----------------- |
| `GET /shop/markets`        | `commerce:read`   |
| `POST /shop/markets`       | `commerce:update` |
| `GET /shop/markets/:id`    | `commerce:read`   |
| `PATCH /shop/markets/:id`  | `commerce:update` |
| `DELETE /shop/markets/:id` | `commerce:update` |
