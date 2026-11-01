import { z } from "zod";
import type { Operation } from "../../openapi/openapi-operations.js";
import {
  addCartLineRequestSchema,
  cartSchema,
  cartTokenParamsSchema,
  createCartRequestSchema,
  updateCartLineRequestSchema,
  updateCartRequestSchema,
} from "../carts/carts.schema.js";
import {
  checkoutStatusSchema,
  startCheckoutRequestSchema,
  startedCheckoutSchema,
} from "../checkouts/checkouts.schema.js";
import {
  storefrontHandleParamsSchema,
  storefrontItemQuerySchema,
  storefrontListQuerySchema,
  storefrontMarketSchema,
  storefrontProductSchema,
} from "./storefront.schema.js";

/**
 * The storefront's endpoints for the OpenAPI document (src/openapi), from the same Zod
 * schemas the routes check requests with. The shop's admin endpoints are left out, like
 * every other admin-only endpoint.
 */

const moneySchema = z.object({ amount: z.number().int(), currency: z.string() });
const productPageSchema = z.object({
  items: z.array(storefrontProductSchema),
  total: z.number().int(),
  currency: z.string(),
});
const collectionSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  description: z.string(),
});
const cartLineParamsSchema = cartTokenParamsSchema.extend({ lineId: z.uuid() });
const checkoutParamsSchema = z.object({ id: z.uuid() });
const shippingRateOptionSchema = z.object({
  rateId: z.uuid(),
  name: z.string(),
  deliveryEstimate: z.string(),
  amount: moneySchema,
});

const cartResponse = { description: "The whole cart.", schema: cartSchema };
const cartNotFound = { description: "No cart has this token (CART_NOT_FOUND)." };

export const storefrontOperations: Operation[] = [
  {
    method: "get",
    path: "/delivery/shop/markets",
    tag: "Shop",
    summary: "List the shop's markets",
    description: "The countries the shop sells to, and the currency each one pays in.",
    access: "delivery",
    responses: {
      200: {
        description: "The markets.",
        schema: z.object({ markets: z.array(storefrontMarketSchema) }),
      },
    },
  },
  {
    method: "get",
    path: "/delivery/shop/products",
    tag: "Shop",
    summary: "List products on sale",
    description: "Prices are in the currency of the market for `country`, or the primary one.",
    access: "delivery",
    query: storefrontListQuerySchema,
    responses: { 200: { description: "A page of products.", schema: productPageSchema } },
  },
  {
    method: "get",
    path: "/delivery/shop/products/{handle}",
    tag: "Shop",
    summary: "Get one product on sale",
    access: "delivery",
    params: storefrontHandleParamsSchema,
    query: storefrontItemQuerySchema,
    responses: {
      200: { description: "The product.", schema: storefrontProductSchema },
      404: { description: "No product on sale has this handle." },
    },
  },
  {
    method: "get",
    path: "/delivery/shop/collections",
    tag: "Shop",
    summary: "List product collections",
    access: "delivery",
    responses: {
      200: {
        description: "The collections.",
        schema: z.object({ items: z.array(collectionSummarySchema) }),
      },
    },
  },
  {
    method: "get",
    path: "/delivery/shop/collections/{handle}",
    tag: "Shop",
    summary: "Get a collection with a page of its products",
    access: "delivery",
    params: storefrontHandleParamsSchema,
    query: storefrontListQuerySchema.omit({ collection: true }),
    responses: {
      200: {
        description: "The collection.",
        schema: collectionSummarySchema.extend({ products: productPageSchema }),
      },
      404: { description: "No collection has this handle." },
    },
  },
  {
    method: "post",
    path: "/delivery/shop/carts",
    tag: "Shop",
    summary: "Start a cart",
    description: "Keep the token: it is the only way back to the cart.",
    access: "delivery",
    body: createCartRequestSchema,
    responses: {
      201: {
        description: "The new cart and its token.",
        schema: z.object({ token: z.string(), cart: cartSchema }),
      },
    },
  },
  {
    method: "get",
    path: "/delivery/shop/carts/{token}",
    tag: "Shop",
    summary: "Get a cart",
    access: "delivery",
    params: cartTokenParamsSchema,
    responses: { 200: cartResponse, 404: cartNotFound },
  },
  {
    method: "patch",
    path: "/delivery/shop/carts/{token}",
    tag: "Shop",
    summary: "Set the email, country, address, delivery rate or discount codes",
    access: "delivery",
    params: cartTokenParamsSchema,
    body: updateCartRequestSchema,
    responses: { 200: cartResponse, 404: cartNotFound },
  },
  {
    method: "post",
    path: "/delivery/shop/carts/{token}/lines",
    tag: "Shop",
    summary: "Add an item to a cart",
    access: "delivery",
    params: cartTokenParamsSchema,
    body: addCartLineRequestSchema,
    responses: {
      200: cartResponse,
      400: { description: "The item isn't for sale (NOT_FOR_SALE)." },
      404: cartNotFound,
    },
  },
  {
    method: "patch",
    path: "/delivery/shop/carts/{token}/lines/{lineId}",
    tag: "Shop",
    summary: "Change how many of an item are in a cart",
    description: "A quantity of 0 removes the item.",
    access: "delivery",
    params: cartLineParamsSchema,
    body: updateCartLineRequestSchema,
    responses: { 200: cartResponse, 404: cartNotFound },
  },
  {
    method: "delete",
    path: "/delivery/shop/carts/{token}/lines/{lineId}",
    tag: "Shop",
    summary: "Remove an item from a cart",
    access: "delivery",
    params: cartLineParamsSchema,
    responses: { 200: cartResponse, 404: cartNotFound },
  },
  {
    method: "get",
    path: "/delivery/shop/carts/{token}/shipping-rates",
    tag: "Shop",
    summary: "List the delivery rates for a cart's address",
    access: "delivery",
    params: cartTokenParamsSchema,
    responses: {
      200: {
        description: "The rates the shopper can choose from.",
        schema: z.object({ rates: z.array(shippingRateOptionSchema) }),
      },
      404: cartNotFound,
    },
  },
  {
    method: "post",
    path: "/delivery/shop/carts/{token}/checkout",
    tag: "Shop",
    summary: "Start paying for a cart",
    description:
      "Fixes the prices, works out tax, holds the stock and starts the payment with Stripe. " +
      "The order is made only when Stripe's signed webhook says the payment arrived.",
    access: "delivery",
    params: cartTokenParamsSchema,
    body: startCheckoutRequestSchema,
    responses: {
      201: { description: "Where or how to pay.", schema: startedCheckoutSchema },
      400: { description: "Something is missing from the cart (CART_NOT_READY)." },
      404: cartNotFound,
      409: { description: "Not enough stock (OUT_OF_STOCK), or Stripe isn't connected." },
    },
  },
  {
    method: "get",
    path: "/delivery/shop/checkouts/{id}",
    tag: "Shop",
    summary: "Check whether a checkout has been paid",
    description: "For the thank-you page to poll until the order exists.",
    access: "delivery",
    params: checkoutParamsSchema,
    responses: {
      200: { description: "The checkout's status.", schema: checkoutStatusSchema },
      404: { description: "No checkout has this id." },
    },
  },
];
