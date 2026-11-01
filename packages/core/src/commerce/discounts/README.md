# Discounts

Not built yet: this is only the hook. `DiscountProvider` is asked about every cart (its
codes, lines and subtotal) and answers with amounts to take off. The cart spreads them over
the lines in proportion before tax (`carts/cart-pricing.ts`), caps them at the subtotal, and
the hosted checkout passes them to Stripe as a one-off coupon.

The default provider, `noDiscounts`, gives nothing. Pass another as
`buildServer({ commerce: { discountProvider } })`.
