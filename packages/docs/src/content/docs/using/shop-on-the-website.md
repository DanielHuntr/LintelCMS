---
title: Your shop on the website
description: Product pages, collections, the basket and checkout on the built-in website, and the shop's elements in the page builder.
since: "0.6"
sidebar:
  label: Your shop on the website
---

With the **Online shop** plugin on, the built-in website has a shop straight away, with no
design work: product pages, collection pages, a basket and an order confirmation page. Each
can be redesigned in the page builder whenever you like.

## The shop's pages

| Address               | Shows                                                   |
| --------------------- | ------------------------------------------------------- |
| `/shop`               | Every product on sale, with sorting and pages           |
| `/shop/<collection>`  | One of your product collections                         |
| `/products/<product>` | A product: pictures, price, options, Add to basket      |
| `/cart`               | The basket, delivery details, delivery choice and Pay   |
| `/order-confirmation` | "Thank you", with the order number once payment arrives |

A page you publish at one of these addresses takes its place, so you can design your own
basket page or shop front.

## The shop's elements

In the page builder, under **Insert → Elements → Shop**:

- **Product grid**: products from the shop or one collection, with a sort menu. Like a
  [collection list](/using/collection-lists/), what's inside it is the design for each
  product; it starts with a Product card.
- **Product card**: a product's picture, name and price, linking to its page.
- **Product pictures**, **Price** (with the old price crossed out when it's on sale),
  **Options picker** (size, colour) and **Add to basket**: the parts of a product page.
  Each shows the product the page is for, or one you choose in Content.
- **Basket button**: a basket icon with the number of items, which opens the basket from
  the side. Put it in your header.
- **Basket** and **Checkout button**: for your own basket page.
- **Order confirmation**: for your own thank-you page.

## Your own product page design

1. Make a page, such as "Product design".
2. Select the page itself in Layers and, in Content, choose **Use this page as the design of
   every entry in**: Products in the shop.
3. Add the shop's elements, and headings or rich text that **Show** the product's name, price
   or description.
4. Publish it. Every product page now uses it.

## Paying

The basket lives in the shopper's browser. When they press **Pay now** on the basket page,
the website starts a checkout with the shop's payment provider (Stripe, and PayPal or Mollie
when they are set up) through the storefront API, and the shopper pays on the provider's own
secure page. Card details never pass through your website. The provider brings them back to
`/order-confirmation`, which waits for the payment to be confirmed and then shows the order
number.

For developers: the website reaches the storefront API at its own address,
`/_lintel/api/shop/...` (and forms at `/_lintel/api/forms/...`), so pages need no other origin
and no CORS settings. The Commerce API reference describes what it answers.
