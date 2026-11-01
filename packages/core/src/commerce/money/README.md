# Money

Amounts are whole numbers in the currency's smallest unit, never floats: `{ amount: 1999,
currency: "EUR" }` is €19.99. Adding, multiplying and splitting (`allocateAmount`, which
always adds back up exactly) are in `money.ts`.

| File                  | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `money.ts`            | The Money type, arithmetic, `allocateAmount`, `moneySchema`         |
| `currencies.ts`       | ISO currency and country codes, and decimal places, all from Intl   |
| `money-format.ts`     | `formatMoney`: "€19.99", "19,99 €", "¥1,999" with Intl.NumberFormat |
| `price-conversion.ts` | Converting into a market's currency, and its rounding rule          |

Rounding rules: `exact`, `whole` (up to the next whole amount) and `ninety_nine` (up to the
next .99). Currencies without minor units, such as yen, step in hundreds.
