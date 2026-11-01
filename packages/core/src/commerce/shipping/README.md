# Shipping

Zones are lists of countries ("Europe"); each zone has rates:

- `flat`: the same price whatever the parcel weighs;
- `weight`: the first step the parcel fits in (`upToGrams`), not offered above the last;
- either can be free once the order (after discounts) reaches `freeOverAmounts`.

Amounts are minor units by currency (`{ "GBP": 495 }`); a currency left out is converted
from the primary one like prices are. A cart is offered the rates of the first zone listing
its country, cheapest first (`shipping-quotes.ts`).

Endpoints: `GET/POST /shop/shipping/zones`, `PATCH/DELETE /shop/shipping/zones/:id`,
`POST /shop/shipping/zones/:id/rates`, `PATCH/DELETE /shop/shipping/rates/:id`.
