# Inventory

Stock per variant per location, and reservations that hold stock while a shopper pays.

```text
available = on hand at active locations − active reservations that haven't expired
```

**No overselling.** `reserveStock` runs inside the checkout's transaction. It locks the
variants' rows (`SELECT … FOR UPDATE`, in id order so two checkouts never wait on each
other), sums what's on hand and held, and refuses with `OutOfStockError` if there isn't
enough. A second checkout for the same variant waits for the first to commit and then sees
its reservation. `inventory.test.ts` races six shoppers for two shirts.

Reservations end three ways: `committed` when the order is placed (stock leaves the shelf,
from the first location that has it), `released` when the checkout is abandoned or
replaced, or simply ignored once `expiresAt` passes. The every-minute job in
`commerce.plugin.ts` tidies expired ones up.

Variants with `inventoryTracked` off are never counted. Locations: `GET/POST
/shop/locations`, `PATCH/DELETE /shop/locations/:id`; "Main location" is made the first
time one is needed, and the last one can't be deleted.
