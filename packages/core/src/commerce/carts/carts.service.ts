import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { ShopContext } from "../commerce.context.js";
import { findMarketForCountry } from "../markets/markets.service.js";
import { findProductRow, listVariantRowsById } from "../products/products.repository.js";
import { findCartByToken, loadPricedCart, type PricedCart } from "./cart-loading.js";
import { generateCartToken, hashCartToken } from "./cart-tokens.js";
import {
  CartLineNotFoundError,
  ShippingRateNotOfferedError,
  VariantNotForSaleError,
} from "./carts.errors.js";
import {
  addToCartLine,
  deleteCartLine,
  insertCart,
  setCartLineQuantity,
  updateCartRow,
} from "./carts.repository.js";
import type {
  AddCartLineRequest,
  Cart,
  CreateCartRequest,
  UpdateCartRequest,
} from "./carts.schema.js";

/**
 * The storefront's cart: anonymous, opened by its token. Every change answers with the
 * whole cart, priced, so the storefront never has to add anything up itself.
 */

export async function createCart(
  shop: ShopContext,
  request: CreateCartRequest,
): Promise<{ token: string; cart: Cart }> {
  const market = await findMarketForCountry(shop.database, request.country);
  const token = generateCartToken();
  const row = await insertCart(shop.database, {
    tenantId: DEFAULT_TENANT_ID,
    tokenHash: hashCartToken(token),
    marketId: market.id,
    country: request.country ?? null,
  });
  return { token, cart: await describeCart(shop, await loadPricedCart(shop, shop.database, row)) };
}

export async function findCart(shop: ShopContext, token: string): Promise<Cart> {
  const row = await findCartByToken(shop.database, token);
  return describeCart(shop, await loadPricedCart(shop, shop.database, row));
}

export async function addCartLine(
  shop: ShopContext,
  token: string,
  request: AddCartLineRequest,
): Promise<Cart> {
  const row = await findCartByToken(shop.database, token);
  const [variant] = await listVariantRowsById(shop.database, DEFAULT_TENANT_ID, [
    request.variantId,
  ]);
  const product = variant
    ? await findProductRow(shop.database, DEFAULT_TENANT_ID, variant.productId)
    : undefined;
  if (!variant || product?.status !== "active") {
    throw new VariantNotForSaleError();
  }
  await addToCartLine(shop.database, {
    tenantId: DEFAULT_TENANT_ID,
    cartId: row.id,
    variantId: variant.id,
    quantity: request.quantity,
  });
  await updateCartRow(shop.database, row.id, {});
  return findCart(shop, token);
}

export async function updateCartLine(
  shop: ShopContext,
  token: string,
  lineId: string,
  quantity: number,
): Promise<Cart> {
  const row = await findCartByToken(shop.database, token);
  const changed =
    quantity === 0
      ? await deleteCartLine(shop.database, row.id, lineId)
      : await setCartLineQuantity(shop.database, row.id, lineId, quantity);
  if (!changed) {
    throw new CartLineNotFoundError();
  }
  await updateCartRow(shop.database, row.id, {});
  return findCart(shop, token);
}

/**
 * Email, address, shipping choice and discount codes. A new country (from either field)
 * can move the cart to another market, which changes its currency; a shipping choice that
 * isn't offered for the new address is dropped.
 */
export async function updateCart(
  shop: ShopContext,
  token: string,
  request: UpdateCartRequest,
): Promise<Cart> {
  const row = await findCartByToken(shop.database, token);
  const country = request.shippingAddress?.country ?? request.country;
  const market = country ? await findMarketForCountry(shop.database, country) : undefined;
  await updateCartRow(shop.database, row.id, {
    ...(request.email !== undefined && { email: request.email.toLowerCase() }),
    ...(country !== undefined && { country }),
    ...(request.shippingAddress !== undefined && { shippingAddress: request.shippingAddress }),
    ...(market && { marketId: market.id }),
    ...(request.shippingRateId !== undefined && { shippingRateId: request.shippingRateId }),
    ...(request.discountCodes !== undefined && { discountCodes: request.discountCodes }),
  });

  const updated = await findCartByToken(shop.database, token);
  const priced = await loadPricedCart(shop, shop.database, updated);
  if (updated.shippingRateId && !priced.chosenShipping) {
    if (request.shippingRateId) {
      throw new ShippingRateNotOfferedError();
    }
    await updateCartRow(shop.database, row.id, { shippingRateId: null });
    return findCart(shop, token);
  }
  return describeCart(shop, priced);
}

/** The ways the cart can be shipped to its address (or country), cheapest first. */
export async function listCartShippingRates(shop: ShopContext, token: string) {
  const row = await findCartByToken(shop.database, token);
  const priced = await loadPricedCart(shop, shop.database, row);
  return { rates: priced.shippingQuotes };
}

export async function describeCart(shop: ShopContext, priced: PricedCart): Promise<Cart> {
  const { row, market } = priced;
  const currency = market.currency;
  const images = await shop.assetLookup.findAssetsByIds(
    priced.lines.flatMap((line) => (line.imageId ? [line.imageId] : [])),
  );
  const shippingAmount = priced.chosenShipping?.amount.amount ?? 0;
  const buyable = priced.lines.filter((line) => line.problem === null);
  const missingDetails = !row.email || !row.shippingAddress || !priced.chosenShipping;
  return {
    id: row.id,
    market: {
      handle: market.handle,
      name: market.name,
      currency,
      pricesIncludeTax: market.pricesIncludeTax,
    },
    country: row.shippingAddress?.country ?? row.country,
    email: row.email,
    shippingAddress: row.shippingAddress,
    shippingRateId: priced.chosenShipping?.rateId ?? null,
    discountCodes: row.discountCodes,
    lines: priced.lines.map((line) => {
      const image = line.imageId ? images.get(line.imageId) : undefined;
      return {
        id: line.id,
        variantId: line.variantId,
        productId: line.productId,
        productTitle: line.productTitle,
        productHandle: line.productHandle,
        variantTitle: line.variantTitle,
        sku: line.sku,
        image: image ? { id: image.id, url: image.url, alt: image.alt } : null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        compareAtPrice: line.compareAtPrice,
        subtotal: line.subtotal,
        quantityAvailable: line.quantityAvailable,
        problem: line.problem,
      };
    }),
    itemCount: priced.lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: priced.subtotal,
    discounts: priced.discounts.map((discount) => ({
      code: discount.code,
      title: discount.title,
      amount: { amount: discount.amount, currency },
    })),
    shipping: priced.chosenShipping?.amount ?? null,
    total: {
      amount: priced.subtotal.amount - priced.discountTotal + shippingAmount,
      currency,
    },
    readyForCheckout:
      buyable.length > 0 && buyable.length === priced.lines.length && !missingDetails,
  };
}
