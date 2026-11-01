# Taxes

Tax goes through one interface, `TaxProvider` (`tax-provider.ts`), with two implementations:

- **Stripe Tax** (`stripe-tax-provider.ts`, the default): Stripe works out the tax for the
  delivery address and records each paid order for its reports. Needs Stripe Tax switched on
  in the Stripe account, with the places the shop is registered.
- **Manual rates** (`manual-tax-provider.ts`): a percentage per country, or none. Used when
  manual is chosen, and whenever Stripe isn't connected yet, so a shop in development can
  check out with no set-up at all.

Tax is worked out once, at checkout, on each line after discounts and on shipping (unless
`taxShipping` is off). With `pricesIncludeTax` it's the tax inside the price; otherwise it's
added on top.

`GET /shop/settings/taxes` and `PATCH /shop/settings/taxes` (in `settings/`).
