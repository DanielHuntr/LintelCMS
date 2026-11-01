# Carts

The storefront's basket. Anonymous: `POST /delivery/shop/carts` answers with a random token
(`cart_…`) for the storefront to keep, and only its SHA-256 is stored. Every endpoint
answers with the whole cart, priced in the market for its country, so storefronts never add
anything up themselves.

Each line says if it can't be bought as it is (`problem`: `unavailable`, `no_price`,
`out_of_stock`, `not_enough_stock`), and `readyForCheckout` is true once every line is fine
and there's an email, a delivery address and a shipping rate.

`cart-pricing.ts` is the arithmetic, `cart-loading.ts` gathers what it needs, and
`carts.routes.ts` lists the endpoints (checkout included). Tax isn't in the cart's total
when it's added on top: it's worked out at checkout.
