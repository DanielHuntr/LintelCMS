# Discounts

Codes shoppers type ("SUMMER20") and automatic discounts that apply by themselves, made in
Shop → Discounts. The cart asks a `DiscountProvider` about every cart; the default,
`storedDiscounts`, uses the ones saved here. Another provider can still be passed as
`buildServer({ commerce: { discountProvider } })`.

| Kind            | What it takes off                                                         |
| --------------- | ------------------------------------------------------------------------- |
| `percentage`    | `percentOff` of the items in scope, rounded half up once, then shared     |
| `fixed_amount`  | `amounts[currency]`; a currency with no amount isn't offered the discount |
| `free_shipping` | the chosen delivery rate costs nothing                                    |
| `buy_x_get_y`   | in each group of buy + get items (dearest first), the cheapest get % off  |

A discount is for the whole order, some products, or some collections (manual or by
rules). Minimum spend (per currency) and minimum quantity count only the items in scope.

## Combining

One code per order. Automatic discounts apply by themselves: the one saving most on the
items, plus a free-shipping one. A code adds to them, unless either is marked "can't be
combined"; then only the bigger saving applies and the shopper is told why
(`discount-selection.ts`).

## Telling the shopper

Every reason a code doesn't apply is a sentence for the shopper: "This code has expired.",
"Spend £50.00 or more to use this code." Codes that can't be used at all (unknown, not
started, expired, used up, already used by this email) are refused when entered
(`400 DISCOUNT_CODE_INVALID`) and again at checkout (`409`) if that changed in the meantime.
The others stay in the cart, listed in `discountProblems`, because adding to the cart can
fix them.

## Usage limits

A checkout holds one use of each discount it has (`shop_discount_redemptions`), taken
inside the checkout's transaction after locking the discount, so two shoppers can't both
get the last use. A hold counts while its checkout is open, becomes a use when the order is
placed, and stops counting when the checkout is abandoned or runs out.

## Money

Order-wide discounts are spread over the lines in proportion; product and collection ones
fall on their own lines (`carts/cart-pricing.ts`). Tax is worked out on what's left, the
order lines keep their share, and refunds give back a line's discounted price
(`orders/order-totals.ts`). A free-shipping discount is recorded with the delivery it saved,
which is already off the shipping line rather than in `discountAmount`.

| File                    | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `discount-provider.ts`  | The interface the cart uses                               |
| `stored-discounts.ts`   | The default provider: loads what a cart could use         |
| `discount-selection.ts` | Which discounts apply together                            |
| `discount-rules.ts`     | Dates, limits, conditions and the arithmetic of each kind |
| `discount-uses.ts`      | Holding a use at checkout                                 |
| `discounts.*`           | The table, schema, Shop → Discounts endpoints             |

Endpoints: `GET/POST /shop/discounts`, `GET/PUT/DELETE /shop/discounts/:id`.
